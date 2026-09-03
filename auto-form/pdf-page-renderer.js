let canvasModulePromise = null;
let pdfjsLibPromise = null;

const path = require('path');
const { pathToFileURL } = require('url');

function toUint8Array(bytes) {
  if (!bytes?.length) return bytes;
  if (Buffer.isBuffer(bytes)) return Uint8Array.from(bytes);
  if (bytes instanceof Uint8Array) return bytes;
  return new Uint8Array(bytes);
}

function installCanvasGlobals(canvasModule) {
  const { Path2D, DOMMatrix, ImageData } = canvasModule;
  // pdfjs-dist polyfills these via process.getBuiltinModule (Node 20.16+). On Node 18
  // that API is missing, so rendering fails with "Path2D is not defined" unless we set them.
  if (!globalThis.Path2D && Path2D) globalThis.Path2D = Path2D;
  if (!globalThis.DOMMatrix && DOMMatrix) globalThis.DOMMatrix = DOMMatrix;
  if (!globalThis.ImageData && ImageData) globalThis.ImageData = ImageData;
}

function loadCanvasModule() {
  if (!canvasModulePromise) {
    canvasModulePromise = import('@napi-rs/canvas').catch((error) => {
      canvasModulePromise = null;
      throw error;
    });
  }
  return canvasModulePromise;
}

function configurePdfJsWorker(pdfjsLib) {
  const workerPath = path.join(
    __dirname,
    'node_modules',
    'pdfjs-dist',
    'legacy',
    'build',
    'pdf.worker.min.mjs'
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  return pdfjsLib;
}

async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const canvasModule = await loadCanvasModule();
      installCanvasGlobals(canvasModule);
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      return configurePdfJsWorker(pdfjsLib);
    })().catch((error) => {
      pdfjsLibPromise = null;
      throw error;
    });
  }
  return pdfjsLibPromise;
}

/**
 * Render PDF bytes to PNG page images (base64) for vision-capable models.
 * Returns [] if rendering libraries are unavailable.
 */
async function renderPdfPagesToBase64(pdfBytes, options = {}) {
  const maxPages = options.maxPages ?? null;
  const scale = options.scale ?? 1.25;

  if (!pdfBytes || !pdfBytes.length) return [];

  let createCanvas;
  try {
    ({ createCanvas } = await loadCanvasModule());
  } catch (error) {
    console.warn('[pdf-page-renderer] Canvas module unavailable:', error.message);
    return [];
  }

  let pdfjsLib;
  try {
    pdfjsLib = await loadPdfJs();
  } catch (error) {
    console.warn('[pdf-page-renderer] pdfjs-dist unavailable:', error.message);
    return [];
  }

  const canvasFactory = {
    create(width, height) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(canvasAndContext, width, height) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    },
  };

  const data = toUint8Array(pdfBytes);
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  const totalPages = pdf.numPages;
  const pageLimit = maxPages == null || maxPages <= 0
    ? totalPages
    : Math.min(totalPages, maxPages);
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport, canvasFactory }).promise;
    pages.push({
      pageNumber,
      mimeType: 'image/png',
      base64: canvas.toBuffer('image/png').toString('base64'),
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
    });
  }

  return pages;
}

module.exports = {
  renderPdfPagesToBase64,
};
