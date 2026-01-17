// server.js
const express       = require('express');
const dotenv        = require('dotenv');
const fetch         = require('node-fetch');
dotenv.config();

// WARNING: Using LIVE keys for local development is not recommended and will likely fail.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in the environment. Please add it to your .env file.');
}

// AI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in the environment. Please add it to your .env file.');
}

// Admin Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD is not set in the environment. Please add it to your .env file.');
}

// Firebase Configuration
const requiredFirebaseEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID', 
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID'
];

for (const envVar of requiredFirebaseEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} is not set in the environment. Please add it to your .env file.`);
  }
}
const stripe = require('stripe')(stripeSecretKey);
const admin         = require('firebase-admin');
const bodyParser    = require('body-parser');
const fileUpload    = require('express-fileupload');
const path          = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const cors          = require('cors');
const fs            = require('fs');
const nodemailer    = require('nodemailer');
const { exec }      = require('child_process');
const { promisify }  = require('util');
const os            = require('os');
const execAsync      = promisify(exec);

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());          // parses multipart/form‑data (fields ➜ req.body, files ➜ req.files)
app.use(cors());

// ────────────────────────────────────────────────────────────
// Firebase
// ────────────────────────────────────────────────────────────
// Firebase configuration using environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
};

// Initialize Firebase Admin (handle case where app might already be initialized)
let db;
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
  });
  db = admin.firestore();
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  // If app already exists, use the existing app
  if (error.code === 'app/already-exists') {
    console.log('Firebase Admin app already initialized, using existing instance');
    db = admin.firestore();
  } else {
    console.error('Error initializing Firebase Admin:', error);
    throw error;
  }
}

// ────────────────────────────────────────────────────────────
// Static files
// ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────
app.get('/', (_, res) => {
  res.send('Welcome to the PDF Editing Server');
});

// Site-wide authentication endpoint (uses ADMIN_PASSWORD from env)
app.post('/api/verify-password', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required' 
      });
    }

    // Debug logging (remove in production)
    console.log('Password verification attempt - Received:', password, 'Expected:', ADMIN_PASSWORD);
    console.log('Password match:', password === ADMIN_PASSWORD);
    console.log('Password lengths - Received:', password.length, 'Expected:', ADMIN_PASSWORD ? ADMIN_PASSWORD.length : 'undefined');

    if (password === ADMIN_PASSWORD) {
      res.json({ 
        success: true, 
        message: 'Authentication successful' 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during authentication' 
    });
  }
});

// Admin authentication endpoint
app.post('/api/admin-login', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required' 
      });
    }

    if (password === ADMIN_PASSWORD) {
      res.json({ 
        success: true, 
        message: 'Authentication successful' 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during authentication' 
    });
  }
});

// Admin forms data endpoint
app.get('/api/admin-forms', async (req, res) => {
  try {
    console.log('Loading forms for admin console...');
    
    // Check if db is initialized
    if (!db) {
      throw new Error('Firebase Firestore database is not initialized');
    }
    
    const formsRef = db.collection('forms');
    const snapshot = await formsRef.get();
    
    const formsData = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      formsData.push({
        id: doc.id,
        ...data
      });
    });
    
    console.log(`Found ${formsData.length} forms for admin console`);
    res.json({ 
      success: true, 
      forms: formsData 
    });

  } catch (error) {
    console.error('Error loading admin forms:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load forms data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code || undefined
    });
  }
});

// Admin save forms endpoint
app.post('/api/admin-save-forms', async (req, res) => {
  try {
    const { forms } = req.body;
    
    if (!forms || !Array.isArray(forms)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Forms data is required' 
      });
    }

    console.log(`Saving ${forms.length} forms to Firebase...`);
    
    const batch = db.batch();
    const formsRef = db.collection('forms');
    
    // Clear existing forms
    const snapshot = await formsRef.get();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Add new forms
    forms.forEach(form => {
      const docRef = formsRef.doc(form.id || form.name);
      batch.set(docRef, form);
    });
    
    await batch.commit();
    
    console.log(`Successfully saved ${forms.length} forms to Firebase`);
    res.json({ 
      success: true, 
      message: `Successfully saved ${forms.length} forms` 
    });

  } catch (error) {
    console.error('Error saving admin forms:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save forms data' 
    });
  }
});

// Admin save individual form endpoint
app.post('/api/admin-save-form', async (req, res) => {
  try {
    const { formId, formData } = req.body;
    
    if (!formId || !formData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Form ID and form data are required' 
      });
    }

    console.log(`Saving individual form ${formId} to Firebase...`);
    
    // Remove the id from formData since it's the document ID
    const { id, ...dataToSave } = formData;
    
    await db.collection('forms').doc(formId).set(dataToSave);
    
    console.log(`Successfully saved form ${formId} to Firebase`);
    res.json({ 
      success: true, 
      message: 'Form saved successfully' 
    });

  } catch (error) {
    console.error('Error saving individual admin form:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save form' 
    });
  }
});

// Admin delete form endpoint
app.delete('/api/admin-delete-form/:formId', async (req, res) => {
  try {
    const { formId } = req.params;
    
    if (!formId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Form ID is required' 
      });
    }

    console.log(`Deleting form ${formId} from Firebase...`);
    
    await db.collection('forms').doc(formId).delete();
    
    console.log(`Successfully deleted form ${formId} from Firebase`);
    res.json({ 
      success: true, 
      message: 'Form deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting admin form:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete form' 
    });
  }
});

// Debug endpoint to check forms in source database
app.get('/api/debug-forms', async (req, res) => {
  try {
    const sourceProjectId = 'invoice-4f2b4';
    
    // Initialize source Firebase app
    const sourceApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${sourceProjectId}.firebaseio.com`
    }, 'debugSourceApp');
    
    const sourceDb = sourceApp.firestore();

    // Get all forms from source
    const snapshot = await sourceDb.collection('forms').get();
    const forms = [];
    
    snapshot.forEach(doc => {
      const formData = doc.data();
      forms.push({
        id: doc.id,
        name: formData.name || 'Unnamed',
        description: formData.description || 'No description',
        counties: formData.counties || []
      });
    });

    // Clean up
    await sourceApp.delete();

    res.json({
      success: true,
      projectId: sourceProjectId,
      totalForms: forms.length,
      forms: forms
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ────────────────────────────────────────────────────────────
// Form Transfer Endpoint (Accepts Forms Data)
// ────────────────────────────────────────────────────────────
app.post('/api/transfer-forms-data', async (req, res) => {
  try {
    const { forms, targetProjectId } = req.body;
    
    if (!forms || !Array.isArray(forms) || forms.length === 0) {
      return res.status(400).json({ error: 'Forms data is required' });
    }

    if (!targetProjectId) {
      return res.status(400).json({ error: 'Target project ID is required' });
    }

    // Initialize target Firebase app (FormWiz)
    const targetApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${targetProjectId}.firebaseio.com`
    }, 'targetApp');
    
    const targetDb = targetApp.firestore();

    // Transfer forms to target database
    const batch = targetDb.batch();
    let transferredCount = 0;

    for (const form of forms) {
      const formRef = targetDb.collection('forms').doc(form.id);
      const { id, ...formData } = form; // Remove id from data since it's the document ID
      batch.set(formRef, formData);
      transferredCount++;
      console.log(`Transferring form: ${form.id} - ${form.name || 'Unnamed'}`);
    }

    await batch.commit();

    // Clean up
    await targetApp.delete();

    res.json({ 
      success: true, 
      message: `Successfully transferred ${transferredCount} forms`,
      transferredCount 
    });

  } catch (error) {
    console.error('Error transferring forms data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ────────────────────────────────────────────────────────────
// Form Transfer Endpoint (Secure)
// ────────────────────────────────────────────────────────────
app.post('/api/transfer-forms', async (req, res) => {
  try {
    const { sourceProjectId, targetProjectId } = req.body;
    
    if (!sourceProjectId || !targetProjectId) {
      return res.status(400).json({ error: 'Source and target project IDs are required' });
    }

    // Initialize source Firebase app
    const sourceApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${sourceProjectId}.firebaseio.com`
    }, 'sourceApp');
    
    const sourceDb = sourceApp.firestore();

    // Initialize target Firebase app (FormWiz)
    const targetApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${targetProjectId}.firebaseio.com`
    }, 'targetApp');
    
    const targetDb = targetApp.firestore();

    // Get all forms from source
    console.log(`Attempting to read from source project: ${sourceProjectId}`);
    const snapshot = await sourceDb.collection('forms').get();
    const formsToTransfer = [];
    
    console.log(`Found ${snapshot.size} documents in source forms collection`);
    
    snapshot.forEach(doc => {
      const formData = doc.data();
      formData.id = doc.id;
      formsToTransfer.push(formData);
      console.log(`Form found: ${doc.id} - ${formData.name || 'Unnamed'}`);
    });

    if (formsToTransfer.length === 0) {
      console.log('No forms found to transfer');
      return res.json({ 
        success: true, 
        message: 'No forms found in source database',
        transferredCount: 0,
        debug: {
          sourceProjectId,
          targetProjectId,
          documentsFound: snapshot.size
        }
      });
    }

    // Transfer forms to target database
    const batch = targetDb.batch();
    let transferredCount = 0;

    for (const form of formsToTransfer) {
      const formRef = targetDb.collection('forms').doc(form.id);
      const { id, ...formData } = form;
      batch.set(formRef, formData);
      transferredCount++;
    }

    await batch.commit();

    // Clean up apps
    await sourceApp.delete();
    await targetApp.delete();

    res.json({ 
      success: true, 
      message: `Successfully transferred ${transferredCount} forms`,
      transferredCount 
    });

  } catch (error) {
    console.error('Error transferring forms:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ────────────────────────────────────────────────────────────
// AI Chat Endpoint (Secure)
// ────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Prepare messages for OpenAI API
    const messages = [
      {
        role: 'system',
        content: `You are an AI Legal Assistant designed to help users with general legal questions and guidance. 

IMPORTANT DISCLAIMERS:
- You provide general information only and cannot replace professional legal advice
- You cannot provide specific legal advice for individual cases
- Always recommend consulting with a qualified attorney for specific legal matters
- You cannot represent users in court or provide legal representation
- Information provided is for educational purposes only

Your role is to:
- Explain legal concepts in simple terms
- Provide general guidance on legal processes
- Help users understand their rights and options
- Suggest when professional legal help is needed
- Be helpful, accurate, and responsible
- ASSESS if the user's situation matches any available forms and recommend them

AVAILABLE FORMS:
- SC-100: Plaintiff's Claim form for suing a defendant
- SC-120: Defendant's Claim form for counter-suing a plaintiff  
- SC-500: Small claims form for cases related to COVID-19
- Fee Waiver: Application for waiver of court filing fees

FORM ASSESSMENT GUIDELINES:
- Listen carefully to the user's situation and needs
- If their situation matches one of the available forms, recommend it
- Provide a helpful explanation of the form and why it's appropriate
- Use the format: "If you need assistance with [situation], we recommend filling out a [Form Name] form. [Explanation of what the form does and why it's useful]."
- If multiple forms might apply, explain the differences
- If no forms match, provide general guidance and suggest consulting an attorney

Always end responses with a reminder to consult with a qualified attorney for specific legal matters.`
      },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API request failed');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    res.json({ 
      response: aiResponse,
      success: true 
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

/* ————— helper ————— */
function shouldCheck(v) {
  // Only check if explicitly set to "on" or "true" or "yes" or "1" or "checked"
  if (v === undefined || v === null || v === '')  return false;
  if (Array.isArray(v))              return v.length > 0;
  const s = String(v).trim().toLowerCase();
  // Only check for explicitly truthy values
  return s === 'on' || s === 'true' || s === 'yes' || s === '1' || s === 'checked';
}

/**
 * Map HTML form values to PDF radio group options
 * @param {PDFRadioGroup} field - The PDF radio group field
 * @param {string} value - The value from the HTML form
 * @returns {string|null} - The mapped option name or null if no match
 */
function mapRadioValue(field, value) {
  try {
    const options = field.getOptions();
    const valueStr = String(value).trim();
    
    // If the value is already a valid option, use it
    if (options.includes(valueStr)) {
      return valueStr;
    }
    
    // Handle common HTML form values
    if (valueStr === 'on' || valueStr === 'true' || valueStr === '1') {
      // For 'on' values, try to find a "Yes" option or the first available option
      const yesOption = options.find(opt => 
        opt.toLowerCase().includes('yes') || 
        opt.toLowerCase().includes('true') ||
        opt.toLowerCase().includes('1')
      );
      if (yesOption) return yesOption;
      
      // If no "Yes" option, use the first option
      if (options.length > 0) return options[0];
    }
    
    if (valueStr === 'off' || valueStr === 'false' || valueStr === '0') {
      // For 'off' values, try to find a "No" option
      const noOption = options.find(opt => 
        opt.toLowerCase().includes('no') || 
        opt.toLowerCase().includes('false') ||
        opt.toLowerCase().includes('0')
      );
      if (noOption) return noOption;
    }
    
    // Handle comma-separated values (like "on,on")
    if (valueStr.includes(',')) {
      const parts = valueStr.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        // Use the first non-empty part and try to map it
        return mapRadioValue(field, parts[0]);
      }
    }
    
    // Try partial matching
    const partialMatch = options.find(opt => 
      opt.toLowerCase().includes(valueStr.toLowerCase()) ||
      valueStr.toLowerCase().includes(opt.toLowerCase())
    );
    if (partialMatch) return partialMatch;
    
    console.log(`Could not map radio value "${valueStr}" to any option in field ${field.getName()}. Available options: ${options.join(', ')}`);
    return null;
    
  } catch (error) {
    console.error(`Error mapping radio value for field ${field.getName()}:`, error.message);
    return null;
  }
}

/**
 * POST /edit_pdf
 * Accepts ▸ a file upload named "pdf", **or** ▸ a query string ?pdf=fileName
 * and returns the edited PDF with filled‑in fields.
 */
app.post('/edit_pdf', async (req, res) => {
  let pdfBytes;
  let outputName = 'Edited_document.pdf';

  // 1️⃣  First choice: an uploaded file
  if (req.files && req.files.pdf) {
    pdfBytes   = req.files.pdf.data;
    outputName = `Edited_${req.files.pdf.name}`;
    console.log(`Using uploaded PDF: ${req.files.pdf.name}`);
  } else {
    // 2️⃣  Fallback: ?pdf=fileName
    const pdfName = req.query.pdf;
    if (!pdfName) {
      return res.status(400).send('No PDF provided (upload a file or pass ?pdf=filename).');
    }
    // Normalize the name so passing "sc500.pdf" does NOT become "sc500.pdf.pdf"
    const normalizedBase = path.basename(pdfName).replace(/\.pdf$/i, '');
    const sanitized = normalizedBase + '.pdf';

    // Helper: find the PDF in /public/Forms (including subfolders) case-insensitively,
    // preferring the form's own subfolder (derived from the Referer URL).
    function findPdfInForms(targetFile, preferredFolder) {
      const formsRoot = path.join(__dirname, 'public', 'Forms');
      const targetLower = targetFile.toLowerCase();

      // If we know the calling form folder, search ONLY that folder.
      if (preferredFolder) {
        const preferredPath = path.join(formsRoot, preferredFolder);
        if (fs.existsSync(preferredPath) && fs.lstatSync(preferredPath).isDirectory()) {
          const entries = fs.readdirSync(preferredPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name.toLowerCase() === targetLower) {
              return path.join(preferredPath, entry.name);
            }
          }
          return null; // strictly scoped: do NOT fall back to other forms if caller folder is known
        }
      }

      // If no preferred folder inferred, search the whole tree (original behavior).
      const stack = [formsRoot];
      while (stack.length) { 
        const current = stack.shift();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            stack.push(fullPath);
          } else if (entry.isFile()) {
            if (entry.name.toLowerCase() === targetLower) {
              return fullPath;
            }
          }
        }
      }
      return null;
    }

    // Try to infer the form folder from the Referer so we pull PDFs from the same form directory.
    let preferredFolder = null;
    try {
      const ref = req.headers.referer || '';
      // Example referer: https://site.com/Forms/SC-120/sc-120.html
      const match = ref.match(/\/Forms\/([^/]+)\//i);
      if (match && match[1]) preferredFolder = match[1];
    } catch (e) {
      // ignore parsing errors and fall back to global search
    }

    const pdfPath = findPdfInForms(sanitized, preferredFolder);
    if (!pdfPath) {
      return res.status(400).send('Requested PDF does not exist on the server.');
    }
    pdfBytes   = await fs.promises.readFile(pdfPath);
    outputName = `Edited_${path.basename(pdfPath)}`;
    console.log(`Using server PDF: ${path.relative(path.join(__dirname, 'public'), pdfPath)}`);
  }

  // ── Fill the form ─────────────────────────────────────────
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form   = pdfDoc.getForm();
  const helv   = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Debug: Log all available PDF fields
  console.log('Available PDF fields:');
  form.getFields().forEach(field => {
    console.log(`- ${field.getName()} (${field.constructor.name})`);
  });

  // Debug: Log all form data received
  console.log('Form data received:');
  Object.keys(req.body).forEach(key => {
    console.log(`- ${key}: ${req.body[key]}`);
  });

  form.getFields().forEach(field => {
    const key   = field.getName();
    const value = req.body[key];

    if (value === undefined) {
      console.log(`No data for field: ${key}`);
      return;            // nothing sent for this field
    }

    console.log(`Processing field: ${key} = ${value} (${field.constructor.name})`);

    try {
      switch (field.constructor.name) {
        case 'PDFCheckBox':
          const shouldBeChecked = shouldCheck(value);
          console.log(`Checkbox ${key}: shouldCheck(${value}) = ${shouldBeChecked}`);
          shouldBeChecked ? field.check() : field.uncheck();
          break;

        case 'PDFRadioGroup':
          // Handle radio groups with proper option mapping
          const radioValue = mapRadioValue(field, value);
          console.log(`Radio ${key}: mapped "${value}" to "${radioValue}"`);
          if (radioValue) {
            field.select(radioValue);
          }
          break;

        case 'PDFDropdown':
          field.select(String(value));
          break;

        case 'PDFTextField':
          field.setText(String(value));
          field.updateAppearances(helv);
          break;

        case 'PDFSignature':
          // Skip signature fields - they can't be filled programmatically
          console.log(`Skipping signature field: ${key}`);
          break;

        default:
          // For unknown field types, try to set text if the method exists
          if (typeof field.setText === 'function') {
            field.setText(String(value));
            if (typeof field.updateAppearances === 'function') {
              field.updateAppearances(helv);
            }
          } else {
            console.log(`Skipping field ${key} of type ${field.constructor.name} - no setText method available`);
          }
          break;
      }
    } catch (error) {
      console.error(`Error processing field ${key} of type ${field.constructor.name}:`, error.message);
      // Continue processing other fields even if one fails
    }
  });

  const edited = await pdfDoc.save();
  res
    .set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${outputName}"`,
    })
    .send(Buffer.from(edited));
});

