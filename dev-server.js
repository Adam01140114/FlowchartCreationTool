/**
 * Local dev server for Flowchart Creation Tool + FormWiz preview.
 * Serves the whole repo on port 8080 and implements POST /edit_pdf so
 * Preview/Download PDF works (http-server alone returns 405 for POST).
 */
const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { preparePayloadHtml, sanitizePayloadFolderName } = require('./payload-html');
require('dotenv').config();
const { registerAutoFormRoutes } = require('./auto-form/routes');

const ROOT = __dirname;
const FORM_WIZ_DIR = path.join(ROOT, 'FormWiz GUI');
const PORT = process.env.PORT || 8080;
// Matches BODY_LIMIT in auto-form/routes.js; see the parser note below.
const BODY_LIMIT = process.env.BODY_LIMIT || '50mb';

const app = express();
// The auto-form endpoints post base64 PDFs and whole field dumps, well past
// body-parser's 100kb default. These global parsers are registered before the
// per-route limits in auto-form/routes.js, so they consume the body first and
// have to allow the same size or those per-route limits never apply.
app.use(bodyParser.json({ limit: BODY_LIMIT }));
app.use(bodyParser.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use(fileUpload());
app.use(cors());

// TEMP DIAGNOSTIC: log every request so we can see what actually reaches this
// process (method, path, origin, and the status we send back).
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const tag = res.statusCode === 404 ? ' <-- 404' : '';
    console.log(
      `[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} `
      + `(${Date.now() - started}ms) ua=${(req.headers['user-agent'] || '').slice(0, 28)}${tag}`
    );
  });
  next();
});

app.use((req, res, next) => {
  if (req.path === '/.env' || req.path.endsWith('.env')) {
    return res.status(404).end();
  }
  next();
});

function shouldCheck(v) {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  const s = String(v).trim().toLowerCase();
  return s === 'on' || s === 'true' || s === 'yes' || s === '1' || s === 'checked';
}

function mapRadioValue(field, value) {
  try {
    const options = field.getOptions();
    const valueStr = String(value).trim();
    if (options.includes(valueStr)) return valueStr;
    if (valueStr === 'on' || valueStr === 'true' || valueStr === '1') {
      const yesOption = options.find((opt) =>
        opt.toLowerCase().includes('yes') ||
        opt.toLowerCase().includes('true') ||
        opt.toLowerCase().includes('1')
      );
      if (yesOption) return yesOption;
      if (options.length > 0) return options[0];
    }
    if (valueStr === 'off' || valueStr === 'false' || valueStr === '0') {
      const noOption = options.find((opt) =>
        opt.toLowerCase().includes('no') ||
        opt.toLowerCase().includes('false') ||
        opt.toLowerCase().includes('0')
      );
      if (noOption) return noOption;
    }
    if (valueStr.includes(',')) {
      const parts = valueStr.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) return mapRadioValue(field, parts[0]);
    }
    const partialMatch = options.find((opt) =>
      opt.toLowerCase().includes(valueStr.toLowerCase()) ||
      valueStr.toLowerCase().includes(opt.toLowerCase())
    );
    return partialMatch || null;
  } catch (error) {
    return null;
  }
}

function findPdfFile(targetFile) {
  const targetLower = path.basename(targetFile).toLowerCase();
  const searchRoots = [
    FORM_WIZ_DIR,
    path.join(FORM_WIZ_DIR, 'public', 'Forms'),
    ROOT
  ];

  for (const rootDir of searchRoots) {
    if (!fs.existsSync(rootDir)) continue;

    const direct = path.join(rootDir, targetLower);
    if (fs.existsSync(direct) && fs.lstatSync(direct).isFile()) {
      return direct;
    }

    const stack = [rootDir];
    while (stack.length) {
      const current = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (e) {
        continue;
      }
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase() === targetLower) {
          return fullPath;
        }
      }
    }
  }

  return null;
}

app.post('/edit_pdf', async (req, res) => {
  try {
    let pdfBytes;
    let outputName = 'Edited_document.pdf';

    if (req.files && req.files.pdf) {
      pdfBytes = req.files.pdf.data;
      outputName = `Edited_${req.files.pdf.name}`;
    } else {
      const pdfName = req.query.pdf;
      if (!pdfName) {
        return res.status(400).send('No PDF provided (upload a file or pass ?pdf=filename).');
      }
      const normalizedBase = path.basename(pdfName).replace(/\.pdf$/i, '');
      const sanitized = normalizedBase + '.pdf';
      const pdfPath = findPdfFile(sanitized);
      if (!pdfPath) {
        return res.status(400).send(`Requested PDF does not exist on the server: ${sanitized}`);
      }
      pdfBytes = await fs.promises.readFile(pdfPath);
      outputName = `Edited_${path.basename(pdfPath)}`;
      console.log(`Using PDF: ${path.relative(ROOT, pdfPath)}`);
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

    form.getFields().forEach((field) => {
      const key = field.getName();
      const value = req.body[key];
      if (value === undefined) return;

      try {
        switch (field.constructor.name) {
          case 'PDFCheckBox':
            shouldCheck(value) ? field.check() : field.uncheck();
            break;
          case 'PDFRadioGroup': {
            const radioValue = mapRadioValue(field, value);
            if (radioValue) field.select(radioValue);
            break;
          }
          case 'PDFDropdown':
            field.select(String(value));
            break;
          case 'PDFTextField':
            field.setText(String(value));
            field.updateAppearances(helv);
            break;
          default:
            if (typeof field.setText === 'function') {
              field.setText(String(value));
              if (typeof field.updateAppearances === 'function') {
                field.updateAppearances(helv);
              }
            }
            break;
        }
      } catch (error) {
        console.warn(`Field ${key}:`, error.message);
      }
    });

    const edited = await pdfDoc.save();
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${outputName}"`
      })
      .send(Buffer.from(edited));
  } catch (error) {
    console.error('edit_pdf failed:', error);
    res.status(500).send('Failed to fill PDF: ' + error.message);
  }
});

