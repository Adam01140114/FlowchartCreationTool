const fs = require('fs');
const path = require('path');
const { derivePublishDefaults, slugifyFormId, toFolderName } = require('./form-catalog-metadata');

const FORMS_ROOT = path.join(__dirname, 'public', 'Forms');
const CSS_SOURCE_DIR = path.join(FORMS_ROOT, 'CSS');
const LOGO_SOURCE = path.join(__dirname, 'public', 'logo.png');

const ASSET_FILES = ['generate.css', 'generate2.css', 'generate3.css'];

function preparePublishedFormHtml(html, { pdfFileName, formTitle, formId }) {
  let out = String(html || '');

  out = out.replace(/href="\/Forms\/CSS\/generate\.css"/g, 'href="generate.css"');
  out = out.replace(/href="\/Forms\/CSS\/generate2\.css"/g, 'href="generate2.css"');
  out = out.replace(/href="\/Forms\/CSS\/generate3\.css"/g, 'href="generate3.css"');
  out = out.replace(/src="\/Pages\/cart\.js"/g, 'src="../../Pages/cart.js"');

  const pdfGlobals = `<script>var pdfOutputFileName=${JSON.stringify(pdfFileName)};var pdfFileName=${JSON.stringify(formTitle || 'Form')};var pdfLogicPDFs=[];var pdfPreviewQuestions=[];</script>`;
  if (out.includes('<body>')) {
    out = out.replace('<body>', `<body>\n${pdfGlobals}`);
  } else {
    out = `${pdfGlobals}\n${out}`;
  }

  const productionSubmit = `window.__autoFormHandleSubmit = async function(event) {
    if (event) event.preventDefault();
    var pdfParam = (typeof pdfOutputFileName !== 'undefined' && pdfOutputFileName)
      ? pdfOutputFileName.replace(/\\.pdf$/i, '')
      : ${JSON.stringify(String(pdfFileName || '').replace(/\\.pdf$/i, ''))};
    if (!pdfParam) {
      alert('PDF file is not configured for this form.');
      return false;
    }
    var form = document.getElementById('customForm');
    var fd = new FormData();
    if (form) {
      form.querySelectorAll('input, textarea, select').forEach(function(el) {
        if (!el.name || el.disabled || el.type === 'file') return;
        if (el.type === 'checkbox') {
          if (el.checked) fd.append(el.name, 'on');
        } else if (el.type === 'radio') {
          if (el.checked) fd.append(el.name, el.value);
        } else {
          var value = el.value;
          if (el.type === 'date' && value) {
            var parts = value.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
              value = parts[1] + '/' + parts[2] + '/' + parts[0];
            }
          }
          if (value != null && String(value).trim() !== '') fd.append(el.name, value);
        }
      });
    }
    try {
      var res = await fetch('/edit_pdf?pdf=' + encodeURIComponent(pdfParam), {
        method: 'POST',
        body: fd,
        credentials: 'include'
      });
      if (!res.ok) {
        var errText = await res.text();
        throw new Error(errText || ('HTTP ' + res.status));
      }
      var blob = await res.blob();
      if (!blob.size) throw new Error('Received empty PDF');
      var previewSection = document.getElementById('pdf-preview-section');
      var previewFrame = document.getElementById('filled-pdf-preview');
      var previewUrl = URL.createObjectURL(blob);
      if (previewFrame) previewFrame.src = previewUrl;
      if (previewSection) {
        previewSection.hidden = false;
        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert(err.message || 'Failed to generate PDF');
    }
    return false;
  };`;

  if (/window\.__autoFormHandleSubmit\s*=\s*async function/.test(out)) {
    out = out.replace(
      /window\.__autoFormHandleSubmit\s*=\s*async function[\s\S]*?return false;\s*\};/,
      productionSubmit
    );
  } else {
    out = out.replace('</body>', `<script>${productionSubmit}</script>\n</body>`);
  }

  return out;
}

async function copyAssetFiles(targetDir) {
  for (const fileName of ASSET_FILES) {
    const src = path.join(CSS_SOURCE_DIR, fileName);
    const dest = path.join(targetDir, fileName);
    if (fs.existsSync(src)) {
      await fs.promises.copyFile(src, dest);
    }
  }
  if (fs.existsSync(LOGO_SOURCE)) {
    await fs.promises.copyFile(LOGO_SOURCE, path.join(targetDir, 'logo.png'));
  }
}

function sanitizeFolderName(name) {
  const cleaned = toFolderName(name);
  if (!cleaned) throw new Error('Invalid folder name');
  if (cleaned.includes('..') || cleaned.includes('/') || cleaned.includes('\\')) {
    throw new Error('Invalid folder name');
  }
  return cleaned;
}

