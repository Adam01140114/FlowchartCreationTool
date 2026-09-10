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
const ruledLines = require('./ruled-lines');
const { packetForms } = require('./packet-forms');
const { layoutMultilineText, TextAlignment } = require('pdf-lib');

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

/**
 * The text a capacity is a promise about, and the text a maximum-path fill
 * writes. They have to be the same string.
 *
 * A capacity says how much of *some* text fits, because these are
 * proportional fonts and no count is right for every string. Measuring
 * against one sample and filling with another gives up the one guarantee the
 * number can offer: DV-100 item 14 was measured at 888 characters of this
 * corpus and filled with 887 characters that began with a different
 * sentence, which shifted every line break after it and needed a tenth line
 * in a box that draws nine.
 *
 * Kept in step by hand with `filler` in fillToLength(), FormWiz GUI/generate.js.
 * That copy lives inside the emitted runtime, which cannot require anything.
 */
const FILLER = ' Maria Elena Rodriguez-Vasquez 1847 North Willowbrook Avenue'
  + ' Los Angeles 90210 06-15-2024 He came to my work and would not leave'
  + ' until security asked him to go. She has been the only one caring for'
  + ' the children since March.';
// Long enough to overflow the tallest box in the packet several times over.
const SAMPLE = FILLER.repeat(60).replace(/^ +/, '');

/**
 * How many characters of representative text fit on a given run of lines.
 *
 * Measured by laying the words out the way a PDF viewer will, rather than by
 * dividing the width by an average character. The average is what a character
 * costs; it is not what a line holds, because a word does not split across a
 * line break and every line therefore ends early by part of a word. Over the
 * four lines of DV-101 item 5 that was the difference between the measured
 * 400 characters and the 350-odd that actually printed - so the box was
 * filled to its measured capacity and the last words were clipped off the
 * page, which is the exact failure the measurement exists to prevent.
 *
 * The text is the corpus, repeated: these are proportional fonts, so no count
 * is right for every string, and the honest thing is to say which strings it
 * is right for.
 */
function charsThatFit(font, size, widths) {
  // A box drawn as one block is measured by the very function that draws it.
  //
  // Wrapping it here independently was close but not equal - pdf-lib fitted
  // about 94 characters to a line of DV-100 item 14 where this fitted 98, so
  // the box was measured at nine lines' worth of text, laid out into ten, and
  // the tenth was drawn below the last rule where nothing is shown. Close is
  // no use: the whole point of the number is that the text stops inside the
  // box, and the only wrap that can promise that is the one that happens.
  const uniform = widths.length > 1 && widths.every((w) => w === widths[0]);
  if (uniform) return charsThatLayOut(font, size, widths[0], widths.length);
  const words = SAMPLE.split(' ');
  let used = 0;
  let w = 0;
  for (const width of widths) {
    let line = '';
    while (w < words.length) {
      const next = line ? line + ' ' + words[w] : words[w];
      if (font.widthOfTextAtSize(next, size) > width) break;
      line = next;
      w++;
    }
    if (!line) {
      // A line too narrow for a whole word still holds characters, and a box
      // that holds no whole word is the one that most needs a limit: DV-110's
      // "State" box fits four characters, was measured at zero, was therefore
      // left uncapped, and printed "Wyoming" as "Wyor" with nothing to say so.
      //
      // A word broken across a line break would be wrong, so this ends the run
      // - nothing after it can be reached anyway.
      const rest = words[w] || '';
      let take = 0;
      while (take < rest.length
        && font.widthOfTextAtSize(rest.slice(0, take + 1), size) <= width) take++;
      used += take;
      return used;   // no separator follows: the word simply stops
    }
    used += line.length + 1;   // the space or break that follows it
  }
  return Math.max(0, used - 1);
}

/**
 * The longest run of the sample that pdf-lib lays out within `lines` lines.
 *
 * Found by bisection rather than by reimplementing the layout, because the
 * layout is the thing being predicted and any second implementation of it is
 * a second chance to be slightly wrong.
 */
/**
 * The string a maximum-path fill of length `n` actually writes.
 *
 * Mirrors fillToLength() in FormWiz GUI/generate.js, which cannot be shared:
 * it lives inside the runtime that file emits as one template literal, and
 * that runtime requires nothing. Keep the two in step.
 *
 * The marker is why this is needed rather than a plain slice. A fill ends in
 * [end], which replaces the last five characters of the run - so the closing
 * word is not the word the corpus has there, it is a partial word with a
 * marker welded on, and an unbreakable token five characters longer than the
 * one measured. That was worth a whole extra line in six boxes.
 */
