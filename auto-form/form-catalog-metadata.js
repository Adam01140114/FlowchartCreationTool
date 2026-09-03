/**
 * Catalog metadata helpers for form_config.json and Step 9 publish defaults.
 */

function slugifyFormId(value) {
  return String(value || 'form')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48) || 'form';
}

function toFolderName(name) {
  return String(name || 'New-Form')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function toHtmlBaseName(folderName, formId) {
  const fromFolder = String(folderName || '').trim().toLowerCase();
  if (fromFolder) return fromFolder;
  return String(formId || 'form')
    .replace(/([a-z])(\d)/g, '$1-$2')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function inferDefendantFromFieldConfig(fieldConfig) {
  const fields = fieldConfig?.fields || [];
  const haystack = fields
    .map((f) => `${f.newName || ''} ${f.label || ''}`.toLowerCase())
    .join(' ');
  if (/\b(defendant|respondent|against whom|party served)\b/.test(haystack)) {
    return 'Yes';
  }
  return 'N/A';
}

function buildDefaultDescription(formTitle, fieldConfig) {
  const title = formTitle || fieldConfig?.formTitle || 'this form';
  return `Complete the ${title} online with your saved FormStar profile.`;
}

function ensureFormCatalogMetadata(formConfig, fieldConfig) {
  if (!formConfig || typeof formConfig !== 'object') return formConfig;

  const title = formConfig.formTitle || fieldConfig?.formTitle || 'Generated Form';

  if (!formConfig.formName) {
    formConfig.formName = title;
  }
  if (!formConfig.formDescription) {
    formConfig.formDescription = buildDefaultDescription(title, fieldConfig);
  }
  if (!formConfig.formId) {
    formConfig.formId = slugifyFormId(formConfig.formName || title);
  }
  if (!formConfig.formFolderName) {
    formConfig.formFolderName = toFolderName(formConfig.formName || title);
  }
  if (!formConfig.defendant) {
    formConfig.defendant = inferDefendantFromFieldConfig(fieldConfig);
  }

  return formConfig;
}

function derivePublishDefaults(formConfig, fieldConfig) {
  const enriched = ensureFormCatalogMetadata(
    { ...(formConfig || {}) },
    fieldConfig || null
  );

  const name = enriched.formName || enriched.formTitle || 'New Form';
  const formId = enriched.formId;
  const folderName = enriched.formFolderName;
  const htmlBase = toHtmlBaseName(folderName, formId);
  const htmlFileName = `${htmlBase}.html`;
  const urlBase = `${folderName}/${htmlBase}`;
  const pdfFileName = `${formId}.pdf`;

  return {
    name,
    formId,
    description: enriched.formDescription || buildDefaultDescription(name, fieldConfig),
    folderName,
    htmlFileName,
    htmlBase,
    urlBase,
    pdfFileName,
    defendant: enriched.defendant || 'N/A',
    counties: ['Monterey'],
    status: 'Public',
  };
}

module.exports = {
  slugifyFormId,
  toFolderName,
  toHtmlBaseName,
  inferDefendantFromFieldConfig,
  ensureFormCatalogMetadata,
  derivePublishDefaults,
};
