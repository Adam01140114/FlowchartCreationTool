/**
 * Local dev server for Flowchart Creation Tool + FormWiz preview.
 * Serves the whole repo on port 8080 and implements POST /edit_pdf so
 * Preview/Download PDF works (http-server alone returns 405 for POST).
 */
const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const {
  PDFDocument,
  StandardFonts,
  defaultTextFieldAppearanceProvider,
  pushGraphicsState,
  popGraphicsState,
  translate,
  layoutMultilineText,
  drawTextLines,
  TextAlignment,
  rgb,
  degrees,
} = require('pdf-lib');
const { preparePayloadHtml, sanitizePayloadFolderName } = require('./payload-html');
const ruledLines = require('./ruled-lines');
const { drawAttachmentPage } = require('./FormWiz GUI/attachment-page');

/**
 * The printed rules of the document being filled, for the length of one fill.
 *
 * pdf-lib calls an appearance provider synchronously, so the page content
 * cannot be parsed from inside it. It is read once before the fill loop and
 * parked here instead. The loop that reads it does not await, so no two fills
 * can see each other's.
 */
let currentRules = null;

/**
 * Which page each widget is on.
 *
 * Keyed by the annotation dictionary itself: a widget is handed to the
 * appearance provider as a dict with no reference attached, and pdf-lib's
 * context returns the same object for the same reference every time, so
 * identity is the one thing the two sides share.
 */
function widgetPages(pdfDoc) {
  const byDict = new Map();
  pdfDoc.getPages().forEach((page, index) => {
    const annots = page.node.Annots();
    if (!annots) return;
    annots.asArray().forEach((ref) => {
      const dict = pdfDoc.context.lookup(ref);
      if (dict) byDict.set(dict, index);
    });
  });
  return byDict;
}

/** The rules inside one widget's rectangle, top to bottom. */
function rulesUnder(widget) {
  if (!currentRules || !widget || !widget.dict) return [];
  const index = currentRules.pageOf.get(widget.dict);
  if (index === undefined) return [];
  const page = currentRules.pages[index];
  if (!page) return [];
  return ruledLines.linesInBox(page, widget.getRectangle());
}
require('dotenv').config();
const { registerAutoFormRoutes } = require('./auto-form/routes');

const ROOT = __dirname;
const FORM_WIZ_DIR = path.join(ROOT, 'FormWiz GUI');
const PORT = process.env.PORT || 8080;
// Matches BODY_LIMIT in auto-form/routes.js; see the parser note below.
const BODY_LIMIT = process.env.BODY_LIMIT || '50mb';

const app = express();
// The auto-form endpoints post base64 PDFs and whole field dumps, well past
// body-parser's 100kb default. These global parsers are registered before the
// per-route limits in auto-form/routes.js, so they consume the body first and
// have to allow the same size or those per-route limits never apply.
app.use(bodyParser.json({ limit: BODY_LIMIT }));
app.use(bodyParser.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use(fileUpload());
app.use(cors());

// TEMP DIAGNOSTIC: log every request so we can see what actually reaches this
// process (method, path, origin, and the status we send back).
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const tag = res.statusCode === 404 ? ' <-- 404' : '';
    console.log(
      `[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} `
      + `(${Date.now() - started}ms) ua=${(req.headers['user-agent'] || '').slice(0, 28)}${tag}`
    );
  });
  next();
});

app.use((req, res, next) => {
  if (req.path === '/.env' || req.path.endsWith('.env')) {
    return res.status(404).end();
  }
  next();
});

function shouldCheck(v) {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  const s = String(v).trim().toLowerCase();
  return s === 'on' || s === 'true' || s === 'yes' || s === '1' || s === 'checked';
}

function mapRadioValue(field, value) {
  try {
    const options = field.getOptions();
    const valueStr = String(value).trim();
    if (options.includes(valueStr)) return valueStr;
    if (valueStr === 'on' || valueStr === 'true' || valueStr === '1') {
      const yesOption = options.find((opt) =>
        opt.toLowerCase().includes('yes') ||
        opt.toLowerCase().includes('true') ||
        opt.toLowerCase().includes('1')
      );
      if (yesOption) return yesOption;
      if (options.length > 0) return options[0];
    }
    if (valueStr === 'off' || valueStr === 'false' || valueStr === '0') {
      const noOption = options.find((opt) =>
        opt.toLowerCase().includes('no') ||
        opt.toLowerCase().includes('false') ||
        opt.toLowerCase().includes('0')
      );
      if (noOption) return noOption;
    }
    if (valueStr.includes(',')) {
      const parts = valueStr.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) return mapRadioValue(field, parts[0]);
    }
    const partialMatch = options.find((opt) =>
      opt.toLowerCase().includes(valueStr.toLowerCase()) ||
      valueStr.toLowerCase().includes(opt.toLowerCase())
    );
    return partialMatch || null;
  } catch (error) {
    return null;
  }
}

function findPdfFile(targetFile) {
  const targetLower = path.basename(targetFile).toLowerCase();
  const searchRoots = [
    FORM_WIZ_DIR,
    path.join(FORM_WIZ_DIR, 'public', 'Forms'),
    ROOT
  ];

  for (const rootDir of searchRoots) {
    if (!fs.existsSync(rootDir)) continue;

    const direct = path.join(rootDir, targetLower);
    if (fs.existsSync(direct) && fs.lstatSync(direct).isFile()) {
      return direct;
    }

    const stack = [rootDir];
    while (stack.length) {
      const current = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (e) {
        continue;
      }
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase() === targetLower) {
          return fullPath;
        }
      }
    }
  }

  return null;
}

