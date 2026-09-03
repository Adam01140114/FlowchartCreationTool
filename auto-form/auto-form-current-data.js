const fs = require('fs');
const path = require('path');

const CURRENT_DATA_DIR = path.join(__dirname, 'public', 'Auto-Form-Creator', 'Current Data');

function ensureCurrentDataDir() {
  fs.mkdirSync(CURRENT_DATA_DIR, { recursive: true });
}

function writeTextFile(filename, content) {
  if (content == null || content === '') return;
  fs.writeFileSync(path.join(CURRENT_DATA_DIR, filename), String(content), 'utf8');
}

function writeJsonFile(filename, data) {
  if (data == null) return;
  fs.writeFileSync(path.join(CURRENT_DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
}

function saveCurrentData(payload) {
  ensureCurrentDataDir();

  const savedAt = new Date().toISOString();
  const label = payload.label || 'update';
  const writtenFiles = [];

  if (payload.fieldConfig) {
    writeJsonFile('field_config.json', payload.fieldConfig);
    writtenFiles.push('field_config.json');
  }
  if (payload.formConfig) {
    writeJsonFile('form_config.json', payload.formConfig);
    writtenFiles.push('form_config.json');
  }
  if (payload.formHtmlAllAtOnce) {
    writeTextFile('all-at-once-generated-form.html', payload.formHtmlAllAtOnce);
    writtenFiles.push('all-at-once-generated-form.html');
    writeTextFile('generated-form.html', payload.formHtmlAllAtOnce);
    if (!writtenFiles.includes('generated-form.html')) writtenFiles.push('generated-form.html');
  }
  if (payload.formHtmlOneAtATime) {
    writeTextFile('one-at-a-time-generated-form.html', payload.formHtmlOneAtATime);
    writtenFiles.push('one-at-a-time-generated-form.html');
  }
  if (payload.formHtml && !payload.formHtmlAllAtOnce) {
    writeTextFile('generated-form.html', payload.formHtml);
    writtenFiles.push('generated-form.html');
  }
  if (payload.extractedDocumentContent) {
    writeTextFile('extracted-document-content.txt', payload.extractedDocumentContent);
    writtenFiles.push('extracted-document-content.txt');
  }
  if (Array.isArray(payload.textFields)) {
    writeTextFile(
      'text-fields.txt',
      payload.textFields.map((f) => f.marker || f.name || JSON.stringify(f)).join('\n')
    );
    writtenFiles.push('text-fields.txt');
  }
  if (Array.isArray(payload.checkboxFields)) {
    writeTextFile(
      'checkbox-fields.txt',
      payload.checkboxFields.map((f) => f.marker || f.name || JSON.stringify(f)).join('\n')
    );
    writtenFiles.push('checkbox-fields.txt');
  }
  if (Array.isArray(payload.structuredFields) && payload.structuredFields.length) {
    writeJsonFile('structured-fields.json', payload.structuredFields);
    writtenFiles.push('structured-fields.json');
  }

  const manifest = {
    savedAt,
    label,
    files: fs.readdirSync(CURRENT_DATA_DIR).filter((f) => f !== 'manifest.json'),
  };
  writeJsonFile('manifest.json', manifest);

  return { savedAt, label, dir: CURRENT_DATA_DIR, files: manifest.files, writtenFiles };
}

function createHandleSaveCurrentData() {
  return function handleSaveCurrentData(req, res) {
    try {
      const result = saveCurrentData(req.body || {});
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[auto-form/save-current-data] Error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to save current data' });
    }
  };
}

module.exports = {
  CURRENT_DATA_DIR,
  saveCurrentData,
  createHandleSaveCurrentData,
};
