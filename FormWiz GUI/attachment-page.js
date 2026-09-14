/**
 * Continuation pages on MC-025, the one form the packet uses for more space.
 *
 * Rule the-packet-uses-mc025-for-more-space: anything that needs more room goes
 * on MC-025, "Attachment", which "may be used with any Judicial Council form" -
 * the rows of a table past what the paper prints (DV-105 item 3: "Write 'DV-105,
 * Children' at the top and attach it"), and a narrative past what its box holds
 * (DV-100 item 7(f), DV-160 items 6a, 6b and 8). It used to be a blank sheet
 * drawn from scratch, and DV-100 item 7 continued onto DV-101; California's own
 * instructions name MC-025 for both, and one form for every continuation is one
 * thing a clerk recognises.
 *
 * The lines and the page breaks come from continuation-layout.js, the same code
 * the interview runs to count the pages for DV-100 item 32 - so the count the
 * filer signs is the number of sheets drawn here.
 *
 * Each sheet is filled on its own copy of the sanitized blank
 * (FormWiz GUI/mc025.pdf, named by dv-field-configs/mc025-field-config.json) and
 * flattened, so the sheets do not share one set of field values, and they are
 * numbered on the form's own "Page __ of __". The form's buttons and on-screen
 * notices are taken off before flattening, so nothing but the form prints.
 *
 * Used by POST /edit_pdf in dev-server.js and FormWiz GUI/server.js: a request
 * that carries an "__attachment" field is drawn, not filled.
 *
 * spec = {
 *   name, heading, item, itemTitle, caseNumber, shortTitle, attachmentNumber,
 *   entries: [{ number, values: [{ label, value }] }],   rows past the paper's
 *   text: 'the narrative that did not fit'                or a box continued
 * }
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const layout = require('./continuation-layout');

const BLANK = path.join(__dirname, 'mc025.pdf');
const PAD = 4;

/** Set a one-line box, shrinking it to fit down to 6pt. */
function setFitted(form, font, name, text, largest) {
  let field;
  try { field = form.getTextField(name); } catch (e) { return; }
  const value = layout.drawable(text || '').split(String.fromCharCode(10)).join(' ');
  field.setText(value);
  const w = field.acroField.getWidgets()[0];
  const width = w ? w.getRectangle().width - PAD : 200;
  let size = largest || 10;
  while (size > 6 && layout.widthOf(value, size) > width) size -= 0.5;
  field.setFontSize(size);
}

/**
 * The body box the layout was worked out for. A replaced MC-025 laid out
 * differently would put lines under the footer, so it is refused, not drawn.
 */
function checkBody(doc) {
  const r = doc.getForm().getTextField('mc025_text').acroField.getWidgets()[0].getRectangle();
  const want = layout.BODY;
  if (Math.abs(r.width - want.width) > 1 || Math.abs(r.height - want.height) > 1) {
    throw new Error('mc025.pdf body box is ' + r.width.toFixed(1) + ' x ' + r.height.toFixed(1)
      + 'pt; continuation-layout.js is laid out for ' + want.width.toFixed(1) + ' x ' + want.height.toFixed(1)
      + ' - update BODY there to the new form');
  }
}

async function drawAttachmentPage(spec) {
  const blank = fs.readFileSync(BLANK);
  const pages = layout.paginate(spec);
  const heading = layout.bodyLines(spec)[0];
  const number = spec.attachmentNumber || layout.defaultAttachmentNumber(spec);

  const out = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    const doc = await PDFDocument.load(blank);
    if (i === 0) checkBody(doc);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const form = doc.getForm();
    // The buttons and the on-screen notices ("please press the Clear This Form
    // button", and the red frames around it) are for someone filling the PDF by
    // hand. Flattened they print, so they come off first.
    form.getFields().filter((x) => x.constructor.name === 'PDFButton' || /^mc025_(notice_|white_out)/.test(x.getName()))
      .forEach((b) => form.removeField(b));
    setFitted(form, font, 'mc025_short_title', spec.shortTitle, 10);
    setFitted(form, font, 'mc025_case_number', spec.caseNumber, 10);
    setFitted(form, font, 'mc025_attachment_number', number, 10);
    setFitted(form, font, 'mc025_page', String(i + 1), 10);
    setFitted(form, font, 'mc025_page_count', String(pages.length), 10);
    const text = form.getTextField('mc025_text');
    text.enableMultiline();
    text.setText(pages[i].join('\n'));
    text.setFontSize(layout.BODY_SIZE);
    form.updateFieldAppearances(font);
    form.flatten();
    const [copied] = await out.copyPages(doc, [0]);
    out.addPage(copied);
  }
  out.setTitle(heading);
  return out.save();
}

module.exports = { drawAttachmentPage, letterFor: layout.letterFor, bodyLines: layout.bodyLines };