/**
 * The size a field was told to draw its text at, or null when it is auto.
 *
 * Read out of the field's default-appearance string, the /Helvetica 11 Tf in
 * "0 g\n/Helvetica 11 Tf". pdf-lib 1.17 has no accessor for it, and an
 * auto-sized field has 0 there, which means the layout picks the size itself.
 */
function declaredFontSize(field) {
  let da;
  try {
    da = field.acroField.getDefaultAppearance();
  } catch (e) {
    return null;
  }
  if (!da) return null;
  const match = String(da).match(/([\d.]+)\s+Tf/);
  if (!match) return null;
  const size = parseFloat(match[1]);
  return size > 0 ? size : null;
}

/**
 * Lay a string across a row of lines of given widths.
 *
 * Greedy by words, the way any text layout does it. A single word too wide for
 * an empty line is broken where it stops fitting rather than dropped - a field
 * name pasted into an answer box has no spaces in it and would otherwise take
 * a whole line and still be cut.
 *
 * The last line takes whatever is left, so nothing is ever thrown away: if the
 * answer outruns every line the form printed, the last one clips exactly as it
 * did before.
 */
function wrapAcrossLines(text, widths, font, size) {
  const words = String(text).split(' ').filter((word) => word !== '');
  const out = [];
  let i = 0;
  for (let line = 0; line < widths.length; line++) {
    if (line === widths.length - 1) {
      out.push(words.slice(i).join(' '));
      i = words.length;
      break;
    }
    let current = '';
    while (i < words.length) {
      const candidate = current ? current + ' ' + words[i] : words[i];
      if (font.widthOfTextAtSize(candidate, size) <= widths[line]) {
        current = candidate;
        i++;
        continue;
      }
      if (current) break;
      let cut = words[i];
      while (cut.length > 1 && font.widthOfTextAtSize(cut, size) > widths[line]) {
        cut = cut.slice(0, -1);
      }
      current = cut;
      words[i] = words[i].slice(cut.length);
      break;
    }
    out.push(current);
    if (i >= words.length) break;
  }
  while (out.length < widths.length) out.push('');
  return out;
}

/**
 * Put the rest of a long answer on the ruled line beneath it.
 *
 * A court form often prints two ruled lines for one answer and gives each its
 * own field. DV-100 item 16b(3) is the case: animal_sole_possession_other_
 * reason_line_1 is 166pt wide, the answer needs 226pt at the 11pt the field
 * declares, and pdf-lib draws it and clips what runs past the right edge. The
 * answer is on the page and unreadable, and the second ruled line the form
 * printed for exactly this is left empty.
 *
 * Which field continues which is read off the page, not off the names. A
 * continuation sits directly under its line, ends at the same right edge, is
 * the same height, is on the same page, and has nothing in it. That is true of
 * all three pairs on the DV-100 and does not depend on anyone having called
 * them _line_1 and _line_2 - a form with three ruled lines chains all three.
 *
 * An auto-sized field is left alone. There the layout shrinks the text to fit
 * rather than clipping it, so there is no overflow to move.
 */
function spillOntoContinuationLines(pdfDoc, form, body, font) {
  const pageOfDict = new Map();
  pdfDoc.getPages().forEach((page, index) => {
    const annots = page.node.Annots();
    if (!annots) return;
    annots.asArray().forEach((ref) => {
      const dict = pdfDoc.context.lookup(ref);
      if (dict) pageOfDict.set(dict, index);
    });
  });

  const lines = [];
  form.getFields().forEach((field) => {
    if (field.constructor.name !== 'PDFTextField') return;
    try { if (field.isMultiline()) return; } catch (e) { return; }
    let widget;
    try { widget = field.acroField.getWidgets()[0]; } catch (e) { return; }
    if (!widget) return;
    const rect = widget.getRectangle();
    let text = '';
    try { text = field.getText() || ''; } catch (e) { text = ''; }
    lines.push({
      name: field.getName(), field,
      page: pageOfDict.has(widget.dict) ? pageOfDict.get(widget.dict) : -1,
      right: rect.x + rect.width, bottom: rect.y, top: rect.y + rect.height,
      width: rect.width, height: rect.height,
      filled: text.trim() !== ''
    });
  });

  // pdf-lib insets the text a point from each edge and the border sits inside
  // that, so a couple of points of the box are not available to draw in.
  const room = (line) => line.width - 4;
  const values = Object.assign({}, body);
  const spilled = [];
  const taken = new Set();

  lines.forEach((line) => {
    const value = body[line.name];
    if (value === undefined || String(value).trim() === '') return;
    const size = declaredFontSize(line.field);
    if (!size) return;
    if (font.widthOfTextAtSize(String(value), size) <= room(line)) return;

    const chain = [line];
    let current = line;
    while (chain.length < 8) {
      const next = lines.find((other) =>
        other !== current && other.page === current.page && other.page >= 0
        && !taken.has(other.name) && body[other.name] === undefined && !other.filled
        // Below it, by no more than the pitch of one ruled line. A fixed
        // tolerance of a few points is not enough: the gap between two rules
        // is 0.33pt on the animals pair and 3.42pt on the move-out pair, and
        // measuring it against the line's own height is what tells a next line
        // apart from the one after that.
        && other.top <= current.bottom + 2
        && current.bottom - other.top <= current.height
        && Math.abs(other.right - current.right) <= 3
        && Math.abs(other.height - current.height) <= 2);
      if (!next) break;
      chain.push(next);
      taken.add(next.name);
      current = next;
    }
    if (chain.length < 2) return;

    const pieces = wrapAcrossLines(String(value), chain.map(room), font, size);
    chain.forEach((link, i) => { values[link.name] = pieces[i] || ''; });
    spilled.push({ from: line.name, onto: chain.slice(1).map((link) => link.name) });
  });

  return { values, spilled };
}