app.post('/api/test-payload', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const folderName = sanitizePayloadFolderName(req.body && req.body.folderName);
    let html = preparePayloadHtml((req.body && req.body.html) || '');
    if (!html.trim()) {
      return res.status(400).send('Missing html for test payload.');
    }
    if (!/^<!DOCTYPE/i.test(html)) {
      html = '<!DOCTYPE html>\n' + html;
    }

    const zip = new JSZip();
    const folder = zip.folder(folderName);
    folder.file('index.html', html);

    const staticAssets = ['generate.css', 'generate2.css', 'logo.png'];
    staticAssets.forEach((asset) => {
      const assetPath = path.join(FORM_WIZ_DIR, asset);
      if (fs.existsSync(assetPath) && fs.lstatSync(assetPath).isFile()) {
        folder.file(asset, fs.readFileSync(assetPath));
      }
    });

    const pdfNames = Array.isArray(req.body.pdfs) && req.body.pdfs.length
      ? req.body.pdfs
      : ['W9.pdf'];
    pdfNames.forEach((pdfName) => {
      const normalized = path.basename(String(pdfName).trim());
      if (!normalized) return;
      const withExt = /\.pdf$/i.test(normalized) ? normalized : normalized + '.pdf';
      const pdfPath = findPdfFile(withExt);
      if (pdfPath) {
        folder.file(withExt, fs.readFileSync(pdfPath));
      }
    });

    folder.file(
      'README.txt',
      [
        'Test payload for FormWiz',
        '',
        '1. Unzip this folder into:',
        '   FlowchartCreationTool/FormWiz GUI/',
        '',
        '2. Start the dev server from the project root:',
        '   npm start',
        '',
        '3. Open in your browser:',
        `   http://127.0.0.1:8080/FormWiz%20GUI/${encodeURIComponent(folderName)}/index.html`,
        '',
        'PDF preview and download use POST /edit_pdf on the same dev server.',
        'Run npm start (dev-server.js), not plain http-server.'
      ].join('\n')
    );

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res
      .set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`
      })
      .send(buf);
  } catch (error) {
    console.error('test-payload failed:', error);
    res.status(500).send('Failed to build test payload: ' + error.message);
  }
});

// Auto Form Creator (ported from FormWiz) — mounts /Auto-Form-Creator + its API.
// Registered before the repo-wide static handler so its routes take precedence.
/**
 * Save a JSON artifact the browser built, so work like a merged packet does not
 * live only in localStorage. Dev-only: the name is reduced to a bare filename
 * under ROOT, so it cannot be steered outside the repo.
 */
app.post('/api/dev-save', (req, res) => {
  const name = path.basename(String((req.body && req.body.name) || ''));
  if (!/^[\w.-]+\.json$/.test(name)) {
    return res.status(400).json({ error: 'name must be a plain .json filename' });
  }
  const target = path.join(ROOT, name);
  try {
    fs.writeFileSync(target, JSON.stringify(req.body.data, null, 2));
    res.json({ saved: name, bytes: fs.statSync(target).size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const autoFormStatus = registerAutoFormRoutes(app);

app.use(express.static(ROOT));

app.get('/', (_req, res) => {
  res.redirect('/index.html');
});

app.listen(PORT, () => {
  console.log(`Flowchart dev server running at http://127.0.0.1:${PORT}`);
  console.log('PDF fill endpoint: POST /edit_pdf?pdf=W9.pdf');
  console.log(`Looking for PDFs in: ${FORM_WIZ_DIR}`);
  console.log(`Auto Form Creator: http://127.0.0.1:${PORT}/Auto-Form-Creator/demo.html`);
  // Either key enables AI generation - openai-fetch prefers Claude when both
  // are present, so only report a problem when neither is configured.
  if (autoFormStatus.anthropic) {
    console.log(`AI generation: Claude (${process.env.ANTHROPIC_MODEL || 'default model'})`);
  } else if (autoFormStatus.openAi) {
    console.log('AI generation: OpenAI');
  } else {
    console.log('  (AI generation disabled - add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env)');
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use (likely an old http-server).`);
    console.error('Stop it, then run npm start again. Or set PORT=8088 npm start');
    process.exit(1);
  }
  throw err;
});
