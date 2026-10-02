/**
 * DocHelper's PDF reading: unlock a form, list its fields, and draw its pages.
 *
 * This is NEW-FORM.md steps 0-1 as code. Judicial Council PDFs ship encrypted
 * and pdf-lib reports zero fields until qpdf has decrypted them, so every PDF
 * goes through qpdf first when qpdf is there. The field list carries what the
 * person (or model) naming the fields needs and cannot get from the raw names:
 * the page, the box on the page, the words printed next to it
 * (pipeline-field-labels.js's rule), and for a checkbox or radio field with
 * several boxes, each box's export value - which is what a field config's
 * "widget" entry splits on.
 *
 * The page images are drawn with every field's box outlined and numbered, so
 * "field #14" in fields.json can be found on the page at a glance.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createCanvas } = require('@napi-rs/canvas');
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib');

const REPO = path.join(__dirname, '..', '..');
const STANDARD_FONTS = path.join(REPO, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep;

let pdfjsPromise = null;
function pdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

async function openWithPdfjs(bytes) {
  const lib = await pdfjs();
  return lib.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONTS,
  }).promise;
}

/**
 * Where qpdf is, whether or not it is on PATH. The Windows installer does not
 * add itself to PATH (pipeline-sanitize.js has the same search).
 */
