#!/usr/bin/env node
/**
 * Look closely at one part of a filled page.
 *
 * A whole page rendered small enough to read at a glance is not big enough to
 * answer the questions that matter - whether a line of text sits on the form's
 * ruled line or through it, whether a box stopped cleanly at its edge or was
 * cut. Those are a few points of difference on paper and vanish at page scale.
 *
 * Coordinates are in PDF points from the top-left of the page, which is how
 * pipeline-capacity.js reports a box, so a field's rectangle can be pasted
 * straight in.
 *
 * Usage:
 *   node pipeline-crop.js pipeline-out/dv101-filled.pdf 2 --rect 40,690,560,760
 *   node pipeline-crop.js pipeline-out/dv101-filled.pdf 2 --field dv101_further_abuse_description
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const PDF = positional[0];
const PAGE = Number(positional[1] || 1);
const SCALE = Number(flag('scale', '4')) || 4;
const PAD = Number(flag('pad', '10')) || 10;
const OUT = flag('out', path.join('pipeline-out', 'crop.png'));
const FIELD = flag('field', '');

async function main() {
  if (!PDF || !fs.existsSync(PDF)) {
    console.error('usage: node pipeline-crop.js <filled.pdf> <page> [--rect x,y,w,h | --field name]');
    process.exit(1);
  }
  const canvasLib = require('@napi-rs/canvas');
  globalThis.Path2D = globalThis.Path2D || canvasLib.Path2D;
  globalThis.DOMMatrix = globalThis.DOMMatrix || canvasLib.DOMMatrix;
  globalThis.ImageData = globalThis.ImageData || canvasLib.ImageData;

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(PDF)),
    useSystemFonts: false, disableFontFace: true, annotationMode: 1, verbosity: 0,
    standardFontDataUrl: path.join(
      path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep,
  }).promise;

  const page = await doc.getPage(PAGE);
  const unscaled = page.getViewport({ scale: 1 });

  let rect = (flag('rect', '') || '').split(',').map(Number);
  if (FIELD) {
    // The widget's own rectangle, grown by a margin so the form's printed rule
    // and label are in the picture too - a box read without them says nothing.
    const hit = (await page.getAnnotations())
      .find((a) => a.subtype === 'Widget' && a.fieldName === FIELD);
    if (!hit) { console.error('no field "' + FIELD + '" on page ' + PAGE); process.exit(1); }
    const [x1, y1, x2, y2] = hit.rect;
    rect = [Math.min(x1, x2) - PAD, unscaled.height - Math.max(y1, y2) - PAD,
            Math.abs(x2 - x1) + PAD * 2, Math.abs(y2 - y1) + PAD * 2];
    console.log(FIELD + ' at ' + rect.map((n) => n.toFixed(1)).join(', ') + ' (pt, from top-left)');
  }
  if (rect.length !== 4 || rect.some((n) => !isFinite(n))) {
    console.error('give --rect x,y,w,h or --field <name>'); process.exit(1);
  }

  const viewport = page.getViewport({ scale: SCALE });
  const full = canvasLib.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const fctx = full.getContext('2d');
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, full.width, full.height);
  await page.render({ canvasContext: fctx, viewport, annotationMode: 1 }).promise;

  const [x, y, w, h] = rect.map((n) => n * SCALE);
  const out = canvasLib.createCanvas(Math.ceil(w), Math.ceil(h));
  out.getContext('2d').drawImage(full, -Math.round(x), -Math.round(y));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out.toBuffer('image/png'));
  console.log('wrote ' + OUT + '  (' + out.width + 'x' + out.height + ' px at ' + SCALE + 'x)');
}

main().catch((e) => { console.error(e); process.exit(1); });