/**
 * Lay a multi-line answer on the lines the form actually ruled.
 *
 * pdf-lib leads at the font's own line height - 12.21pt at 11pt Helvetica -
 * and the paper is ruled at whatever pitch the form chose. On DV-100 item 17b
 * the box is 52.4pt and holds four lines, so the form ruled them 13.1pt apart:
 * a difference of 0.89pt a line, which by the fourth line has moved the text a
 * full 3.6pt and dragged it onto the rules. Filling every box to capacity is
 * what made it visible - with one short line in a four-line box there was
 * nothing to drift.
 *
 * The pitch needs no graphics parsing, because a ruled box is ruled evenly: it
 * is the box height divided by the number of lines the box holds. That is the
 * same count the form's printer used to decide how many rules to draw, so it
 * lands on them by construction and keeps working on a form nobody has seen.
 *
 * Text sits just above its rule rather than on it, the way handwriting does.
 */
function ruledPitchAppearance(field, widget, font, size) {
  const rectangle = widget.getRectangle();
  const lineHeight = font.heightAtSize(size) * 1.2;

  // The rules the form printed, if they can be read. Their pitch is the
  // form's own and needs no inferring - which matters because inferring it
  // was wrong by more than a point on DV-101 item 5: the box divided by the
  // lines that fit gives 15.1pt against a real 14.0, so the first line
  // cleared its rule, the second touched it and the fourth was struck
  // through. Reading them is exact, and exact for any form rather than for
  // the ones whose height happens to divide.
  const printed = rulesUnder(widget);
  const lines = printed.length >= 2
    ? printed.length
    : Math.floor((rectangle.height - 2) / lineHeight);
  if (lines < 2) return null;

  const pitch = rectangle.height / lines;
  // Only worth doing when the paper and the font actually disagree; below a
  // quarter point the correction is noise and the default is fine.
  if (printed.length < 2 && Math.abs(pitch - lineHeight) < 0.25) return null;

  let text = "";
  try { text = field.getText() || ""; } catch (e) { return null; }
  if (!text) return null;

  const inset = 2;
  const laid = layoutMultilineText(text, {
    alignment: TextAlignment.Left,
    fontSize: size,
    font: font,
    bounds: { x: inset, y: inset, width: rectangle.width - inset * 2,
              height: rectangle.height - inset * 2 },
  });
  if (!laid.lines.length) return null;

  // The ascender clears the rule; a little more keeps the descenders of one
  // line off the rule of the next.
  // A line that has nowhere to go is drawn nowhere, and says so.
  //
  // Text laid out past the last rule is written below the box and clipped:
  // the value is complete in the AcroForm, the payload is complete, and only
  // the ink is short - so every check that reads data passes and the paper is
  // wrong. Whoever is filling this deserves to be told which box it was.
  if (laid.lines.length > lines) {
    console.log('[edit_pdf] "' + field.getName() + '" needs '
      + laid.lines.length + ' lines and the box has ' + lines
      + '; the last ' + (laid.lines.length - lines) + ' will not print');
  }

  const ascender = font.heightAtSize(size, { descender: false });
  // A baseline sits just above its rule - far enough that the rule is not
  // touching the glyphs, close enough that the text is clearly written on
  // that line rather than floating between two.
  const SIT = 1.6;
  const restack = laid.lines.slice(0, lines).map((line, i) => Object.assign({}, line, {
    y: printed.length >= 2
      ? printed[i] - rectangle.y + SIT
      : rectangle.height - (i + 1) * pitch + (pitch - ascender) / 2 + 0.6,
  }));

  // Two arguments, and the font named the way the appearance stream names it:
  // drawTextLines(lines, options), with the resource name from font.name. The
  // first attempt passed one object and a made-up name, so it threw and the
  // caller quietly fell back to the old layout - which looked exactly like the
  // fix not working.
  return [
    pushGraphicsState(),
  ].concat(drawTextLines(restack, {
    color: rgb(0, 0, 0),
    font: font.name,
    size: size,
    rotate: degrees(0),
    xSkew: degrees(0),
    ySkew: degrees(0),
  })).concat([popGraphicsState()]);
}

/**
 * Put the first line of a multiline field on the rule the form printed.
 *
 * pdf-lib starts a multiline block one full line-height below the box's top
 * edge, which is a line-height rather than an ascender: the glyphs land about
 * (leading + descender) too low, and on a ruled form the printed rule crosses
 * them. On the DV-100 abuse-description boxes that is 12.21pt against an
 * ascender of 7.90pt - the text sat 4.3pt low and the rule struck through it.
 *
 * Only the first baseline is wrong in a fixed way, so only that is corrected:
 * every line is lifted by the same amount. The gap between lines still comes
 * from the font rather than from the rules on the page, so a long answer will
 * still drift against them - a form is free to rule its lines at any pitch and
 * nothing in the PDF says what that pitch is.
 *
 * An auto-sized field is left alone: the size is chosen inside the layout, so
 * there is no size here to compute a lift from.
 */
