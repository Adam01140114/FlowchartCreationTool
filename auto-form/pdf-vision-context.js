/**
 * Shared helpers: resolve PDF bytes and build OpenAI vision content (one image per page).
 */

const { getPdfEntry } = require('./auto-form-pdf-handler');
const { renderPdfPagesToBase64 } = require('./pdf-page-renderer');

function toUint8Array(bytes) {
  if (!bytes?.length) return bytes;
  if (Buffer.isBuffer(bytes)) return Uint8Array.from(bytes);
  if (bytes instanceof Uint8Array) return bytes;
  return new Uint8Array(bytes);
}

async function resolvePdfBytes({ pdfToken = '', pdfBase64 = '' } = {}) {
  if (pdfToken) {
    const entry = getPdfEntry(pdfToken);
    if (entry?.bytes) return toUint8Array(entry.bytes);
  }
  if (pdfBase64) {
    return toUint8Array(Buffer.from(pdfBase64, 'base64'));
  }
  return null;
}

async function loadPdfPageImages(pdfBytes, options = {}) {
  if (!pdfBytes?.length) return [];

  const scale = options.scale ?? 1.25;
  const maxPages = options.maxPages ?? null;

  return renderPdfPagesToBase64(pdfBytes, { maxPages, scale });
}

function buildOpenAiImageContent(pages, options = {}) {
  const detail = options.detail ?? 'low';

  return (pages || []).map((page) => ({
    type: 'image_url',
    image_url: {
      url: `data:${page.mimeType};base64,${page.base64}`,
      detail,
    },
  }));
}

function buildPdfVisionUserContent(text, pages, options = {}) {
  const parts = [{ type: 'text', text: String(text || '') }];

  if (!pages?.length) return parts;

  parts.push({
    type: 'text',
    text: `The form PDF is attached below as ${pages.length} page image(s) in order (page 1 first). Use these images as the primary source for field labels, section groupings, and layout context.`,
  });

  for (const page of pages) {
    parts.push({ type: 'text', text: `--- PAGE ${page.pageNumber} ---` });
    parts.push(...buildOpenAiImageContent([page], options));
  }

  return parts;
}

/**
 * Load all PDF page images for OpenAI vision calls.
 * @param {{ pdfToken?: string, pdfBase64?: string }} payload
 * @param {{ required?: boolean, logPrefix?: string, scale?: number, maxPages?: number|null }} options
 */
async function resolvePdfPageImages(payload = {}, options = {}) {
  const {
    required = false,
    logPrefix = '[pdf-vision]',
    scale = 1.25,
    maxPages = null,
  } = options;

  const pdfBytes = await resolvePdfBytes({
    pdfToken: payload.pdfToken || '',
    pdfBase64: payload.pdfBase64 || '',
  });

  if (!pdfBytes?.length) {
    const message = 'PDF not available on server. Re-run Step 3 in the demo to store the PDF, then try again.';
    if (required) throw new Error(message);
    console.warn(`${logPrefix} No PDF available for vision`);
    return [];
  }

  const pages = await loadPdfPageImages(pdfBytes, { scale, maxPages });
  if (!pages.length) {
    const message = 'Failed to render PDF page images. Restart the server and re-run Step 3.';
    if (required) throw new Error(message);
    console.warn(`${logPrefix} PDF page render returned 0 pages`);
    return [];
  }

  console.log(`${logPrefix} Attaching ${pages.length} PDF page image(s)`);
  return pages;
}

module.exports = {
  resolvePdfBytes,
  loadPdfPageImages,
  buildOpenAiImageContent,
  buildPdfVisionUserContent,
  resolvePdfPageImages,
};