// LaTeX to PDF conversion endpoint
app.post('/latex_to_pdf', async (req, res) => {
  try {
    console.log('[LATEX SERVER] ========================================');
    console.log('[LATEX SERVER] Request received at /latex_to_pdf');
    console.log('[LATEX SERVER] Request body keys:', Object.keys(req.body));
    
    let latexContent = req.body.latex || req.body.latexContent;
    console.log('[LATEX SERVER] Raw LaTeX content type:', typeof latexContent);
    console.log('[LATEX SERVER] Raw LaTeX content length:', latexContent ? latexContent.length : 0, 'characters');
    console.log('[LATEX SERVER] Raw LaTeX content (first 300 chars):', latexContent ? latexContent.substring(0, 300) : 'NULL');
    console.log('[LATEX SERVER] Raw LaTeX content (last 300 chars):', latexContent ? latexContent.substring(Math.max(0, latexContent.length - 300)) : 'NULL');
    console.log('[LATEX SERVER] Raw LaTeX content contains \\begin{document}:', latexContent ? latexContent.includes('\\begin{document}') : false);
    console.log('[LATEX SERVER] Raw LaTeX content contains \\end{document}:', latexContent ? latexContent.includes('\\end{document}') : false);
    console.log('[LATEX SERVER] Raw LaTeX content contains \\begin{flushleft}:', latexContent ? latexContent.includes('\\begin{flushleft}') : false);
    console.log('[LATEX SERVER] Raw LaTeX content contains \\end{flushleft}:', latexContent ? latexContent.includes('\\end{flushleft}') : false);
    
    if (!latexContent) {
      console.error('[LATEX SERVER] ERROR: No LaTeX content found in request body');
      console.log('[LATEX SERVER] Available request body keys:', Object.keys(req.body));
      return res.status(400).json({ error: 'LaTeX content is required' });
    }

    // Log the full LaTeX content as received (for debugging)
    console.log('[LATEX SERVER] ========== FULL RAW LATEX CONTENT ==========');
    console.log(latexContent);
    console.log('[LATEX SERVER] ============================================');

    // Replace placeholders in LaTeX content with form field values
    // Placeholders are in the format [field_name]
    // Example: "Hello [user_fullname]" becomes "Hello John Doe"
    // IMPORTANT: Only replace placeholders that exist in formData to avoid breaking LaTeX syntax
    let processedLatex = latexContent;
    
    // Get all form field values from request body
    const formData = { ...req.body };
    delete formData.latex; // Remove latex field itself
    delete formData.latexContent; // Remove latexContent field if present
    
    console.log('[LATEX SERVER] Form data after removing latex fields:');
    console.log('[LATEX SERVER]   Keys:', Object.keys(formData));
    console.log('[LATEX SERVER]   Values:', JSON.stringify(formData, null, 2).substring(0, 1000));
    console.log('[LATEX SERVER]   Checking for user_fullname:', 'user_fullname' in formData);
    if (formData['user_fullname']) {
      console.log('[LATEX SERVER]   user_fullname value:', formData['user_fullname']);
    } else {
      console.warn('[LATEX SERVER]   WARNING: user_fullname not found in formData!');
    }
    
    // Create a regex pattern that matches all form field names as placeholders
    // Only replace [field_name] if field_name exists in formData
    // This prevents replacing LaTeX syntax like [utf8], [margin=1in], [1em], etc.
    const formFieldNames = Object.keys(formData);
    console.log('[LATEX SERVER] Available form field names for replacement:', formFieldNames.length, 'fields');
    
    // Replace each known form field placeholder
    // Only replace placeholders that are actual form field names to avoid breaking LaTeX syntax
    for (const fieldName of formFieldNames) {
      // Escape special regex characters in field name
      const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match [field_name] - use word boundaries or ensure it's not part of LaTeX package options
      // Simple approach: just match [field_name] - since we're only iterating known field names,
      // we won't accidentally match LaTeX syntax
      const fieldRegex = new RegExp(`\\[${escapedFieldName}\\]`, 'g');
      
      processedLatex = processedLatex.replace(fieldRegex, (match) => {
        const fieldValue = formData[fieldName];
        console.log('[LATEX SERVER]   Replacing placeholder [', fieldName, '] with:', fieldValue);
        
        if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
          // If field not found or empty, return empty string
          console.warn('[LATEX SERVER]     WARNING: Field value is undefined/null/empty, replacing with empty string');
          return '';
        }
        
        // Convert value to string and escape LaTeX special characters
        let value = String(fieldValue);
        console.log('[LATEX SERVER]     Original value:', value);
        
        // Escape LaTeX special characters
        // & % $ # _ { } ~ ^ \
        value = value
          .replace(/\\/g, '\\textbackslash{}')
          .replace(/\{/g, '\\{')
          .replace(/\}/g, '\\}')
          .replace(/\$/g, '\\$')
          .replace(/&/g, '\\&')
          .replace(/%/g, '\\%')
          .replace(/#/g, '\\#')
          .replace(/_/g, '\\_')
          .replace(/\^/g, '\\textasciicircum{}')
          .replace(/~/g, '\\textasciitilde{}');
        
        console.log('[LATEX SERVER]     Escaped value:', value);
        return value;
      });
    }
    
    // After replacing known placeholders, remove any remaining placeholder patterns
    // that weren't replaced. Placeholders typically contain underscores (like [field_name_1])
    // or descriptive text with spaces (like [preferred payment method, ...]).
    // We must NOT remove LaTeX package options like [utf8] or [margin=1in] which are valid LaTeX.
    // IMPORTANT: Also remove trailing line breaks (\\\) that follow placeholders to avoid LaTeX errors.
    
    // Step 1: Remove placeholders with underscores AND any trailing line breaks
    // Pattern: [field_name] followed by optional whitespace and \\
    processedLatex = processedLatex.replace(/\[([a-zA-Z0-9_]+)\]\s*\\\\/g, (match, content) => {
      // If it contains underscores, it's a form field placeholder - remove placeholder AND line break
      if (content.includes('_')) {
        console.log('[LATEX SERVER]   Removing unmatched placeholder with underscores and trailing line break:', match);
        return ''; // Remove both placeholder and \\
      }
      // Otherwise, it might be a LaTeX option (like [utf8]), keep it
      return match;
    });
    
    // Step 1b: Remove any remaining placeholders with underscores that weren't followed by \\
    processedLatex = processedLatex.replace(/\[([a-zA-Z0-9_]+)\]/g, (match, content) => {
      if (content.includes('_')) {
        console.log('[LATEX SERVER]   Removing unmatched placeholder with underscores:', match);
        return '';
      }
      return match;
    });
    
    // Step 2: Remove placeholders with spaces or descriptive text (like [preferred payment method, ...])
    // These are clearly placeholders, not LaTeX options. Also handle trailing line breaks.
    processedLatex = processedLatex.replace(/\[([^\]]*\s[^\]]*)\]\s*\\\\/g, (match, content) => {
      // Skip if it's a LaTeX option like [margin=1in] (has = and no spaces before it)
      if (match.match(/\[[a-zA-Z0-9]+=/)) {
        return match;
      }
      console.log('[LATEX SERVER]   Removing unmatched placeholder with spaces and trailing line break:', match);
      return ''; // Remove both placeholder and \\
    });
    
    // Step 2b: Remove any remaining placeholders with spaces that weren't followed by \\
    processedLatex = processedLatex.replace(/\[([^\]]*\s[^\]]*)\]/g, (match, content) => {
      // Skip if it's a LaTeX option like [margin=1in] (has = and no spaces before it)
      if (match.match(/\[[a-zA-Z0-9]+=/)) {
        return match;
      }
      console.log('[LATEX SERVER]   Removing unmatched placeholder with spaces:', match);
      return '';
    });
    
    // Log final result
    console.log('[LATEX SERVER] Processed LaTeX content (first 500 chars):', processedLatex.substring(0, 500));
    console.log('[LATEX SERVER] Processed LaTeX content (last 200 chars):', processedLatex.substring(Math.max(0, processedLatex.length - 200)));
    console.log('[LATEX SERVER] Processed LaTeX content length:', processedLatex.length, 'characters');
    
    // Ensure the document has proper structure
    const hasBeginDocument = processedLatex.includes('\\begin{document}');
    const hasEndDocument = processedLatex.includes('\\end{document}');
    
    console.log('[LATEX SERVER] Document structure check:');
    console.log('[LATEX SERVER]   Has \\begin{document}:', hasBeginDocument);
    console.log('[LATEX SERVER]   Has \\end{document}:', hasEndDocument);
    
    if (!hasBeginDocument) {
      console.warn('[LATEX SERVER] WARNING: LaTeX content missing \\begin{document}');
    }
    
    if (!hasEndDocument) {
      console.warn('[LATEX SERVER] WARNING: LaTeX content missing \\end{document}, adding it automatically');
      processedLatex = processedLatex.trim() + '\n\\end{document}\n';
      console.log('[LATEX SERVER] Added \\end{document}, new length:', processedLatex.length, 'characters');
    } else {
      console.log('[LATEX SERVER] LaTeX content already contains \\end{document}');
    }

    // Create a temporary directory for this compilation
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'latex-'));
    const texFile = path.join(tempDir, 'document.tex');
    const pdfFile = path.join(tempDir, 'document.pdf');
    
    // Write processed LaTeX content to file
    fs.writeFileSync(texFile, processedLatex, 'utf8');
    console.log('[LATEX SERVER] Wrote LaTeX file to:', texFile);
    console.log('[LATEX SERVER] Full processed LaTeX content length:', processedLatex.length, 'characters');
    
    // Read the file back to verify it was written correctly
    const writtenContent = fs.readFileSync(texFile, 'utf8');
    console.log('[LATEX SERVER] ========== FILE VERIFICATION ==========');
    console.log('[LATEX SERVER] Read back file length:', writtenContent.length, 'characters');
    console.log('[LATEX SERVER] File starts with (first 200 chars):', writtenContent.substring(0, 200));
    console.log('[LATEX SERVER] File ends with (last 200 chars):', writtenContent.substring(Math.max(0, writtenContent.length - 200)));
    console.log('[LATEX SERVER] File contains \\begin{document}:', writtenContent.includes('\\begin{document}'));
    console.log('[LATEX SERVER] File contains \\end{document}:', writtenContent.includes('\\end{document}'));
    console.log('[LATEX SERVER] File contains \\begin{flushleft}:', writtenContent.includes('\\begin{flushleft}'));
    console.log('[LATEX SERVER] File contains \\end{flushleft}:', writtenContent.includes('\\end{flushleft}'));
    console.log('[LATEX SERVER] ========================================');
    
    // Check for unmatched environments
    const beginCount = (writtenContent.match(/\\begin\{([^}]+)\}/g) || []).length;
    const endCount = (writtenContent.match(/\\end\{([^}]+)\}/g) || []).length;
    console.log('[LATEX SERVER] Environment counts - \\begin{}:', beginCount, '\\end{}:', endCount);
    
    // Extract all begin/end environment names
    const beginEnvs = (writtenContent.match(/\\begin\{([^}]+)\}/g) || []).map(m => m.match(/\\begin\{([^}]+)\}/)[1]);
    const endEnvs = (writtenContent.match(/\\end\{([^}]+)\}/g) || []).map(m => m.match(/\\end\{([^}]+)\}/)[1]);
    console.log('[LATEX SERVER] Begin environments:', beginEnvs);
    console.log('[LATEX SERVER] End environments:', endEnvs);
    
    // Check for unmatched environments (excluding document which should have 1 begin and 1 end)
    const beginWithoutDocument = beginEnvs.filter(e => e !== 'document');
    const endWithoutDocument = endEnvs.filter(e => e !== 'document');
    
    // Check for mismatched environments
    const envStack = [];
    for (let i = 0; i < beginEnvs.length; i++) {
      envStack.push(beginEnvs[i]);
    }
    for (let i = 0; i < endEnvs.length; i++) {
      const lastBegin = envStack.pop();
      if (lastBegin !== endEnvs[i]) {
        console.warn(`[LATEX SERVER] WARNING: Environment mismatch! Expected \\end{${lastBegin}} but found \\end{${endEnvs[i]}}`);
      }
    }
    if (envStack.length > 0) {
      console.warn(`[LATEX SERVER] WARNING: Unclosed environments:`, envStack);
    }
    
    // Compile LaTeX to PDF using pdflatex
    // -interaction=nonstopmode: don't stop for errors
    // -output-directory: specify output directory
    // -halt-on-error: stop on first error
    const compileCommand = `pdflatex -interaction=nonstopmode -output-directory="${tempDir}" -halt-on-error "${texFile}"`;
    
    try {
      console.log('[LATEX SERVER] Executing compilation command:', compileCommand);
      const { stdout, stderr } = await execAsync(compileCommand, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      console.log('[LATEX SERVER] Compilation stdout (first 1000 chars):', stdout.substring(0, 1000));
      console.log('[LATEX SERVER] Compilation stderr (first 1000 chars):', stderr.substring(0, 1000));
      console.log('[LATEX SERVER] Checking if PDF exists at:', pdfFile);
      console.log('[LATEX SERVER] PDF exists:', fs.existsSync(pdfFile));
      
      // Check if PDF was generated
      if (!fs.existsSync(pdfFile)) {
        // Try to read the log file for error details
        const logFile = path.join(tempDir, 'document.log');
        let errorDetails = 'LaTeX compilation failed. PDF was not generated.';
        if (fs.existsSync(logFile)) {
          const logContent = fs.readFileSync(logFile, 'utf8');
          console.log('[LATEX SERVER] LaTeX log file content (last 2000 chars):', logContent.substring(Math.max(0, logContent.length - 2000)));
          // Extract error messages from log
          const errorMatch = logContent.match(/! (.+?)\n/g);
          if (errorMatch) {
            errorDetails = 'LaTeX errors: ' + errorMatch.join('; ');
          }
        } else {
          console.warn('[LATEX SERVER] Log file does not exist at:', logFile);
        }
        
        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.error('[LATEX SERVER] Compilation failed - PDF not generated');
        return res.status(400).json({ 
          error: 'Failed to compile LaTeX to PDF',
          details: errorDetails,
          stdout: stdout.substring(0, 1000), // First 1000 chars of output
          stderr: stderr.substring(0, 1000)  // First 1000 chars of errors
        });
      }
      
      // Read the generated PDF
      const pdfBuffer = fs.readFileSync(pdfFile);
      console.log('[LATEX SERVER] PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      
      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      // Return the PDF
      res
        .set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="latex_preview.pdf"'
        })
        .send(pdfBuffer);
        
    } catch (execError) {
      console.error('[LATEX SERVER] Execution error caught:', execError);
      console.error('[LATEX SERVER] Error message:', execError.message);
      console.error('[LATEX SERVER] Error stack:', execError.stack);
      
      // Try to read log file even on error
      try {
        const logFile = path.join(tempDir, 'document.log');
        if (fs.existsSync(logFile)) {
          const logContent = fs.readFileSync(logFile, 'utf8');
          console.error('[LATEX SERVER] LaTeX log file (last 2000 chars):', logContent.substring(Math.max(0, logContent.length - 2000)));
        }
      } catch (logError) {
        console.error('[LATEX SERVER] Could not read log file:', logError);
      }
      
      // Clean up on error
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('[LATEX SERVER] Cleanup error:', cleanupError);
      }
      
      // Check if pdflatex is installed
      if (execError.message && (execError.message.includes('pdflatex') || execError.code === 'ENOENT')) {
        return res.status(500).json({ 
          error: 'LaTeX compiler (pdflatex) is not installed or not in PATH',
          details: 'Please install a LaTeX distribution (e.g., TeX Live, MiKTeX) and ensure pdflatex is in your system PATH',
          execError: execError.message
        });
      }
      
      // Re-throw with more context
      console.error('[LATEX SERVER] Re-throwing execution error');
      throw execError;
    }
    
  } catch (error) {
    console.error('[LATEX SERVER] ========== TOP LEVEL ERROR ==========');
    console.error('[LATEX SERVER] Error type:', error.constructor.name);
    console.error('[LATEX SERVER] Error message:', error.message);
    console.error('[LATEX SERVER] Error stack:', error.stack);
    if (error.code) {
      console.error('[LATEX SERVER] Error code:', error.code);
    }
    if (error.signal) {
      console.error('[LATEX SERVER] Error signal:', error.signal);
    }
    console.error('[LATEX SERVER] =====================================');
    
    res.status(500).json({ 
      error: 'Failed to convert LaTeX to PDF',
      details: error.message,
      code: error.code || undefined,
      signal: error.signal || undefined
    });
  }
});

