#!/usr/bin/env node
/**
 * Rule 4 — fill the packet's PDFs from a captured answer set and read them back.
 *
 * Takes the answers a debug fill posted (pipeline-answers.json, saved from the
 * generated form), sends them to the dev server's /edit_pdf exactly as the form
 * does, and keeps the filled PDFs. Then reads each one back:
 *
 *   4a  every field the answers reached carries a value
 *   4b  in a marker run each free-text box carries its own field name, so a
 *       value that is NOT its own name is either a mirror (a shared value like
 *       the case number), a validated field (date/zip/phone), or a mapping bug
 *
 * The PDFs are also rendered to PNG so the pages can be read against the blank
 * form, which is the only way 4b is finished.
 *
 * A block with more entries than the paper has rows (DV-105's children) also
 * gets the page the form draws for the rest, built from the same answers.
 *
 * Usage:  node pipeline-fill.js [answers.json] [--answers file] [--out dir]
 *                                 [--render] [--scale n] [--server url]
 *                                 [--forms a,b,c] [--gui file]
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
// A value that follows one of these is that flag's, not the answers file -
// "--gui dv-packet-gui.json" would otherwise be filled as the answers.
const VALUE_FLAGS = ['--answers', '--out', '--server', '--forms', '--scale', '--gui'];
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));
const ANSWERS = flag('answers', '') || positional.find((a) => a.endsWith('.json')) || 'pipeline-answers.json';
// The interview the answers came from. It is the only place a block says how
// many rows the paper prints and which page takes the rest.
const GUI = flag('gui', 'dv-packet-gui.json');
const OUT = flag('out', 'pipeline-out');
const SERVER = flag('server', 'http://127.0.0.1:8080');
const RENDER = args.includes('--render');
const { packetForms } = require('./packet-forms');
const FORMS = (flag('forms', '') || packetForms().join(',')).split(',').filter(Boolean);
// Big enough to read a filled box against the printed label, small enough
// that thirteen pages stay a reasonable size on disk.
const RENDER_SCALE = Number(flag('scale', '1.6')) || 1.6;

function multipart(data) {
  const boundary = '----pipeline' + Date.now();
  const chunks = [];
  Object.entries(data).forEach(([k, v]) => {
    chunks.push('--' + boundary + '\r\n'
      + 'Content-Disposition: form-data; name="' + k + '"\r\n\r\n' + v + '\r\n');
  });
  chunks.push('--' + boundary + '--\r\n');
  return { body: Buffer.from(chunks.join(''), 'utf8'),
           type: 'multipart/form-data; boundary=' + boundary };
}

async function fillOne(base, data) {
  const { body, type } = multipart(data);
  const res = await fetch(SERVER + '/edit_pdf?pdf=' + encodeURIComponent(base + '.pdf'), {
    method: 'POST', headers: { 'Content-Type': type }, body
  });
  if (!res.ok) throw new Error(base + ': HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return Buffer.from(await res.arrayBuffer());
}

/** What the filled PDF actually holds, field by field. */
async function readBack(buffer) {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const out = [];
  doc.getForm().getFields().forEach((f) => {
    const kind = f.constructor.name;
    if (kind === 'PDFCheckBox') out.push({ name: f.getName(), kind: 'checkbox', value: f.isChecked() });
    else if (kind === 'PDFTextField') out.push({ name: f.getName(), kind: 'text', value: f.getText() || '' });
    else out.push({ name: f.getName(), kind: kind, value: null });
  });
  return out;
}

/**
 * Rasterise every page, so a filled form can be read against the blank one.
 *
 * This used to shell out to Ghostscript, which the repo does not install - on a
 * machine without `gs` the run died at exactly the point rule 4b begins, which
 * is the one check that cannot be made from field values alone. pdfjs and
 * @napi-rs/canvas are already dependencies, so this renders in-process and
 * --render works wherever `npm install` has run.
 *
 * Four settings decide whether the answers actually appear, and getting any of
 * them wrong produces a page that looks convincingly like a filling bug:
 *
 *   useSystemFonts: false   the appearance streams name Helvetica, and asking
 *   disableFontFace: true   Node for a system font fails silently - every text
 *   standardFontDataUrl     box renders empty while the checkboxes still tick.
 *                           These three make pdfjs draw glyph outlines from its
 *                           own bundled fonts instead.
 *   annotationMode: 1       paints each widget's own appearance stream onto the
 *                           canvas. Mode 2 hands widgets to an HTML layer that
 *                           does not exist here, and the page comes out blank.
 *
 * Path2D and DOMMatrix are browser globals pdfjs expects; @napi-rs/canvas
 * exports them but does not install them.
 */
async function renderPages(pdfPath, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const canvasLib = require('@napi-rs/canvas');
  globalThis.Path2D = globalThis.Path2D || canvasLib.Path2D;
  globalThis.DOMMatrix = globalThis.DOMMatrix || canvasLib.DOMMatrix;
  globalThis.ImageData = globalThis.ImageData || canvasLib.ImageData;

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const standardFontDataUrl = path.join(
    path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep;

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(pdfPath)),
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl,
    annotationMode: 1,
    verbosity: 0
  }).promise;

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = canvasLib.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    // A PDF page assumes paper. Without this the transparent ground reads as
    // black wherever the form leaves the page empty.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, annotationMode: 1 }).promise;
    fs.writeFileSync(path.join(dir, 'page-' + n + '.png'), canvas.toBuffer('image/png'));
    page.cleanup();
  }
  const pages = doc.numPages;
  await doc.destroy();
  return pages;
}

