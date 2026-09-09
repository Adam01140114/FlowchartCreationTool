#!/usr/bin/env node
/**
 * Name a PDF's fields from where they sit on the page, not from what they are
 * called.
 *
 * Judicial Council AcroForm names are laid down by the XFA authoring tool and
 * carry no meaning: the seven-day visitation chart on DV-105 page 5 is
 * `tf3, dropoff1, tf2, tf4, tf6, tf7` per day, in an order that is neither the
 * printed order nor a consistent one. Naming those by guessing which `tf` is
 * "Start" is how a form ends up printing the end time in the start column, and
 * nothing downstream would catch it.
 *
 * So read the geometry. Every widget has a rectangle on a page, and every page
 * has text with rectangles of its own. The label for a field is the text
 * nearest to it - to its left on the same line first, since that is how forms
 * are set, then above it.
 *
 * Output is a starting point for a field config, not a finished one: it gives
 * the evidence for a name. A person still decides what the field is called.
 *
 * Usage:
 *   node pipeline-field-labels.js decrypted.pdf            # every field
 *   node pipeline-field-labels.js decrypted.pdf --page 5   # one page
 *   node pipeline-field-labels.js decrypted.pdf --json     # machine readable
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const FILE = args.find((a) => !a.startsWith('--'));
const JSON_OUT = args.includes('--json');
const pageArg = args.indexOf('--page');
const ONLY_PAGE = pageArg >= 0 ? Number(args[pageArg + 1]) : null;

if (!FILE) {
  console.error('usage: node pipeline-field-labels.js <decrypted.pdf> [--page N] [--json]');
  process.exit(2);
}

/**
 * Distance from a field to a piece of text, or null when it cannot be a label.
 *
 * Which side to look at depends on the control. A text box is labelled from the
 * left - "Start: [____]" - but a checkbox is labelled from the *right*: the box
 * comes first and the word follows it. Looking left for a checkbox returns the
 * previous option's word, so every box appears to be labelled with its
 * neighbour and the whole row reads shifted by one. On the DV-101 police
 * question that makes Yes look like No.
 */
function labelDistance(field, text, isCheckbox) {
  const verticalOverlap =
    Math.min(field.top, text.top) - Math.max(field.bottom, text.bottom);
  const sameLine = verticalOverlap > -2;

  if (sameLine && isCheckbox && text.left >= field.right - 2) {
    return { d: text.left - field.right, where: 'right' };
  }
  if (sameLine && text.right <= field.left + 2) {
    return { d: field.left - text.right, where: 'left' };
  }
  // Otherwise directly above, within a column's width.
  const horizontalOverlap =
    Math.min(field.right, text.right) - Math.max(field.left, text.left);
  if (text.bottom >= field.top - 2 && horizontalOverlap > -4) {
    return { d: (text.bottom - field.top) + 200, where: 'above' };
  }
  return null;
}

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(FILE)),
    isEvalSupported: false,
    standardFontDataUrl:
      path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep,
  }).promise;

  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    if (ONLY_PAGE && n !== ONLY_PAGE) continue;
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });

    const texts = (await page.getTextContent()).items
      .filter((i) => i.str && i.str.trim())
      .map((i) => {
        const x = i.transform[4];
        const y = i.transform[5];
        return {
          str: i.str.trim(),
          left: x, right: x + (i.width || 0),
          bottom: y, top: y + (i.height || 8),
        };
      });

    const widgets = (await page.getAnnotations()).filter(
      (a) => a.subtype === 'Widget' && a.fieldName
    );

    widgets.forEach((w) => {
      const [x1, y1, x2, y2] = w.rect;
      const field = {
        left: Math.min(x1, x2), right: Math.max(x1, x2),
        bottom: Math.min(y1, y2), top: Math.max(y1, y2),
      };
      let best = null;
      texts.forEach((t) => {
        const hit = labelDistance(field, t, !!w.checkBox || !!w.radioButton);
        if (!hit) return;
        if (!best || hit.d < best.d) best = { ...hit, str: t.str };
      });
      out.push({
        page: n,
        name: w.fieldName,
        type: w.checkBox ? 'checkbox' : (w.radioButton ? 'radio' : 'text'),
        // Top-left first, so the listing reads down the page the way it prints.
        y: Math.round(viewport.height - field.top),
        x: Math.round(field.left),
        label: best ? best.str : '',
        from: best ? best.where : '',
      });
    });
  }

  out.sort((a, b) => (a.page - b.page) || (a.y - b.y) || (a.x - b.x));

  if (JSON_OUT) {
    console.log(JSON.stringify(out, null, 1));
    return;
  }
  let page = null;
  out.forEach((f) => {
    if (f.page !== page) {
      page = f.page;
      console.log('\n--------- page ' + page + ' ---------');
    }
    console.log(
      String(f.y).padStart(4) + ',' + String(f.x).padStart(4) + '  '
      + f.type.padEnd(8) + '  ' + JSON.stringify(f.label).padEnd(42)
      + '  ' + f.name.replace(/^[A-Z0-9-]+\[0\]\./, '')
    );
  });
}

main().catch((e) => { console.error('FAILED:', (e && e.stack) || e); process.exit(1); });
