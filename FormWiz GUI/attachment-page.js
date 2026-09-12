/**
 * Draw an attachment page: the entries a block holds past what the PDF prints.
 *
 * DV-105 item 3 prints four rows for children and says "Check here if you need
 * more space. Write 'DV-105, Children' at the top and attach it to this form."
 * There is no template for that sheet - the filer's own paper is the page - so
 * it is drawn here from the rows the form sends: the heading the form asks for
 * at the top, the item it continues, and one lettered row per extra entry,
 * carrying on from the last letter the PDF prints (a-d on the form, e onward
 * here).
 *
 * Used by POST /edit_pdf in dev-server.js and FormWiz GUI/server.js: a request
 * that carries an "__attachment" field is drawn, not filled.
 *
 * spec = {
 *   name, heading, item, itemTitle, caseNumber,
 *   entries: [{ number, values: [{ label, value }] }]
 * }
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PAGE_W = 612;          // US Letter, as the Judicial Council forms are
const PAGE_H = 792;
const MARGIN = 54;
const LINE = rgb(0.25, 0.25, 0.25);
const INK = rgb(0, 0, 0);
const GREY = rgb(0.35, 0.35, 0.35);

/** a, b, ... z, then aa, ab ... - the lettering the form's rows use. */
function letterFor(n) {
  let s = '';
  let k = n;
  while (k > 0) {
    const r = (k - 1) % 26;
    s = String.fromCharCode(97 + r) + s;
    k = Math.floor((k - 1) / 26);
  }
  return s;
}

/** Keep only what the standard font can draw; anything else becomes "?". */
function drawable(font, text) {
  let out = '';
  for (const ch of String(text == null ? '' : text).replace(/\s+/g, ' ')) {
    try { font.encodeText(ch); out += ch; } catch (e) { out += '?'; }
  }
  return out;
}

/** Break text into lines no wider than width. */
function wrap(font, size, text, width) {
  const words = String(text || '').split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

async function drawAttachmentPage(spec) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const heading = drawable(bold, spec.heading || spec.name || 'Attachment');
  const continues = [spec.item ? 'Item ' + spec.item : '', spec.itemTitle || '']
    .filter(Boolean).join(' - ');
  const subtitle = drawable(regular, continues
    ? 'Attached to continue ' + continues + '.'
    : 'Attached page.');
  const caseNumber = drawable(regular, spec.caseNumber || '');
  pdf.setTitle(heading);

  const pages = [];
  let page = null;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    y = PAGE_H - MARGIN;
    // The heading the form tells the filer to write at the top, on every sheet.
    // It shares the row with the case number, so it is sized to the room the
    // case number leaves: "DV-110, Other Protected People (continued)" at 16pt
    // printed its last word over "Case Number:". Below 10pt it would stop being
    // a heading, so a title that still does not fit puts the case number on a
    // line of its own instead.
    const title = heading + (pages.length > 1 ? ' (continued)' : '');
    const label = caseNumber ? 'Case Number: ' + caseNumber : '';
    const labelW = label ? regular.widthOfTextAtSize(label, 10) : 0;
    const room = PAGE_W - MARGIN * 2 - (label ? labelW + 14 : 0);
    let titleSize = 16;
    while (titleSize > 10 && bold.widthOfTextAtSize(title, titleSize) > room) titleSize -= 0.5;
    const ownLine = !!label && bold.widthOfTextAtSize(title, titleSize) > room;
    page.drawText(title, { x: MARGIN, y: y - 16, size: titleSize, font: bold, color: INK });
    if (label) {
      page.drawText(label, {
        x: PAGE_W - MARGIN - labelW,
        y: ownLine ? y - 30 : y - 14, size: 10, font: regular, color: INK
      });
    }
    y -= ownLine ? 46 : 34;
    page.drawText(subtitle, { x: MARGIN, y, size: 10, font: regular, color: GREY });
    y -= 12;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.8, color: LINE });
    y -= 26;
  };
  newPage();

  const entries = Array.isArray(spec.entries) ? spec.entries : [];
  const contentW = PAGE_W - MARGIN * 2;
  const letterW = 22;
  const size = 11;

  entries.forEach((entry) => {
    const values = (entry.values || []).map((v) => ({
      label: drawable(regular, (v.label || '').replace(/[:\s]+$/, '')) + ':',
      value: drawable(regular, v.value || '')
    }));
    // One line per field, like the form's own row but with room for a long
    // name: "e.  Name: ____________  Date of birth: ______" when it fits,
    // otherwise each field on its own ruled line under the letter.
    const cells = values.map((v) => {
      const labelW = regular.widthOfTextAtSize(v.label + ' ', size);
      const valueW = Math.max(regular.widthOfTextAtSize(v.value, size) + 12, 110);
      return { v, labelW, valueW };
    });
    const oneLineW = cells.reduce((s, c) => s + c.labelW + c.valueW + 16, 0);
    const rows = oneLineW <= contentW - letterW ? [cells] : cells.map((c) => [c]);
    const needed = rows.length * 24 + 6;
    if (y - needed < MARGIN + 20) newPage();

    page.drawText(letterFor(entry.number) + '.', { x: MARGIN, y, size, font: regular, color: INK });
    rows.forEach((row) => {
      let x = MARGIN + letterW;
      row.forEach((c) => {
        page.drawText(c.v.label, { x, y, size, font: regular, color: INK });
        x += c.labelW;
        const valueW = row.length === 1 ? (MARGIN + contentW - x) : c.valueW;
        const lines = wrap(regular, size, c.v.value, valueW - 4);
        lines.forEach((text, i) => {
          if (i > 0) { y -= 16; if (y < MARGIN + 20) { newPage(); x = MARGIN + letterW + c.labelW; } }
          page.drawText(text, { x: x + 2, y, size, font: regular, color: INK });
          page.drawLine({ start: { x, y: y - 3 }, end: { x: x + valueW, y: y - 3 }, thickness: 0.6, color: LINE });
        });
        x += valueW + 16;
      });
      y -= 24;
    });
    y -= 6;
  });

  if (!entries.length) {
    page.drawText('(No further entries.)', { x: MARGIN, y, size, font: regular, color: GREY });
  }

  pages.forEach((p, i) => {
    const label = 'Page ' + (i + 1) + ' of ' + pages.length;
    p.drawText(label, {
      x: PAGE_W - MARGIN - regular.widthOfTextAtSize(label, 9),
      y: MARGIN - 24, size: 9, font: regular, color: GREY
    });
  });

  return pdf.save();
}

module.exports = { drawAttachmentPage, letterFor };