function ruledLineTextAppearance(field, widget, font) {
  const appearance = defaultTextFieldAppearanceProvider(field, widget, font);
  if (!Array.isArray(appearance)) return appearance;
  let multiline = false;
  try {
    multiline = field.isMultiline();
  } catch (e) {
    return appearance;
  }
  if (!multiline) return appearance;
  const size = declaredFontSize(field);
  if (!size) return appearance;

  // A box the form ruled at its own pitch is laid out on those rules instead.
  try {
    const ruled = ruledPitchAppearance(field, widget, font, size);
    if (ruled) return ruled;
  } catch (e) { /* fall back to the lift below */ }

  const lineHeight = font.heightAtSize(size) * 1.2;
  const ascender = font.heightAtSize(size, { descender: false });
  const wanted = lineHeight - ascender;
  if (!(wanted > 0)) return appearance;

  const rectangle = widget.getRectangle();

  // A box that is not as tall as one line of multiline text is a one-line box
  // that happens to carry the multiline flag, and the paper form under it has
  // ruled exactly one line. pdf-lib lays it out anyway, needs 12.21pt at 11pt
  // Helvetica, is given 12.00pt, and the glyphs are clipped through the middle
  // - which is how extend_service_deadline_reason printed on the DV-100.
  //
  // Single-line layout centres the text in whatever height there is, so it
  // fits. Borrow it by turning the flag off for the length of one call: the
  // field keeps its multiline flag in the saved document, and only the
  // appearance is drawn the other way.
  if (rectangle.height < lineHeight + 2) {
    try {
      field.disableMultiline();
      const single = defaultTextFieldAppearanceProvider(field, widget, font);
      return Array.isArray(single) ? single : appearance;
    } catch (e) {
      return appearance;
    } finally {
      field.enableMultiline();
    }
  }

  // Lift only into slack the box actually has. A box one line tall holds its
  // single line against the bottom already, and raising it pushes the glyphs
  // through the top edge, where the appearance is clipped and the text is cut
  // in half - which is what happened to the DV-100 item 21 explanation the
  // first time this ran. Lay the text out the way pdf-lib will to find out how
  // many lines it needs, and keep the block inside.
  const inset = 1;
  const bounds = {
    x: inset,
    y: inset,
    width: rectangle.width - inset * 2,
    height: rectangle.height - inset * 2,
  };
  let linesUsed = 1;
  try {
    linesUsed = Math.max(
      1,
      layoutMultilineText(field.getText() || '', {
        alignment: field.getAlignment(),
        fontSize: size,
        font,
        bounds,
      }).lines.length
    );
  } catch (e) {
    return appearance;
  }
  const slack = bounds.height - lineHeight * linesUsed;
  const lift = Math.min(wanted, Math.max(0, slack));
  if (!(lift > 0)) return appearance;
  return [pushGraphicsState(), translate(0, lift), ...appearance, popGraphicsState()];
}

app.post('/edit_pdf', async (req, res) => {
  try {
    // A page the form draws itself: entries past the rows the paper prints.
    // There is no template to fill - the form sends the rows it wants drawn.
    if (req.body && req.body.__attachment) {
      let spec;
      try { spec = JSON.parse(req.body.__attachment); } catch (e) { return res.status(400).send('Bad attachment spec'); }
      const attachmentBytes = await drawAttachmentPage(spec);
      const attachmentBase = path.basename(String(req.query.pdf || spec.name || 'Attachment')).replace(/\.pdf$/i, '');
      return res
        .set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Edited_${attachmentBase}.pdf"` })
        .send(Buffer.from(attachmentBytes));
    }
    let pdfBytes;
    let outputName = 'Edited_document.pdf';

    if (req.files && req.files.pdf) {
      pdfBytes = req.files.pdf.data;
      outputName = `Edited_${req.files.pdf.name}`;
    } else {
      const pdfName = req.query.pdf;
      if (!pdfName) {
        return res.status(400).send('No PDF provided (upload a file or pass ?pdf=filename).');
      }
      const normalizedBase = path.basename(pdfName).replace(/\.pdf$/i, '');
      const sanitized = normalizedBase + '.pdf';
      const pdfPath = findPdfFile(sanitized);
      if (!pdfPath) {
        return res.status(400).send(`Requested PDF does not exist on the server: ${sanitized}`);
      }
      pdfBytes = await fs.promises.readFile(pdfPath);
      outputName = `Edited_${path.basename(pdfPath)}`;
      console.log(`Using PDF: ${path.relative(ROOT, pdfPath)}`);
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const fieldNames = new Set(form.getFields().map((field) => field.getName()));

    // Read the printed rules before the fill loop, which is synchronous and
    // so cannot do it itself.
    currentRules = {
      pages: await ruledLines.harvest(pdfBytes, outputName),
      pageOf: widgetPages(pdfDoc),
    };

    const spill = spillOntoContinuationLines(pdfDoc, form, req.body || {}, helv);
    spill.spilled.forEach((s) => console.log(
      `[edit_pdf] ${outputName}: "${s.from}" ran past its ruled line; ` +
      `continued on ${s.onto.join(', ')}`));

    form.getFields().forEach((field) => {
      const key = field.getName();
      const value = spill.values[key];
      if (value === undefined) return;

      try {
        switch (field.constructor.name) {
          case 'PDFCheckBox':
            shouldCheck(value) ? field.check() : field.uncheck();
            break;
          case 'PDFRadioGroup': {
            const radioValue = mapRadioValue(field, value);
            if (radioValue) field.select(radioValue);
            break;
          }
          case 'PDFDropdown':
            field.select(String(value));
            break;
          case 'PDFTextField':
            field.setText(String(value));
            field.updateAppearances(helv, ruledLineTextAppearance);
            break;
          default:
            if (typeof field.setText === 'function') {
              field.setText(String(value));
              if (typeof field.updateAppearances === 'function') {
                field.updateAppearances(helv);
              }
            }
            break;
        }
      } catch (error) {
        console.warn(`Field ${key}:`, error.message);
      }
    });

    // An answer sent to a PDF that has no field of that name is simply lost.
    // That is normal for the interview's own working fields, and it is not
    // normal when a repeating block can produce more entries than the form has
    // rows: the DV-100 asks for up to six firearms and the DV-110 table holds
    // four, so entries five and six went nowhere and nothing said so.
    const unmatched = Object.keys(req.body || {}).filter((key) => !fieldNames.has(key));
    if (unmatched.length) {
      const numbered = unmatched.filter((key) => /_\d+(_|$)/.test(key));
      console.log(
        `[edit_pdf] ${outputName}: ${unmatched.length} submitted value(s) had no field ` +
        `in this PDF` + (numbered.length ? ` (${numbered.length} of them numbered, ` +
          `which is what an overflowing repeating block looks like)` : '')
      );
      if (numbered.length) console.log(`[edit_pdf]   numbered: ${numbered.join(
)}`);
    }

    const edited = await pdfDoc.save();
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${outputName}"`
      })
      .send(Buffer.from(edited));
  } catch (error) {
    console.error('edit_pdf failed:', error);
    res.status(500).send('Failed to fill PDF: ' + error.message);
  }
});

