#!/usr/bin/env node
/**
 * How much text each PDF box can actually hold.
 *
 * Every text field on these forms declares a fixed font size - 10pt or 11pt,
 * not one is auto-sizing - so a value wider than its box is drawn and then
 * clipped. The answer is on the page and unreadable, and nothing upstream knows
 * it happened: the DOM has the whole string, the payload has the whole string,
 * and only the ink is short.
 *
 * So the box is measured here and the interview is told, which is the only
 * place a limit can do any good - stopping someone at the point of typing
 * beats truncating them silently afterwards.
 *
 * A character count is an approximation and worth saying so plainly. These are
 * proportional fonts: at 11pt Helvetica a "W" is 10.38pt and an "i" is 2.44pt,
 * four times narrower, so no single number is right for every string. The
 * reference below is measured from a corpus of the things people actually write
 * on these forms - names, streets, cities, dates, short sentences - and rounded
 * against the filer, so ordinary answers fit with a little room and an answer
 * in block capitals is the case that can still run long.
 *
 * Where a field has continuation lines beneath it, its capacity is the whole
 * chain, because the filler spills onto them.
 *
 * Usage:
 *   node pipeline-capacity.js [dv100 dv101 ...] [--out dv-packet-capacity.json]
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const OUT = flag('out', 'dv-packet-capacity.json');
const PDF_DIR = flag('pdfs', 'FormWiz GUI');
const FORMS = args.filter((a) => !a.startsWith('--') && a !== OUT && a !== PDF_DIR);

/**
 * What a character costs, on average, in the words these forms collect.
 *
 * Measured rather than guessed, and deliberately not the average of English
 * prose: form answers carry more capitals and digits than a paragraph does, and
 * a reference that is too narrow spends its error in the one direction that
 * clips text.
 */
const CORPUS = [
  'Maria Elena Rodriguez-Vasquez', 'Christopher Thompson', 'Jonathan Okonkwo',
  '1847 North Willowbrook Avenue', '22B Sycamore Court, Apartment 14',
  'Los Angeles', 'San Bernardino', 'Sacramento', '90210', '(555) 555-5555',
  '06-15-2024', 'Superior Court of California, County of Los Angeles',
  'He came to my work and would not leave until security asked him to go.',
  'She has been the only one caring for the children since March.',
  'Brother, sister, sibling, stepsibling, or sibling in-law',
];

async function referenceCharWidth(font, size) {
  const text = CORPUS.join(' ');
  return font.widthOfTextAtSize(text, size) / text.length;
}

/** The size a field declares, or null when it leaves it to the layout. */
function declaredSize(field) {
  let da;
  try { da = field.acroField.getDefaultAppearance(); } catch (e) { return null; }
  const m = String(da || '').match(/([\d.]+)\s+Tf/);
  const size = m ? parseFloat(m[1]) : 0;
  return size > 0 ? size : null;
}

/**
 * The lines beneath a box that carry the rest of a long answer.
 *
 * Read from the compiler rather than found by geometry. The filler finds them
 * by geometry and can afford to, because it also checks the next line is empty
 * and unsubmitted - which throws out the near-misses. With no such check, the
 * same shape rule chained an age box to whatever sat under it and awarded it a
 * hundred characters.
 *
 * The compiler already writes down which lines it dropped as an answer's
 * overflow, and that is a declaration rather than a resemblance. A capacity is
 * a promise to the interview, so it should be built on what the interview says.
 */
function declaredContinuations(base) {
  const chains = {};
  try {
    const chart = JSON.parse(fs.readFileSync(base + '-flowchart.json', 'utf8'));
    (chart.continuationLines || []).forEach((c) => {
      if (c && c.keep) chains[c.keep] = (c.drop || []).slice();
    });
  } catch (e) { /* no flowchart beside the packet */ }
  return chains;
}