// Add a new route for creating a Stripe Checkout Session
app.post('/create-checkout-session', async (req, res) => {
    const { priceId, formId } = req.body;
    // Get the domain dynamically from the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const YOUR_DOMAIN = `${protocol}://${host}`;

    if (!priceId || !formId) {
        return res.status(400).send({ error: 'Price ID and Form ID are required.' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/example.html?payment=success&formId=${formId}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${YOUR_DOMAIN}/example.html?payment=cancelled`,
        });

        res.send({ sessionId: session.id });
    } catch (e) {
        console.error("Stripe Error:", e);
        res.status(500).send({ error: e.message });
    }
});

// Add a new route for creating a Cart Checkout Session
app.post('/create-cart-checkout-session', async (req, res) => {
    console.log('Cart checkout session requested');
    console.log('Request body:', req.body);
    
    const { cartItems, totalAmount } = req.body;
    // Get the domain dynamically from the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const YOUR_DOMAIN = `${protocol}://${host}`;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        console.log('Error: No cart items provided');
        return res.status(400).send({ error: 'Cart items are required.' });
    }

    try {
        // Create line items from cart items
        const lineItems = cartItems.map(item => ({
            price: item.priceId, // Use the Stripe Price ID directly
            quantity: 1,
        }));

        const session = await stripe.checkout.sessions.create({
            line_items: lineItems,
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/Pages/cart.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${YOUR_DOMAIN}/Pages/cart.html?payment=cancelled`,
            metadata: {
                cartItems: JSON.stringify(cartItems.map(item => item.formId)),
                totalAmount: totalAmount ? totalAmount.toString() : '',
            },
        });

        console.log('Stripe session created successfully:', session.id);
        res.send({ sessionId: session.id });
    } catch (e) {
        console.error("Stripe Cart Error:", e);
        res.status(500).send({ error: e.message });
    }
});

// List all Stripe prices (for debugging)
app.get('/stripe-prices', async (req, res) => {
    try {
        console.log('Listing all Stripe prices...');
        const prices = await stripe.prices.list({ limit: 10, active: true });
        const priceList = prices.data.map(price => ({
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            nickname: price.nickname,
            active: price.active
        }));
        console.log(`Found ${priceList.length} prices`);
        res.json({ prices: priceList });
    } catch (e) {
        console.error('Error listing Stripe prices:', e.message);
        res.status(500).json({ error: 'Failed to list prices', details: e.message });
    }
});

// Fetch Stripe price info by Price ID
app.get('/stripe-price/:priceId', async (req, res) => {
    try {
        console.log(`Fetching Stripe price: ${req.params.priceId}`);
        const price = await stripe.prices.retrieve(req.params.priceId, { expand: ['product'] });
        console.log(`Price found: ${price.id}, amount: ${price.unit_amount}`);
        res.json({
            priceId: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            product: price.product && price.product.name ? price.product.name : price.product.id,
            nickname: price.nickname,
        });
    } catch (e) {
        console.error(`Stripe price error for ${req.params.priceId}:`, e.message);
        res.status(404).json({ 
            error: 'Price not found', 
            priceId: req.params.priceId,
            details: e.message 
        });
    }
});

// Endpoint to email a PDF to the user
app.post('/email-pdf', async (req, res) => {
    try {
        let { to, extraEmails, subject, text, filename } = req.body;
        if (!to && !extraEmails) {
            return res.status(400).json({ error: 'Missing recipient email(s)' });
        }
        if (!filename) {
            return res.status(400).json({ error: 'Missing required field: filename' });
        }
        // PDF should be sent as raw binary in req.files.pdf
        if (!req.files || !req.files.pdf) {
            return res.status(400).json({ error: 'Missing PDF file' });
        }
        const pdfBuffer = req.files.pdf.data;
        // Build recipients array
        let recipients = [];
        if (to) recipients.push(to);
        if (extraEmails) {
            if (typeof extraEmails === 'string') {
                // Accept comma-separated or single email
                if (extraEmails.includes(',')) {
                    recipients = recipients.concat(extraEmails.split(',').map(e => e.trim()).filter(Boolean));
                } else {
                    recipients.push(extraEmails.trim());
                }
            } else if (Array.isArray(extraEmails)) {
                recipients = recipients.concat(extraEmails.filter(Boolean));
            }
        }
        recipients = recipients.filter(Boolean);
        // Extract form name from filename
        let formName = filename.replace(/^Edited_/, '').replace(/\.pdf$/i, '').replace(/_/g, ' ');
        // Send to all recipients
        for (const email of recipients) {
            await sendPdfEmail(
                email,
                subject || `Your Completed ${formName} from FormWiz`,
                text || `Attached is your completed ${formName} PDF form from FormWiz.`,
                pdfBuffer,
                filename
            );
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Error sending PDF email:', e);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// ────────────────────────────────────────────────────────────
// Nodemailer setup (using Gmail SMTP for example)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // set in .env
        pass: process.env.EMAIL_PASS  // set in .env
    }
});

/**
 * Send an email with a PDF attachment
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} text - email body
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} filename - PDF file name
 */
async function sendPdfEmail(to, subject, text, pdfBuffer, filename) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text,
        attachments: [
            {
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]
    };
    await transporter.sendMail(mailOptions);
}

// ────────────────────────────────────────────────────────────
// Start server
// ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