app.post('/api/test-payload', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const folderName = sanitizePayloadFolderName(req.body && req.body.folderName);
    let html = preparePayloadHtml((req.body && req.body.html) || '');
    if (!html.trim()) {
      return res.status(400).send('Missing html for test payload.');
    }
    if (!/^<!DOCTYPE/i.test(html)) {
      html = '<!DOCTYPE html>\n' + html;
    }

    const zip = new JSZip();
    const folder = zip.folder(folderName);
    folder.file('index.html', html);

    const staticAssets = ['generate.css', 'generate2.css', 'logo.png'];
    staticAssets.forEach((asset) => {
      const assetPath = path.join(FORM_WIZ_DIR, asset);
      if (fs.existsSync(assetPath) && fs.lstatSync(assetPath).isFile()) {
        folder.file(asset, fs.readFileSync(assetPath));
      }
    });

    const pdfNames = Array.isArray(req.body.pdfs) && req.body.pdfs.length
      ? req.body.pdfs
      : ['W9.pdf'];
    pdfNames.forEach((pdfName) => {
      const normalized = path.basename(String(pdfName).trim());
      if (!normalized) return;
      const withExt = /\.pdf$/i.test(normalized) ? normalized : normalized + '.pdf';
      const pdfPath = findPdfFile(withExt);
      if (pdfPath) {
        folder.file(withExt, fs.readFileSync(pdfPath));
      }
    });

    folder.file(
      'README.txt',
      [
        'Test payload for FormWiz',
        '',
        '1. Unzip this folder into:',
        '   FlowchartCreationTool/FormWiz GUI/',
        '',
        '2. Start the dev server from the project root:',
        '   npm start',
        '',
        '3. Open in your browser:',
        `   http://127.0.0.1:8080/FormWiz%20GUI/${encodeURIComponent(folderName)}/index.html`,
        '',
        'PDF preview and download use POST /edit_pdf on the same dev server.',
        'Run npm start (dev-server.js), not plain http-server.'
      ].join('\n')
    );

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res
      .set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`
      })
      .send(buf);
  } catch (error) {
    console.error('test-payload failed:', error);
    res.status(500).send('Failed to build test payload: ' + error.message);
  }
});

/**
 * Publish the thank-you screen's Download Payload as a live folder, not a zip.
 *
 * The same page the payload holds - test deployment, no Firebase, Stripe or
 * cart - written to live-sites/<name>/ and served by this server, so its link
 * works at once and /edit_pdf fills its PDFs. The payload drops the county
 * lookup; here it is copied in beside the page instead, so a ZIP code still
 * finds its county and court. A folder is only ever replaced when it holds the
 * live-site.json this route writes, so nothing else can be deleted by a rebuild.
 * The skill that drives it: .claude/skills/publish-live-site/SKILL.md.
 */
const LIVE_SITES_DIR = path.join(ROOT, 'live-sites');
const COUNTY_LOOKUP_FILES = ['zipData.js', 'courtData.js', 'courtLookup.js'];

function liveSiteSlug(name) {
  return String(name || 'form')
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'form';
}

function readLiveSiteManifest(slug) {
  try { return JSON.parse(fs.readFileSync(path.join(LIVE_SITES_DIR, slug, 'live-site.json'), 'utf8')); }
  catch (e) { return null; }
}

/**
 * Which folder a project publishes to: the one already holding its id.
 *
 * A project is its id, not its name. Saving it republishes the same link, so the
 * page handed out yesterday is the page that updates today - even after the
 * project is renamed. A project publishing for the first time takes the folder
 * its name makes, or the next free one if another project already has that
 * name: two projects called the same thing must not overwrite each other.
 */
function resolveLiveSiteSlug(folderName, projectId) {
  const base = liveSiteSlug(folderName);
  if (!projectId) return base;
  if (fs.existsSync(LIVE_SITES_DIR)) {
    const owned = fs.readdirSync(LIVE_SITES_DIR).find((slug) => {
      const m = readLiveSiteManifest(slug);
      return m && m.projectId === projectId;
    });
    if (owned) return owned;
  }
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : base + '-' + n;
    if (!fs.existsSync(path.join(LIVE_SITES_DIR, slug))) return slug;
    const m = readLiveSiteManifest(slug);
    // A folder this route did not make is never taken; one it made for no
    // project in particular is.
    if (m && !m.projectId) return slug;
  }
  return base + '-' + Date.now().toString(36);
}

/** The page's tab title, so an open tab says which build it is showing. */
function withTabTitle(html, tabTitle) {
  if (!tabTitle) return html;
  const tag = '<title>' + String(tabTitle).replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) + '</title>';
  const titled = /<title>[\s\S]*?<\/title>/i;
  if (titled.test(html)) return html.replace(titled, () => tag);
  return html.replace(/<head[^>]*>/i, (m) => m + '\n' + tag);
}

// The ways a packet can ask its questions, in the order index.html prefers them.
const LIVE_SITE_MODES = ['question', 'section', 'all'];
const LIVE_SITE_MODE_LABELS = {
  question: 'One question at a time',
  section: 'One section at a time',
  all: 'Every section on one page'
};

/** Keep the county lookup - pointed at the folder's own copy - then prepare it as the payload is. */
function prepareLiveSitePage(html) {
  let out = String(html || '').replace(/src="\.\.\/\.\.\/CountyLookup\//g, 'src="CountyLookup/');
  out = preparePayloadHtml(out);
  if (!/^<!DOCTYPE/i.test(out)) out = '<!DOCTYPE html>\n' + out;
  return out;
}

/**
 * index.html: sends ?mode=question or ?mode=section to that page.
 *
 * The style is built into a page when it is generated - which sections start
 * open, which questions start stepped, which visibility checks a stacked page
 * leaves out - so one page cannot be switched after the fact. Each mode is its
 * own page, and the link picks one.
 */
function liveSiteRouter(title, modes) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const links = modes.map((m) => `<li><a href="${m}.html">${esc(LIVE_SITE_MODE_LABELS[m] || m)}</a></li>`).join('');
  return [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${esc(title)}</title>`,
    '<script>',
    '(function () {',
    `  var pages = ${JSON.stringify(modes)};`,
    '  var params = new URLSearchParams(location.search);',
    '  var mode = String(params.get("mode") || "").toLowerCase();',
    '  if (pages.indexOf(mode) < 0) mode = pages[0];',
    '  params.delete("mode");',
    '  var rest = params.toString();',
    '  location.replace(mode + ".html" + (rest ? "?" + rest : "") + location.hash);',
    '})();',
    '</script></head>',
    `<body><noscript><h1>${esc(title)}</h1><ul>${links}</ul></noscript></body></html>`
  ].join('\n');
}