async function main() {
  const { PDFDocument, StandardFonts } = require('pdf-lib');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const bases = FORMS.length ? FORMS : fs.readdirSync(PDF_DIR)
    .filter((f) => /^dv\d+\.pdf$/i.test(f)).map((f) => f.replace(/\.pdf$/i, ''));

  const metrics = await PDFDocument.create();
  const helv = await metrics.embedFont(StandardFonts.Helvetica);

  const capacity = {};
  const report = [];

  for (const base of bases) {
    const file = path.join(PDF_DIR, base + '.pdf');
    if (!fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);

    // Geometry from pdfjs, because it knows which page a widget is on.
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes), isEvalSupported: false,
      standardFontDataUrl: path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep,
    }).promise;

    const boxes = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      (await page.getAnnotations())
        .filter((a) => a.subtype === 'Widget' && a.fieldName
          && !a.checkBox && !a.radioButton && !a.pushButton)
        .forEach((a) => {
          const [x1, y1, x2, y2] = a.rect;
          boxes.push({
            name: a.fieldName, page: n, multiline: !!a.multiLine,
            left: Math.min(x1, x2), right: Math.max(x1, x2),
            bottom: Math.min(y1, y2), top: Math.max(y1, y2),
            width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
          });
        });
    }

    // The declared size lives in the AcroForm, which pdf-lib reads properly.
    const chains = declaredContinuations(base);
    const byName = {};
    boxes.forEach((b) => { (byName[b.name] = byName[b.name] || []).push(b); });

    const sizes = {};
    const lib = await PDFDocument.load(bytes);
    lib.getForm().getFields().forEach((f) => {
      if (f.constructor.name !== 'PDFTextField') return;
      sizes[f.getName()] = declaredSize(f);
    });

    // pdf-lib insets by a point each side and the border sits inside that.
    const PAD = 4;
    const holds = (box, size, perChar) => {
      const usable = box.width - PAD;
      if (usable <= 0) return 0;
      const perLine = Math.max(0, Math.floor(usable / perChar));
      if (!box.multiline) return perLine;
      const lineHeight = helv.heightAtSize(size) * 1.2;
      const lines = Math.max(1, Math.floor((box.height - 2) / lineHeight));
      return perLine * lines;
    };

    for (const box of boxes) {
      const size = sizes[box.name] || 11;
      const perChar = await referenceCharWidth(helv, size);
      const chain = (chains[box.name] || [])
        .map((n) => (byName[n] || [])[0]).filter(Boolean);
      let chars = holds(box, size, perChar);
      // Every join costs a word. Capacity is counted in characters and spent in
      // words: a word will not split across a line, so each line but the last
      // ends early by up to most of a word. Summing the lines exactly is what
      // pushed the [end] marker off the second ruled line of DV-100 item 16b.
      const WORD = 9;
      chain.forEach((c) => { chars += Math.max(0, holds(c, size, perChar) - WORD); });
      if (chain.length) chars = Math.max(0, chars - WORD);
      if (!chars) continue;

      // A field printed more than once must fit in the smallest of its boxes.
      if (capacity[box.name] === undefined || chars < capacity[box.name]) {
        capacity[box.name] = chars;
      }
      if (chain.length) {
        report.push('  ' + box.name + ': ' + chars + ' chars over '
          + (chain.length + 1) + ' ruled lines');
      }
    }
    console.log(base + ': ' + boxes.length + ' text box(es) measured');
  }

  const names = Object.keys(capacity).sort();
  fs.writeFileSync(OUT, JSON.stringify({
    measuredAt: new Date().toISOString(),
    reference: 'Helvetica, average character width over a corpus of form answers',
    fields: capacity,
  }, null, 1));

  report.slice(0, 6).forEach((line) => console.log(line));
  const values = names.map((n) => capacity[n]);
  console.log('\n' + names.length + ' field(s) measured into ' + OUT);
  console.log('  smallest ' + Math.min(...values) + ' chars, largest '
    + Math.max(...values) + ', median '
    + values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]);
}

main().catch((e) => { console.error(e); process.exit(1); });