/**
 * The boxes on this form the court ticks, not the filer.
 *
 * Three of DV-110's eighty-five checkboxes come back ticked, which reads as a
 * form that barely filled - and is right: eighty of them are the judge's
 * decisions, and DV-110 says on its face that the filer completes items 1, 2
 * and 3 only. A ratio that has to be re-derived by hand every time it is read
 * is a ratio that will eventually be read as a defect.
 */
function courtOwnedBoxes(base) {
  const file = path.join('dv-field-configs', base.toLowerCase() + '-field-config.json');
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    return new Set((config.fields || [])
      .filter((f) => f.courtUse && f.type !== 'text')
      .map((f) => f.newName));
  } catch (err) { return new Set(); }
}

/**
 * The blocks that continue on a page the form draws.
 *
 * DV-105 item 3 prints four children and the filer may enter twelve. The fifth
 * onward never reaches a PDF field - the form posts them to /edit_pdf as an
 * "__attachment" and the server draws the sheet - so filling the packet's PDFs
 * alone gives a clean-looking run with those children nowhere in it.
 */
function attachmentBlocks() {
  let gui;
  try { gui = JSON.parse(fs.readFileSync(GUI, 'utf8')); }
  catch (err) {
    console.log('attachment pages: cannot read ' + GUI + ' (' + err.message + '), none drawn');
    return [];
  }
  const pages = [];
  (gui.sections || []).forEach((s) => (s.questions || []).forEach((q) => {
    // Other settings are also called "attachment" and hold a string.
    if (!q || !q.attachment || typeof q.attachment !== 'object' || !q.attachment.name) return;
    // The block's own page, then the same entries on other forms' pages
    // (DV-110 and CLETS-001 each print four of DV-100's other protected people).
    [q.attachment].concat(Array.isArray(q.attachment.otherPages) ? q.attachment.otherPages : [])
      .forEach((att) => { if (att && att.name) pages.push({ q, att, fields: pageFields(q, att.fields) }); });
  }));
  return pages;
}

/**
 * The columns one page prints, as generate.js picks them: a key such as
 * "{n}_full_name" (the end of the entry field's id) or a label, in the order
 * named. Nothing named, or nothing matched, prints every field.
 */
function pageFields(q, keys) {
  const all = q.allFieldsInOrder || [];
  const wanted = (Array.isArray(keys) ? keys : String(keys || '').split(','))
    .map((k) => String(k || '').trim()).filter(Boolean);
  const picked = [];
  wanted.forEach((k) => {
    const hit = all.find((f) => (k.includes('{n}') && String(f.nodeId || '').endsWith(k))
      // A choice column keeps its name as fieldName ("Lives with you?").
      || String(f.label || f.fieldName || '').trim().toLowerCase() === k.toLowerCase());
    if (hit && !picked.includes(hit)) picked.push(hit);
  });
  return picked.length ? picked : all;
}

/** The form's id for one entry's field: "{n}" filled in, or "_n" appended. */
function entryFieldId(nodeId, n) {
  const id = String(nodeId == null ? '' : nodeId);
  return id.includes('{n}') ? id.split('{n}').join(String(n)) : id + '_' + n;
}

/** A ticked box. The form posts "on"; a captured answer set may say "Yes". */
function ticked(v) {
  return !!v && !/^(off|false|no|0)$/i.test(String(v).trim());
}

/**
 * The request the form sends for the page, built from the answers instead of
 * the page's inputs - the same shape as attachmentSpecFor in
 * FormWiz GUI/generate.js, so the server cannot tell the two apart.
 */
function attachmentSpec(page, data, count) {
  const { q, att } = page;
  const rows = parseInt(q.max, 10) || 0;
  const entries = [];
  for (let n = rows + 1; n <= count; n++) {
    const values = page.fields.map((f) => {
      const label = f.label || f.fieldName || '';
      if (f.type === 'checkbox' && f.options && f.options.length) {
        const chosen = f.options.filter((o) => ticked(data[entryFieldId(o.nodeId, n)]));
        return { label, value: chosen.map((o) => o.text || o.checkboxText || '').join(', ') };
      }
      const v = data[entryFieldId(f.nodeId, n)];
      return { label, value: v == null ? '' : String(v).trim() };
    });
    // An entry the filer left empty is not a row, as on the form.
    if (values.some((v) => v.value)) entries.push({ number: n, values });
  }
  return {
    name: att.name, heading: att.heading || '', item: att.item || '', itemTitle: att.itemTitle || '',
    caseNumber: String(data.case_number || '').trim(),
    entries
  };
}