/**
 * Where a project's live site already is, by its id - "Open Form Link" in the
 * editor. Only a folder that says it belongs to the project counts, the same
 * test publishing uses, and nothing is created: a project never published gets
 * a 404 and the editor publishes it first.
 */
/** A project id as it may appear in a link: the editor's own shape, nothing that walks a path. */
const PROJECT_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/** The live-site folder that says it belongs to this project, or null. */
function liveSiteOfProject(projectId) {
  if (!projectId || !PROJECT_ID_RE.test(projectId) || !fs.existsSync(LIVE_SITES_DIR)) return null;
  return fs.readdirSync(LIVE_SITES_DIR).find((s) => {
    const m = readLiveSiteManifest(s);
    return m && m.projectId === projectId;
  }) || null;
}

/** The links that carry the project id, one per way of asking. */
function formLinksFor(projectId, modes) {
  const links = {};
  (modes || LIVE_SITE_MODES).forEach((mode) => {
    links[mode] = '/form/' + encodeURIComponent(projectId) + '/' + mode + '.html';
  });
  return links;
}

app.get('/api/live-site', (req, res) => {
  const projectId = String(req.query.projectId || '').trim();
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });
  const slug = liveSiteOfProject(projectId);
  if (!slug) return res.status(404).json({ error: 'This project has no live site yet' });
  const m = readLiveSiteManifest(slug) || {};
  const pages = {};
  LIVE_SITE_MODES.forEach((mode) => {
    if (fs.existsSync(path.join(LIVE_SITES_DIR, slug, mode + '.html'))) pages[mode] = '/live-sites/' + slug + '/' + mode + '.html';
  });
  res.json({ folder: 'live-sites/' + slug, slug, pages, formLinks: formLinksFor(projectId, Object.keys(pages)),
    tabTitle: m.tabTitle || '', builtAt: m.builtAt || '' });
});

/**
 * The form by its project id: /form/<projectId>/section.html.
 *
 * The folder a site lives in comes from the project's name, which can change
 * and can clash; the id is the project. So the link that is handed out names
 * the id, and the server looks up whichever folder holds that project's site -
 * any flowchart with a project id has one, however it is named. The page is
 * served from under the id, not redirected to the folder, so the link in the
 * address bar stays the one handed out, and the page's own CSS, county lookup
 * and PDFs resolve beside it exactly as they do in the folder.
 */
app.get('/form/:projectId', (req, res) => {
  res.redirect(302, '/form/' + encodeURIComponent(req.params.projectId) + '/section.html');
});
app.use('/form/:projectId', (req, res, next) => {
  const projectId = String(req.params.projectId || '');
  const slug = liveSiteOfProject(projectId);
  if (!slug) {
    const safe = projectId.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return res.status(404).type('html').send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>No form published</title></head>'
      + '<body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#1f2a37">'
      + '<h1 style="font-size:1.3rem">No form is published for this project yet</h1>'
      + '<p>Project <code>' + safe + '</code> has no live site. Open the project in the editor and press Save, or Open Form Link, and this link will work.</p>'
      + '</body></html>');
  }
  express.static(path.join(LIVE_SITES_DIR, slug))(req, res, next);
});