function qpdfCommand() {
  try {
    execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
    return 'qpdf';
  } catch (e) { /* not on PATH */ }
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
  for (const root of roots) {
    let entries = [];
    try { entries = fs.readdirSync(root).filter((d) => d.toLowerCase().startsWith('qpdf')); } catch (e) { continue; }
    for (const dir of entries) {
      const exe = path.join(root, dir, 'bin', 'qpdf.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

/**
 * The PDF with its owner password taken off, or the PDF as it came when it was
 * never encrypted. Throws a sentence a person can act on when neither works.
 */
async function unlock(bytes) {
  const qpdf = qpdfCommand();
  if (qpdf) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dochelper-'));
    const src = path.join(dir, 'in.pdf');
    const out = path.join(dir, 'out.pdf');
    fs.writeFileSync(src, bytes);
    try {
      execFileSync(qpdf, ['--decrypt', '--password=', src, out], { stdio: 'ignore' });
    } catch (err) {
      // qpdf exits 3 on warnings it also repaired; only a missing output is fatal.
      if (!fs.existsSync(out)) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw new Error('This PDF could not be opened. It may be damaged or protected with a password.');
      }
    }
    const plain = fs.readFileSync(out);
    fs.rmSync(dir, { recursive: true, force: true });
    return { bytes: plain, decrypted: true };
  }
  try {
    await PDFDocument.load(bytes);
    return { bytes, decrypted: false };
  } catch (err) {
    if (/encrypt/i.test(String(err && err.message))) {
      throw new Error('This PDF is encrypted and qpdf is not installed, so its fields cannot be read. '
        + 'Install qpdf (winget install QPDF.QPDF) and try again.');
    }
    throw new Error('This PDF could not be opened: ' + (err && err.message));
  }
}

/** A field's kind as the field config names it. */
function kindOf(field) {
  switch (field.constructor.name) {
    case 'PDFTextField': return 'text';
    case 'PDFCheckBox': return 'checkbox';
    case 'PDFRadioGroup': return 'radio';
    case 'PDFDropdown': return 'dropdown';
    case 'PDFOptionList': return 'listbox';
    case 'PDFButton': return 'button';
    case 'PDFSignature': return 'signature';
    default: return 'other';
  }
}

/** The on-states a checkbox or radio widget can take: its /AP /N keys other than Off. */
function exportValuesOf(widgetDict) {
  const ap = widgetDict.lookup(PDFName.of('AP'));
  const normal = ap instanceof PDFDict ? ap.lookup(PDFName.of('N')) : null;
  if (!(normal instanceof PDFDict)) return [];
  return normal.keys().map((k) => k.decodeText()).filter((k) => k !== 'Off');
}

/**
 * Distance from a field to a piece of text, or null when it cannot be its
 * label. A text box is labelled from the left or above, a checkbox from the
 * right - looking left for a checkbox returns the previous option's word.
 * Same rule as pipeline-field-labels.js.
 */
function labelDistance(box, text, isCheckbox) {
  const verticalOverlap = Math.min(box.top, text.top) - Math.max(box.bottom, text.bottom);
  const sameLine = verticalOverlap > -2;
  if (sameLine && isCheckbox && text.left >= box.right - 2) return text.left - box.right;
  if (sameLine && text.right <= box.left + 2) return box.left - text.right;
  const horizontalOverlap = Math.min(box.right, text.right) - Math.max(box.left, text.left);
  if (text.bottom >= box.top - 2 && horizontalOverlap > -4) return (text.bottom - box.top) + 200;
  return null;
}

/** Text items on a page, as boxes. */
function textBoxes(items) {
  return items
    .filter((i) => i.str && i.str.trim())
    .map((i) => {
      const x = i.transform[4];
      const y = i.transform[5];
      return { str: i.str.trim(), left: x, right: x + (i.width || 0), bottom: y, top: y + (i.height || 8) };
    });
}

/** The page's words as lines, top to bottom - what the form says in print. */
function pageLines(texts) {
  const sorted = texts.slice().sort((a, b) => (b.top - a.top) || (a.left - b.left));
  const lines = [];
  sorted.forEach((t) => {
    const line = lines.find((l) => Math.abs(l.y - t.top) < 3);
    if (line) line.items.push(t);
    else lines.push({ y: t.top, items: [t] });
  });
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => l.items.sort((a, b) => a.left - b.left).map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Everything about a form a person needs to write its field config.
 *
 * Returns { pageCount, fields, pages: [{ number, width, height, lines }] }.
 * Each field is { index, id, type, page, rect, label, options?, maxLength?,
 * multiline?, boxes? } - `boxes` only when one field has several widgets with
 * different export values (a field config splits those with "widget").
 */
async function describeForm(plainBytes) {
  const doc = await PDFDocument.load(plainBytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const viewer = await openWithPdfjs(plainBytes);

  const pages = [];
  const annotsByName = new Map();
  for (let n = 1; n <= viewer.numPages; n++) {
    const page = await viewer.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const texts = textBoxes((await page.getTextContent()).items);
    pages.push({ number: n, width: viewport.width, height: viewport.height, lines: pageLines(texts) });
    (await page.getAnnotations())
      .filter((a) => a.subtype === 'Widget' && a.fieldName)
      .forEach((a) => {
        const [x1, y1, x2, y2] = a.rect;
        const box = { left: Math.min(x1, x2), right: Math.max(x1, x2), bottom: Math.min(y1, y2), top: Math.max(y1, y2) };
        let best = null;
        texts.forEach((t) => {
          const d = labelDistance(box, t, !!a.checkBox || !!a.radioButton);
          if (d !== null && (!best || d < best.d)) best = { d, str: t.str };
        });
        if (!annotsByName.has(a.fieldName)) annotsByName.set(a.fieldName, []);
        annotsByName.get(a.fieldName).push({
          page: n,
          rect: [box.left, box.bottom, box.right, box.top].map((v) => Math.round(v * 10) / 10),
          label: best ? best.str : '',
          exportValue: a.exportValue || a.buttonValue || null,
          multiLine: !!a.multiLine,
        });
      });
  }

  const fields = [];
  form.getFields().forEach((field) => {
    const id = field.getName();
    const type = kindOf(field);
    const widgets = annotsByName.get(id) || [];
    const first = widgets[0] || {};
    const entry = {
      index: fields.length + 1,
      id,
      type,
      page: first.page || null,
      rect: first.rect || null,
      label: first.label || '',
    };
    if (type === 'text') {
      try { const max = field.getMaxLength(); if (max) entry.maxLength = max; } catch (e) { /* none */ }
      try { if (field.isMultiline()) entry.multiline = true; } catch (e) { /* not known */ }
    }
    if (type === 'dropdown' || type === 'listbox' || type === 'radio') {
      try { entry.options = field.getOptions(); } catch (e) { /* none */ }
    }
    if (type === 'checkbox' || type === 'radio') {
      const states = field.acroField.getWidgets().map((w) => exportValuesOf(w.dict));
      const distinct = new Set(states.map((s) => s.join('|')));
      if (states.length > 1 && distinct.size > 1) {
        entry.boxes = states.map((s, i) => ({
          widget: s[0] || null,
          page: (widgets[i] || {}).page || null,
          rect: (widgets[i] || {}).rect || null,
          label: (widgets[i] || {}).label || '',
        }));
      }
    }
    if (widgets.length > 1 && !entry.boxes) entry.widgetCount = widgets.length;
    fields.push(entry);
  });

  return { pageCount: viewer.numPages, fields, pages };
}

/**
 * Draw every page to a PNG. With `fields`, each field's box is outlined and
 * labelled with its index from fields.json.
 */
async function renderPages(bytes, outDir, { scale = 1.4, fields = null, prefix = 'page' } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const viewer = await openWithPdfjs(bytes);
  const written = [];
  for (let n = 1; n <= viewer.numPages; n++) {
    const page = await viewer.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    if (fields) {
      const marks = [];
      fields.forEach((f) => {
        const boxes = f.boxes && f.boxes.length
          ? f.boxes.map((b, i) => ({ page: b.page, rect: b.rect, tag: f.index + String.fromCharCode(97 + i) }))
          : [{ page: f.page, rect: f.rect, tag: String(f.index) }];
        boxes.forEach((b) => { if (b.page === n && b.rect) marks.push(b); });
      });
      ctx.lineWidth = 1.5;
      ctx.font = 'bold 11px sans-serif';
      marks.forEach((m) => {
        const [l, b, r, t] = m.rect;
        const x = l * scale;
        const y = viewport.height - t * scale;
        const w = (r - l) * scale;
        const h = (t - b) * scale;
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.strokeRect(x, y, w, h);
        const tw = ctx.measureText(m.tag).width + 6;
        ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
        ctx.fillRect(x, Math.max(0, y - 13), tw, 13);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(m.tag, x + 3, Math.max(10, y - 3));
      });
    }

    const file = path.join(outDir, `${prefix}-${String(n).padStart(2, '0')}.png`);
    fs.writeFileSync(file, canvas.toBuffer('image/png'));
    written.push(file);
  }
  return written;
}

module.exports = { unlock, describeForm, renderPages, qpdfCommand };
