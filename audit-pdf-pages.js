/**
 * Render every page of a filled PDF to a PNG, so a fill can be looked at.
 *
 * Why this exists: a form field can hold exactly the right string and still
 * print nothing, or print it in the wrong place. The value lives in the field
 * dictionary and the ink comes from the appearance stream, and the two are only
 * in step if something built the appearance correctly. Checking the DOM passes
 * in that case. Checking the PDF field values passes too. The page image is the
 * only thing that does not, and it is how "Amount: $ $100" and a rule struck
 * through a description box were both found.
 *
 * Usage:
 *   node audit-pdf-pages.js <out-dir> [scale] <filled.pdf> [more.pdf ...]
 *
 *   node audit-pdf-pages.js ./audit 1.6 dv100-filled.pdf
 *
 * Scale 1.6 gives about 980x1268 per US-Letter page, which is legible without
 * being wasteful. Read the PNGs afterwards - do not stop at the console output.
 *
 * Runs in Node rather than the browser on purpose: a browser tab that is not
 * being composited freezes its timers, and a pdf.js render there never returns.
 */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const STANDARD_FONTS =
  path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep;

async function main() {
  const [outDir, maybeScale, ...rest] = process.argv.slice(2);
  if (!outDir || !rest.length && !maybeScale) {
    console.error('usage: node audit-pdf-pages.js <out-dir> [scale] <filled.pdf> [...]');
    process.exit(2);
  }
  // The scale is optional, so decide by whether it parses as a number.
  const scale = Number.isFinite(parseFloat(maybeScale)) && !maybeScale.endsWith('.pdf')
    ? parseFloat(maybeScale)
    : 1.6;
  const files = Number.isFinite(parseFloat(maybeScale)) && !maybeScale.endsWith('.pdf')
    ? rest
    : [maybeScale, ...rest].filter(Boolean);

  if (!files.length) {
    console.error('no PDF given');
    process.exit(2);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  for (const file of files) {
    const data = new Uint8Array(fs.readFileSync(file));
    // Without the bundled standard fonts, pdf.js cannot draw Helvetica and
    // every filled value renders blank - a false "the field is empty" report.
    const doc = await pdfjs.getDocument({
      data,
      isEvalSupported: false,
      standardFontDataUrl: STANDARD_FONTS,
    }).promise;

    const base = path.basename(file).replace(/\.pdf$/i, '');
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const out = path.join(outDir, `${base}-p${String(n).padStart(2, '0')}.png`);
      fs.writeFileSync(out, canvas.toBuffer('image/png'));
      console.log(out, `${canvas.width}x${canvas.height}`);
    }
    console.log(`${base}: ${doc.numPages} page(s)`);
  }
}

main().catch((e) => {
  console.error('FAILED:', (e && e.stack) || e);
  process.exit(1);
});