function fillOfLength(length, mark) {
  if (length < mark.length + 4) return SAMPLE.slice(0, length);
  const room = length - mark.length;
  let out = FILLER.replace(/^ +/, '');
  while (out.length < room) out += FILLER;
  out = out.slice(0, room);
  if (out.charAt(out.length - 1) === ' ') out = out.slice(0, -1) + 'x';
  return out + mark;
}

function charsThatLayOut(font, size, width, lines) {
  // Both markers, because neither is the safe one. They are different lengths,
  // so each leaves the run ending on a different character, and the last
  // partial word breaks differently: at 877 characters DV-100 item 14 closed
  // with [cont] in nine lines and with [end] in ten. A capacity has to hold
  // whichever marker the fill happens to use.
  const laysOut = (text) => layoutMultilineText(text, {
    alignment: TextAlignment.Left,
    fontSize: size,
    font,
    bounds: { x: 0, y: 0, width, height: 1e6 },
  }).lines.length;
  const fits = (n) => {
    if (n <= 0) return true;
    try {
      return laysOut(fillOfLength(n, '[cont]')) <= lines
        && laysOut(fillOfLength(n, '[end]')) <= lines;
    } catch (err) {
      // A layout that cannot be computed is a length that does not fit. A
      // missing binding is a bug, and used to look exactly the same:
      // layoutMultilineText was destructured inside main(), so every call here
      // threw a ReferenceError, every length "did not fit", and all 33
      // multi-line boxes quietly lost their capacity.
      if (err instanceof ReferenceError || err instanceof TypeError) throw err;
      return false;
    }
  };
  let low = 0;
  let high = Math.min(SAMPLE.length, Math.ceil(width / 2) * lines + 32);
  if (fits(high)) return high;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) low = mid; else high = mid;
  }
  return low;
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
  const { PDFDocument, StandardFonts, layoutMultilineText, TextAlignment } = require('pdf-lib');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const bases = FORMS.length ? FORMS : packetForms();

  const metrics = await PDFDocument.create();
  const helv = await metrics.embedFont(StandardFonts.Helvetica);

  const capacity = {};
  // Boxes whose text runs over more than one line. Which line a word lands on
  // depends on every word before it, so a fill for one of these is only within
  // its capacity if it is the text the capacity was measured from - see the
  // note on FILLER above, and padToCapacity in FormWiz GUI/generate.js.
  const wraps = {};
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
    // The rules the form printed, which is what the fill lays text on.
    const rules = await ruledLines.harvest(bytes, file);

    /**
     * The width of every line a box offers, top to bottom.
     *
     * The count comes from the form's own rules wherever they can be read,
     * because that is the count dev-server draws on. Dividing the height by
     * the font's line height instead gave DV-101 item 4c nineteen lines
     * against seventeen rules, so the box was measured two lines larger than
     * it prints and the last of the answer - the [end] marker included - was
     * laid out below the bottom rule and never drawn.
     */
    const lineWidths = (box, size) => {
      const usable = box.width - PAD;
      if (usable <= 0) return [];
      if (!box.multiline) return [usable];
      const printed = ruledLines.linesInBox(rules[box.page - 1], {
        x: box.left, y: box.bottom, width: box.width, height: box.height,
      });
      const lineHeight = helv.heightAtSize(size) * 1.2;
      const lines = printed.length >= 2
        ? printed.length
        : Math.max(1, Math.floor((box.height - 2) / lineHeight));
      return new Array(lines).fill(usable);
    };

    for (const box of boxes) {
      const size = sizes[box.name] || 11;
      const chain = (chains[box.name] || [])
        .map((n) => (byName[n] || [])[0]).filter(Boolean);
      // The box and the lines it spills onto are one run of lines, so they
      // are wrapped as one - which costs a part-word at every line break,
      // the box's own and the chain's alike, with nothing to subtract by
      // hand afterwards.
      let widths = lineWidths(box, size);
      chain.forEach((c) => { widths = widths.concat(lineWidths(c, size)); });
      const chars = charsThatFit(helv, size, widths);
      if (!chars) continue;
      if (widths.length > 1) wraps[box.name] = widths.length;

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
    reference: 'Helvetica, laid out over a corpus of form answers',
    fields: capacity,
    wraps: wraps,
  }, null, 1));

  report.slice(0, 6).forEach((line) => console.log(line));
  const values = names.map((n) => capacity[n]);
  console.log('\n' + names.length + ' field(s) measured into ' + OUT);
  console.log('  smallest ' + Math.min(...values) + ' chars, largest '
    + Math.max(...values) + ', median '
    + values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]);
}

main().catch((e) => { console.error(e); process.exit(1); });