async function main() {
  const data = JSON.parse(fs.readFileSync(ANSWERS, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  console.log('answers: ' + Object.keys(data).length + ' values from ' + ANSWERS);

  // Decided before any form is filled: the box that says a page is attached
  // is on the forms, and the form ticks it itself whenever there are more
  // entries than rows, so a captured answer set need not carry it.
  const attachments = attachmentBlocks().map((page) => Object.assign(page, {
    count: parseInt(data[page.q.nodeId], 10) || 0, rows: parseInt(page.q.max, 10) || 0
  }));
  attachments.forEach((a) => {
    const marks = a.att.marks;
    if (a.count > a.rows && marks && !ticked(data[marks])) data[marks] = 'on';
  });

  for (const base of FORMS) {
    let buffer;
    try { buffer = await fillOne(base, data); }
    catch (err) { console.log('\n' + base + ': ' + err.message); continue; }

    const file = path.join(OUT, base + '-filled.pdf');
    fs.writeFileSync(file, buffer);
    const fields = await readBack(buffer);

    const text = fields.filter((f) => f.kind === 'text');
    const boxes = fields.filter((f) => f.kind === 'checkbox');
    const filledText = text.filter((f) => String(f.value).trim() !== '');
    const ticked = boxes.filter((f) => f.value);
    // In a marker run a text box should print its own name. Anything else is a
    // mirror, a validated field, or a mapping to look at.
    const markers = filledText.filter((f) => f.value.trim() === f.name);
    const others = filledText.filter((f) => f.value.trim() !== f.name);

    console.log('\n' + base + '  ->  ' + file);
    console.log('  text       ' + filledText.length + '/' + text.length + ' filled'
      + '   (' + markers.length + ' carry their own name, ' + others.length + ' carry something else)');
    const court = courtOwnedBoxes(base);
    const theirs = boxes.filter((f) => court.has(f.name));
    const unchosen = boxes.filter((f) => !f.value && !court.has(f.name));
    console.log('  checkboxes ' + ticked.length + '/' + boxes.length + ' ticked'
      + (theirs.length || unchosen.length
        ? '   (' + [
            theirs.length ? theirs.length + ' the court ticks' : '',
            unchosen.length ? unchosen.length + ' an option not chosen' : ''
          ].filter(Boolean).join(', ') + ')'
        : ''));
    // A ticked box the court owns is the real defect here, and it is the one
    // thing this count could hide.
    const wrong = ticked.filter((f) => court.has(f.name));
    if (wrong.length) {
      console.log('  DEFECT: ' + wrong.length + ' box(es) the court ticks were filled: '
        + wrong.map((f) => f.name).join(', '));
    }
    const emptyText = text.filter((f) => String(f.value).trim() === '');
    if (emptyText.length) {
      console.log('  empty text fields (' + emptyText.length + '):');
      emptyText.forEach((f) => console.log('      - ' + f.name));
    }
    if (others.length) {
      console.log('  values that are not their own name (' + others.length + '):');
      others.slice(0, 40).forEach((f) => console.log('      - ' + f.name + ' = ' + JSON.stringify(f.value).slice(0, 60)));
      if (others.length > 40) console.log('      ... ' + (others.length - 40) + ' more');
    }
    fs.writeFileSync(path.join(OUT, base + '-readback.json'), JSON.stringify(fields, null, 2));
    if (RENDER) {
      const n = await renderPages(file, path.join(OUT, base + '-pages'));
      console.log('  rendered ' + n + ' page(s) to ' + path.join(OUT, base + '-pages'));
    }
  }

  for (const a of attachments) {
    const att = a.att;
    const base = String(att.name).toLowerCase();
    const file = path.join(OUT, base + '-filled.pdf');
    const pagesDir = path.join(OUT, base + '-pages');
    if (a.count <= a.rows) {
      console.log('\n' + att.name + ': no attachment needed (' + a.q.nodeId + ' = ' + a.count
        + ', the form prints ' + a.rows + ')');
      // pipeline-current-output.js publishes every -pages folder it finds, so
      // a sheet from an earlier run with more entries would still be shown as
      // part of a packet that no longer has it.
      fs.rmSync(file, { force: true });
      fs.rmSync(pagesDir, { recursive: true, force: true });
      continue;
    }
    const spec = attachmentSpec(a, data, a.count);
    let buffer;
    try { buffer = await fillOne(att.name, { __attachment: JSON.stringify(spec) }); }
    catch (err) { console.log('\n' + att.name + ': ' + err.message); continue; }
    fs.writeFileSync(file, buffer);
    console.log('\n' + att.name + '  ->  ' + file);
    console.log('  "' + spec.heading + '", item ' + spec.item + ': ' + a.q.nodeId + ' = ' + a.count
      + ', the form prints ' + a.rows + ', ' + spec.entries.length + ' entr'
      + (spec.entries.length === 1 ? 'y' : 'ies') + ' drawn'
      + (att.marks ? '   (' + att.marks + ' ticked)' : ''));
    if (RENDER) {
      // A shorter list draws fewer pages; last run's extra PNGs would stay.
      fs.rmSync(pagesDir, { recursive: true, force: true });
      const n = await renderPages(file, pagesDir);
      console.log('  rendered ' + n + ' page(s) to ' + pagesDir);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
