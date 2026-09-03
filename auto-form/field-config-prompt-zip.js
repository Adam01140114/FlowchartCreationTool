/**
 * Packages everything a chat session needs to produce field_config.json by hand.
 *
 * The copyable text prompt alone loses the page images, and without them a model
 * cannot see which checkboxes form a mutually exclusive group, so it maps them
 * as independent boxes. This bundles the rendered pages alongside the prompt so
 * a manual run has the same evidence an automatic one does.
 */

const JSZip = require('jszip');
const { buildFieldConfigPrompt } = require('./field-config-generator');
const { resolvePdfBytes, loadPdfPageImages } = require('./pdf-vision-context');

const PAGE_SCALE = 1.5;

function pad(n) {
  return String(n).padStart(2, '0');
}

function countFields(payload) {
  const text = (payload.textFields || []).length;
  const checkbox = (payload.checkboxFields || []).length;
  return { text, checkbox, total: text + checkbox };
}

function buildReadme({ counts, pageCount, hasPdf }) {
  const pageLine = pageCount
    ? `- \`pages/\` - ${pageCount} page image(s), one PNG per page of the form`
    : '- `pages/` - EMPTY. The page images could not be rendered (see the warning below).';

  const visionNote = pageCount
    ? [
      '## Why the images matter',
      '',
      'Field names alone do not say which checkboxes belong together. On this form',
      '`..._cb[0]`, `..._cb[1]` and `..._cb[2]` are usually "Not requested / Denied',
      'until the hearing / Granted" - one choice, not three independent boxes. Only',
      'the page images show that. Attach them, or the result will treat mutually',
      'exclusive options as separate checkboxes.',
    ].join('\n')
    : [
      '## Warning: no page images',
      '',
      'The page images could not be rendered, so this bundle is text only. A model',
      'working without them cannot tell which checkboxes are mutually exclusive',
      'groups, and will likely map them as independent boxes. Re-run the extraction',
      'step in the demo and download this bundle again if you want the images.',
    ].join('\n');

  return [
    '# field_config.json - manual run',
    '',
    `Form fields: ${counts.total} (${counts.text} text, ${counts.checkbox} checkbox)`,
    `Page images: ${pageCount}`,
    '',
    '## What is in here',
    '',
    '- `PROMPT.md` - the exact prompt the automatic run would send. Paste it in full.',
    pageLine,
    '- `form-data.json` - the field list and extracted text, on its own for reference',
    hasPdf ? '- `source.pdf` - the unlocked PDF these fields came from' : null,
    '',
    '## How to run it',
    '',
    '1. Start a new chat session.',
    '2. Attach **every file in `pages/`**. Upload them in order.',
    '3. Paste the whole contents of `PROMPT.md` as your message.',
    '4. The reply should be one JSON object and nothing else.',
    '5. Copy that JSON into the demo, under **Or paste JSON**, and click Import.',
    '',
    visionNote,
    '',
    '## If the import is rejected',
    '',
    'Some field ids on this form contain a backslash, for example',
    '`FillText11\\\\.yards`. A model will often write `\\\\.` instead of `\\\\\\\\.`, which is',
    'not valid JSON. The importer repairs that automatically, but if you see any',
    'other parse error, ask the chat session to resend the JSON unchanged and',
    'complete - a truncated reply is the usual cause.',
    '',
    '## Checking the result',
    '',
    'Before building the form, look over the checkbox groups. Anything that reads',
    'as "one of these three" on the page should not come back as three unrelated',
    'checkboxes. That is the most common thing to get wrong on a manual run.',
    '',
  ].filter((line) => line !== null).join('\n');
}

/**
 * @returns {Promise<{ buffer: Buffer, pageCount: number, fieldCount: number }>}
 */
async function buildFieldConfigPromptZip(payload = {}) {
  // Throws when there are no fields, the same as the automatic path.
  const prompt = buildFieldConfigPrompt(payload);
  const counts = countFields(payload);

  const pdfBytes = await resolvePdfBytes({
    pdfToken: payload.pdfToken || '',
    pdfBase64: payload.pdfBase64 || '',
  });

  // pdf.js detaches the buffer it renders from, leaving pdfBytes empty, so take
  // the copy destined for the bundle before rendering rather than after.
  const hasPdf = Boolean(pdfBytes && pdfBytes.length);
  const sourcePdf = hasPdf ? Buffer.from(pdfBytes) : null;

  let pages = [];
  if (hasPdf) {
    try {
      pages = await loadPdfPageImages(pdfBytes, { scale: PAGE_SCALE });
    } catch (error) {
      // A bundle without images still beats no bundle; the README says so.
      console.warn('[field-config-prompt-zip] Page render failed:', error.message);
    }
  } else {
    console.warn('[field-config-prompt-zip] No PDF on the server - building a text-only bundle');
  }

  const zip = new JSZip();
  zip.file('README.md', buildReadme({ counts, pageCount: pages.length, hasPdf }));
  zip.file('PROMPT.md', prompt);
  zip.file('form-data.json', JSON.stringify({
    extractedDocumentContent: payload.extractedDocumentContent || '',
    textFields: payload.textFields || [],
    checkboxFields: payload.checkboxFields || [],
    structuredFields: payload.structuredFields || [],
  }, null, 2));

  const pageFolder = zip.folder('pages');
  for (const page of pages) {
    pageFolder.file(`page-${pad(page.pageNumber)}.png`, page.base64, { base64: true });
  }

  if (sourcePdf) {
    zip.file('source.pdf', sourcePdf);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { buffer, pageCount: pages.length, fieldCount: counts.total };
}

// Builds a bundle only. Nothing here contacts an API, so it needs no approval
// and costs nothing.
function createHandleFieldConfigPromptZip() {
  return async function handleFieldConfigPromptZip(req, res) {
    try {
      const { buffer, pageCount, fieldCount } = await buildFieldConfigPromptZip(req.body || {});

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="field-config-prompt.zip"',
        'X-Page-Count': String(pageCount),
        'X-Field-Count': String(fieldCount),
      });
      return res.send(buffer);
    } catch (error) {
      console.error('[field-config-prompt-zip]', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to build the prompt bundle',
      });
    }
  };
}

module.exports = { buildFieldConfigPromptZip, createHandleFieldConfigPromptZip };
