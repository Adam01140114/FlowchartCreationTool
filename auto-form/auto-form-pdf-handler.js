const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { fillPdfForm } = require('./pdf-form-filler');

const PDF_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const pdfStore = new Map();

const PDF_STORE_DIR = path.join(__dirname, 'public', 'Auto-Form-Creator', 'Current Data', 'pdf-store');
const PDF_STORE_MANIFEST = path.join(PDF_STORE_DIR, 'manifest.json');
const CURRENT_DATA_DIR = path.join(__dirname, 'public', 'Auto-Form-Creator', 'Current Data');

function ensurePdfStoreDir() {
  fs.mkdirSync(PDF_STORE_DIR, { recursive: true });
}

function getPdfDiskPath(pdfToken) {
  return path.join(PDF_STORE_DIR, `${pdfToken}.pdf`);
}

function readPdfStoreManifest() {
  try {
    if (!fs.existsSync(PDF_STORE_MANIFEST)) return null;
    return JSON.parse(fs.readFileSync(PDF_STORE_MANIFEST, 'utf8'));
  } catch (_) {
    return null;
  }
}

function writePdfStoreManifest(pdfToken, name) {
  ensurePdfStoreDir();
  fs.writeFileSync(
    PDF_STORE_MANIFEST,
    JSON.stringify(
      {
        pdfToken,
        fileName: name || 'sanitized.pdf',
        savedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );
}

function persistPdfToDisk(pdfToken, bytes, name) {
  ensurePdfStoreDir();
  fs.writeFileSync(getPdfDiskPath(pdfToken), Buffer.from(bytes));
  writePdfStoreManifest(pdfToken, name);
}

function loadPdfFromDisk(pdfToken) {
  const diskPath = getPdfDiskPath(pdfToken);
  if (!fs.existsSync(diskPath)) return null;
  const bytes = fs.readFileSync(diskPath);
  return {
    bytes: Uint8Array.from(bytes),
    name: readPdfStoreManifest()?.fileName || 'sanitized.pdf',
    createdAt: fs.statSync(diskPath).mtimeMs,
  };
}

function registerPdfEntry(pdfToken, bytes, name) {
  const entry = {
    bytes: Uint8Array.from(bytes),
    name: name || 'sanitized.pdf',
    createdAt: Date.now(),
  };
  pdfStore.set(pdfToken, entry);
  persistPdfToDisk(pdfToken, entry.bytes, entry.name);
  return entry;
}

function findFallbackPdfCandidates() {
  const candidates = [
    path.join(CURRENT_DATA_DIR, '_audit_sanitized.pdf'),
    path.join(CURRENT_DATA_DIR, '_e2e_sanitized.pdf'),
    path.join(CURRENT_DATA_DIR, '_test_prepared.pdf'),
    path.join(CURRENT_DATA_DIR, 'sanitized.pdf'),
  ];
  return candidates.filter((filePath) => fs.existsSync(filePath));
}

function resolvePdfTokenFromFormConfig() {
  try {
    const formConfigPath = path.join(CURRENT_DATA_DIR, 'form_config.json');
    if (!fs.existsSync(formConfigPath)) return null;
    const formConfig = JSON.parse(fs.readFileSync(formConfigPath, 'utf8'));
    return formConfig?.pdfToken || null;
  } catch (_) {
    return null;
  }
}

function rehydratePdfStore() {
  ensurePdfStoreDir();
  let restored = 0;

  if (fs.existsSync(PDF_STORE_DIR)) {
    for (const file of fs.readdirSync(PDF_STORE_DIR)) {
      if (!file.endsWith('.pdf')) continue;
      const pdfToken = file.replace(/\.pdf$/, '');
      if (pdfStore.has(pdfToken)) continue;
      const diskEntry = loadPdfFromDisk(pdfToken);
      if (diskEntry) {
        pdfStore.set(pdfToken, diskEntry);
        restored += 1;
      }
    }
  }

  const manifestToken = readPdfStoreManifest()?.pdfToken;
  if (manifestToken && !pdfStore.has(manifestToken)) {
    const diskEntry = loadPdfFromDisk(manifestToken);
    if (diskEntry) {
      pdfStore.set(manifestToken, diskEntry);
      restored += 1;
    }
  }

  const formConfigToken = resolvePdfTokenFromFormConfig();
  if (formConfigToken && !pdfStore.has(formConfigToken)) {
    const diskEntry = loadPdfFromDisk(formConfigToken);
    if (diskEntry) {
      pdfStore.set(formConfigToken, diskEntry);
      restored += 1;
    } else {
      const fallbacks = findFallbackPdfCandidates();
      if (fallbacks.length) {
        const bytes = fs.readFileSync(fallbacks[0]);
        registerPdfEntry(formConfigToken, bytes, path.basename(fallbacks[0]));
        restored += 1;
        console.log(`[auto-form/pdf-store] Restored token ${formConfigToken} from ${fallbacks[0]}`);
      }
    }
  }

  if (restored > 0) {
    console.log(`[auto-form/pdf-store] Rehydrated ${restored} PDF(s) from disk`);
  }
}

function cleanupExpiredPdfs() {
  const now = Date.now();
  for (const [token, entry] of pdfStore) {
    if (now - entry.createdAt > PDF_TTL_MS) {
      pdfStore.delete(token);
    }
  }
}

async function handleStoreAutoFormPdf(req, res) {
  try {
    if (!req.files?.pdf) {
      return res.status(400).json({ success: false, error: 'PDF file is required' });
    }

    cleanupExpiredPdfs();
    const pdfToken = crypto.randomUUID();
    registerPdfEntry(pdfToken, req.files.pdf.data, req.files.pdf.name || 'sanitized.pdf');

    res.json({
      success: true,
      pdfToken,
      fileName: req.files.pdf.name || 'sanitized.pdf',
    });
  } catch (error) {
    console.error('[auto-form/store-pdf] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to store PDF' });
  }
}

async function handleFillAutoFormPdf(req, res) {
  try {
    const { pdfToken } = req.params;
    const entry = getPdfEntry(pdfToken);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'PDF not found or expired. Re-run Step 5 in the demo.',
      });
    }

    const filled = await fillPdfForm(entry.bytes, req.body || {});
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="filled_${entry.name}"`,
      })
      .send(Buffer.from(filled));
  } catch (error) {
    console.error('[auto-form/fill-pdf] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fill PDF' });
  }
}

const DEMO_HUB_FORMS_DIR = path.join(
  __dirname,
  'public',
  'Auto-Form-Creator',
  'Demo_form_hub',
  'forms'
);

function remapBodyToPdfFieldNames(body, fieldConfig) {
  const out = { ...(body || {}) };
  for (const field of fieldConfig?.fields || []) {
    if (!field?.id || !field?.newName) continue;
    if (body[field.newName] !== undefined && body[field.newName] !== null && body[field.newName] !== '') {
      out[field.id] = body[field.newName];
    }
    // Also map when the client already sent the PDF field id.
    if (body[field.id] !== undefined && body[field.id] !== null && body[field.id] !== '') {
      out[field.id] = body[field.id];
    }
  }
  return out;
}

async function handleDemoHubFillPdf(req, res) {
  try {
    const slug = String(req.params.slug || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Form slug is required' });
    }

    const formDir = path.join(DEMO_HUB_FORMS_DIR, slug);
    const pdfPath = path.join(formDir, 'source.pdf');
    const fieldConfigPath = path.join(formDir, 'field_config.json');
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ success: false, error: `No source.pdf for hub form "${slug}"` });
    }
    if (!fs.existsSync(fieldConfigPath)) {
      return res.status(404).json({ success: false, error: `No field_config.json for hub form "${slug}"` });
    }

    const fieldConfig = JSON.parse(fs.readFileSync(fieldConfigPath, 'utf8'));
    const pdfBytes = fs.readFileSync(pdfPath);
    const mappedBody = remapBodyToPdfFieldNames(req.body || {}, fieldConfig);
    const filled = await fillPdfForm(pdfBytes, mappedBody);

    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="filled_${slug}.pdf"`,
        'Cache-Control': 'no-store',
      })
      .send(Buffer.from(filled));
  } catch (error) {
    console.error('[demo-hub/fill-pdf] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fill hub PDF' });
  }
}

function getPdfEntry(pdfToken) {
  if (!pdfToken) return null;
  cleanupExpiredPdfs();

  const diskEntry = loadPdfFromDisk(pdfToken);
  if (diskEntry) {
    pdfStore.set(pdfToken, diskEntry);
    return diskEntry;
  }

  const cached = pdfStore.get(pdfToken);
  if (cached) return cached;

  const formConfigToken = resolvePdfTokenFromFormConfig();
  if (formConfigToken === pdfToken) {
    const fallbacks = findFallbackPdfCandidates();
    if (fallbacks.length) {
      const bytes = fs.readFileSync(fallbacks[0]);
      return registerPdfEntry(pdfToken, bytes, path.basename(fallbacks[0]));
    }
  }

  return null;
}

module.exports = {
  handleStoreAutoFormPdf,
  handleFillAutoFormPdf,
  handleDemoHubFillPdf,
  getPdfEntry,
  rehydratePdfStore,
  registerPdfEntry,
  PDF_STORE_DIR,
};