app.post('/api/publish-live-site', (req, res) => {
  try {
    const body = req.body || {};
    const projectId = String(body.projectId || '').trim();
    const slug = resolveLiveSiteSlug(body.folderName, projectId);
    const target = path.join(LIVE_SITES_DIR, slug);
    // "DV Packet 9/11/26 2:00pm": made by the editor in the operator's own
    // clock, so every tab on the site says which save it came from.
    const tabTitle = String(body.tabTitle || '').trim();
    // One page per mode. An older caller that sends a single html gets it as
    // the mode it names, or as the one-question-at-a-time page.
    const pages = {};
    if (body.pages && typeof body.pages === 'object') {
      LIVE_SITE_MODES.forEach((mode) => {
        if (String(body.pages[mode] || '').trim()) pages[mode] = body.pages[mode];
      });
    } else if (String(body.html || '').trim()) {
      pages[LIVE_SITE_MODES.includes(body.questionStyle) ? body.questionStyle : 'question'] = body.html;
    }
    const modes = LIVE_SITE_MODES.filter((mode) => pages[mode]);
    if (!modes.length) return res.status(400).json({ error: 'no html' });

    if (fs.existsSync(target)) {
      if (!fs.existsSync(path.join(target, 'live-site.json'))) {
        return res.status(409).json({
          error: `live-sites/${slug} already exists and was not made by this route - left alone`
        });
      }
      fs.rmSync(target, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(target, 'CountyLookup'), { recursive: true });
    // Claim the folder before writing into it: a build that fails partway
    // leaves a folder the next one may replace, not one it has to refuse.
    // The claim carries the project's id, so a second save arriving while this
    // one builds still finds its own folder rather than starting a new one.
    fs.writeFileSync(path.join(target, 'live-site.json'), JSON.stringify({ building: true, projectId, startedAt: new Date().toISOString() }));

    const title = String(body.title || slug);
    const files = [];
    modes.forEach((mode) => {
      fs.writeFileSync(path.join(target, mode + '.html'), prepareLiveSitePage(withTabTitle(pages[mode], tabTitle)));
      files.push(mode + '.html');
    });
    fs.writeFileSync(path.join(target, 'index.html'), liveSiteRouter(tabTitle || title, modes));
    files.push('index.html');
    // The interview the pages were generated from, kept beside them so a page
    // can be traced back to the save that made it.
    if (body.gui && typeof body.gui === 'object') {
      fs.writeFileSync(path.join(target, 'gui.json'), JSON.stringify(body.gui, null, 2));
      files.push('gui.json');
    }
    ['generate.css', 'generate2.css', 'logo.png'].forEach((asset) => {
      const src = path.join(FORM_WIZ_DIR, asset);
      if (!fs.existsSync(src)) return;
      fs.copyFileSync(src, path.join(target, asset));
      files.push(asset);
    });
    COUNTY_LOOKUP_FILES.forEach((name) => {
      const src = path.join(FORM_WIZ_DIR, 'CountyLookup', name);
      if (!fs.existsSync(src)) return;
      fs.copyFileSync(src, path.join(target, 'CountyLookup', name));
      files.push('CountyLookup/' + name);
    });

    const pdfs = [];
    const missingPdfs = [];
    (Array.isArray(body.pdfs) ? body.pdfs : []).forEach((name) => {
      const base = path.basename(String(name || '').trim());
      if (!base) return;
      const withExt = /\.pdf$/i.test(base) ? base : base + '.pdf';
      if (pdfs.includes(withExt) || missingPdfs.includes(withExt)) return;
      const src = findPdfFile(withExt);
      if (!src) { missingPdfs.push(withExt); return; }
      fs.copyFileSync(src, path.join(target, withExt));
      pdfs.push(withExt);
      files.push(withExt);
    });

    const url = `/live-sites/${encodeURIComponent(slug)}/index.html`;
    const links = {};
    const pageLinks = {};
    modes.forEach((mode) => {
      links[mode] = `${url}?mode=${mode}`;
      pageLinks[mode] = `/live-sites/${encodeURIComponent(slug)}/${mode}.html`;
    });
    const manifest = {
      title,
      tabTitle,
      folder: `live-sites/${slug}`,
      url,
      modes,
      links,
      pages: pageLinks,
      // The links to hand out: they name the project, not the folder.
      formLinks: projectId ? formLinksFor(projectId, modes) : {},
      builtAt: new Date().toISOString(),
      source: String(body.source || ''),
      projectId,
      pdfs,
      missingPdfs
    };
    fs.writeFileSync(path.join(target, 'live-site.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(target, 'README.txt'), [
      manifest.title,
      '',
      'Built by the publish-live-site skill from ' + (manifest.source || 'the project GUI export') + '.',
      'Open it through the dev server (npm start, or the flowchart-dev launch config):',
      ...modes.map((mode) => '  ' + (LIVE_SITE_MODE_LABELS[mode] || mode) + ': http://localhost:' + PORT + links[mode]),
      ...(projectId ? ['', 'By project id (the links to hand out - they follow the project, not this folder):',
        ...modes.map((mode) => '  ' + (LIVE_SITE_MODE_LABELS[mode] || mode) + ': http://localhost:' + PORT + manifest.formLinks[mode])] : []),
      '',
      'The PDFs are filled by the dev server\'s POST /edit_pdf, so opening index.html',
      'as a file shows the form but cannot produce PDFs. This folder keeps its own',
      'copies of the PDFs and of CountyLookup/ so it is complete on its own.',
      'Rebuilding replaces this whole folder - do not edit it by hand.'
    ].join('\n'));
    files.push('live-site.json', 'README.txt');

    res.json(Object.assign({}, manifest, { files }));
  } catch (error) {
    console.error('publish-live-site failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto Form Creator (ported from FormWiz) — mounts /Auto-Form-Creator + its API.
// Registered before the repo-wide static handler so its routes take precedence.
/**
 * Save a JSON artifact the browser built, so work like a merged packet does not
 * live only in localStorage. Dev-only: the name is reduced to a bare filename
 * under ROOT, so it cannot be steered outside the repo.
 */
app.post('/api/dev-save', (req, res) => {
  const name = path.basename(String((req.body && req.body.name) || ''));
  if (!/^[\w.-]+\.json$/.test(name)) {
    return res.status(400).json({ error: 'name must be a plain .json filename' });
  }
  const target = path.join(ROOT, name);
  try {
    fs.writeFileSync(target, JSON.stringify(req.body.data, null, 2));
    res.json({ saved: name, bytes: fs.statSync(target).size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Save generated form HTML next to the builder, so a generated page can be
 * opened as a real document with its own console rather than only inside an
 * about:srcdoc iframe. Dev-only: the name is reduced to a bare filename
 * under "FormWiz GUI", so it cannot be steered outside the repo.
 */
app.post('/api/dev-save-html', (req, res) => {
  const name = path.basename(String((req.body && req.body.name) || ''));
  if (!name.endsWith(String.fromCharCode(46)+'html') || name.length < 6) {
    return res.status(400).json({ error: 'name must be a plain .html filename' });
  }
  const html = String((req.body && req.body.html) || '');
  if (!html.trim()) return res.status(400).json({ error: 'no html' });
  const target = path.join(FORM_WIZ_DIR, name);
  try {
    fs.writeFileSync(target, html);
    res.json({ saved: name, bytes: fs.statSync(target).size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * The guest library, on disk.
 *
 * A guest's saved projects lived in the browser's cookies - dozens of 4KB pieces
 * per project, overflowing into localStorage - and went with the site data.
 * Here each is a file under guest-library/records/, named by an id this server
 * picks, and guest-library/index.json lists them by the name the operator gave
 * and the project each belongs to. Names never become paths, so no name can
 * steer a write outside the folder. auth.js falls back to cookies when these
 * routes are not there.
 */
const GUEST_LIBRARY_DIR = path.join(ROOT, 'guest-library');
const GUEST_LIBRARY_INDEX = path.join(GUEST_LIBRARY_DIR, 'index.json');

function writeFileAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
function readGuestIndex() {
  try {
    const list = JSON.parse(fs.readFileSync(GUEST_LIBRARY_INDEX, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}
function writeGuestIndex(list) {
  writeFileAtomic(GUEST_LIBRARY_INDEX, JSON.stringify(list, null, 2));
}
function guestRecordFile(id) {
  return path.join(GUEST_LIBRARY_DIR, 'records', path.basename(String(id)) + '.json');
}
function guestNameOf(req, key) {
  return String((req.body && req.body[key || 'name']) || req.query[key || 'name'] || '').trim();
}

app.get('/api/guest-library', (_req, res) => {
  res.json(readGuestIndex().slice().sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0)));
});

app.get('/api/guest-library/record', (req, res) => {
  const name = guestNameOf(req);
  const entry = readGuestIndex().find((e) => e.name === name);
  if (!entry) return res.status(404).json({ error: 'No flowchart named ' + name });
  try {
    res.type('application/json').send(fs.readFileSync(guestRecordFile(entry.id), 'utf8'));
  } catch (err) {
    res.status(404).json({ error: 'The file for ' + name + ' is missing' });
  }
});

app.post('/api/guest-library/record', (req, res) => {
  const name = guestNameOf(req);
  const payload = req.body && req.body.payload;
  if (!name || !payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'name and payload are required' });
  }
  try {
    const list = readGuestIndex();
    let entry = list.find((e) => e.name === name);
    if (!entry) {
      entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name };
      list.push(entry);
    }
    const flowchart = payload.flowchart || {};
    entry.lastUsed = payload.lastUsed || Date.now();
    entry.projectId = String(flowchart.projectId || '');
    entry.projectName = String(flowchart.projectName || '');
    const text = JSON.stringify(payload);
    writeFileAtomic(guestRecordFile(entry.id), text);
    writeGuestIndex(list);
    res.json({ saved: name, id: entry.id, bytes: Buffer.byteLength(text) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guest-library/touch', (req, res) => {
  const name = guestNameOf(req);
  const list = readGuestIndex();
  const entry = list.find((e) => e.name === name);
  if (!entry) return res.status(404).json({ error: 'No flowchart named ' + name });
  entry.lastUsed = Date.now();
  writeGuestIndex(list);
  res.json({ touched: name });
});

app.post('/api/guest-library/rename', (req, res) => {
  const oldName = guestNameOf(req, 'oldName');
  const newName = guestNameOf(req, 'newName');
  const list = readGuestIndex();
  const entry = list.find((e) => e.name === oldName);
  if (!entry) return res.status(404).json({ error: 'No flowchart named ' + oldName });
  if (!newName) return res.status(400).json({ error: 'newName is required' });
  if (list.some((e) => e.name === newName)) {
    return res.status(409).json({ error: 'A flowchart named "' + newName + '" already exists.' });
  }
  entry.name = newName;
  writeGuestIndex(list);
  res.json(entry);
});

app.post('/api/guest-library/delete', (req, res) => {
  const name = guestNameOf(req);
  const list = readGuestIndex();
  const entry = list.find((e) => e.name === name);
  if (entry) {
    try { fs.rmSync(guestRecordFile(entry.id), { force: true }); } catch (e) { /* already gone */ }
  }
  writeGuestIndex(list.filter((e) => e.name !== name));
  res.json({ deleted: name, existed: !!entry });
});

const autoFormStatus = registerAutoFormRoutes(app);

app.use(express.static(ROOT));

app.get('/', (_req, res) => {
  res.redirect('/index.html');
});

app.listen(PORT, () => {
  console.log(`Flowchart dev server running at http://127.0.0.1:${PORT}`);
  console.log('PDF fill endpoint: POST /edit_pdf?pdf=W9.pdf');
  console.log(`Looking for PDFs in: ${FORM_WIZ_DIR}`);
  console.log(`Auto Form Creator: http://127.0.0.1:${PORT}/Auto-Form-Creator/demo.html`);
  // Either key enables AI generation - openai-fetch prefers Claude when both
  // are present, so only report a problem when neither is configured.
  if (autoFormStatus.anthropic) {
    console.log(`AI generation: Claude (${process.env.ANTHROPIC_MODEL || 'default model'})`);
  } else if (autoFormStatus.openAi) {
    console.log('AI generation: OpenAI');
  } else {
    console.log('  (AI generation disabled - add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env)');
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use (likely an old http-server).`);
    console.error('Stop it, then run npm start again. Or set PORT=8088 npm start');
    process.exit(1);
  }
  throw err;
});