function createHandlePublishAutoForm(db) {
  return async function handlePublishAutoForm(req, res) {
    try {
      if (!db) {
        return res.status(500).json({ success: false, error: 'Database not initialized' });
      }

      const formHtml = req.body?.formHtml;
      if (!formHtml || !String(formHtml).trim()) {
        return res.status(400).json({ success: false, error: 'formHtml is required' });
      }

      if (!req.files?.pdf) {
        return res.status(400).json({ success: false, error: 'Sanitized PDF file is required' });
      }

      let formConfig = {};
      let fieldConfig = null;
      try {
        formConfig = JSON.parse(req.body.formConfig || '{}');
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Invalid formConfig JSON' });
      }
      try {
        if (req.body.fieldConfig) {
          fieldConfig = JSON.parse(req.body.fieldConfig);
        }
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Invalid fieldConfig JSON' });
      }

      const defaults = derivePublishDefaults(formConfig, fieldConfig);
      const name = String(req.body.name || defaults.name).trim();
      const formId = slugifyFormId(req.body.formId || defaults.formId);
      const description = String(req.body.description || defaults.description).trim();
      const folderName = sanitizeFolderName(req.body.folderName || defaults.folderName);
      const htmlFileName = String(req.body.htmlFileName || defaults.htmlFileName).trim().toLowerCase();
      const pdfFileName = String(req.body.pdfFileName || defaults.pdfFileName).trim().toLowerCase();
      const defendant = String(req.body.defendant || defaults.defendant || 'N/A').trim();
      const status = String(req.body.status || defaults.status || 'Public').trim() === 'Archived'
        ? 'Archived'
        : 'Public';

      let counties = defaults.counties;
      if (req.body.counties) {
        try {
          const parsed = JSON.parse(req.body.counties);
          if (Array.isArray(parsed)) counties = parsed.filter(Boolean);
        } catch (e) {
          counties = String(req.body.counties)
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);
        }
      }
      if (!counties.length) counties = ['Monterey'];

      if (!name || !formId || !description) {
        return res.status(400).json({ success: false, error: 'Name, form ID, and description are required' });
      }
      if (!htmlFileName.endsWith('.html')) {
        return res.status(400).json({ success: false, error: 'HTML file name must end with .html' });
      }
      if (!pdfFileName.endsWith('.pdf')) {
        return res.status(400).json({ success: false, error: 'PDF file name must end with .pdf' });
      }

      const targetDir = path.join(FORMS_ROOT, folderName);
      if (fs.existsSync(targetDir)) {
        return res.status(409).json({
          success: false,
          error: `Form folder already exists: public/Forms/${folderName}`,
        });
      }

      const existingDoc = await db.collection('forms').doc(formId).get();
      if (existingDoc.exists) {
        return res.status(409).json({
          success: false,
          error: `A form with ID "${formId}" already exists in the database`,
        });
      }

      await fs.promises.mkdir(targetDir, { recursive: true });
      await copyAssetFiles(targetDir);

      const publishedHtml = preparePublishedFormHtml(formHtml, {
        pdfFileName,
        formTitle: name,
        formId,
      });
      await fs.promises.writeFile(path.join(targetDir, htmlFileName), publishedHtml, 'utf8');
      await fs.promises.writeFile(path.join(targetDir, pdfFileName), req.files.pdf.data);
      await fs.promises.writeFile(
        path.join(targetDir, 'form_config.json'),
        JSON.stringify(formConfig, null, 2),
        'utf8'
      );
      if (fieldConfig) {
        await fs.promises.writeFile(
          path.join(targetDir, 'field_config.json'),
          JSON.stringify(fieldConfig, null, 2),
          'utf8'
        );
      }

      const htmlBase = htmlFileName.replace(/\.html$/i, '');
      const url = `${folderName}/${htmlBase}.html?formId=${formId}`;
      const formData = {
        name,
        description,
        url,
        counties,
        defendant,
        status,
        source: 'auto-form-creator',
        publishedAt: new Date().toISOString(),
        folderName,
        htmlFileName,
        pdfFileName,
      };

      await db.collection('forms').doc(formId).set(formData);

      res.json({
        success: true,
        formId,
        folderPath: `public/Forms/${folderName}`,
        formUrl: `/Forms/${url}`,
        adminUrl: '/Admin/AdminConsole.html',
        files: {
          html: htmlFileName,
          pdf: pdfFileName,
          assets: [...ASSET_FILES, 'logo.png'],
        },
      });
    } catch (error) {
      console.error('[auto-form/publish] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to publish form',
      });
    }
  };
}

module.exports = {
  createHandlePublishAutoForm,
  preparePublishedFormHtml,
};
