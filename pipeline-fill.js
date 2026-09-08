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
 * Usage:  node pipeline-fill.js [answers.json] [--out dir] [--render] [--server url]
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const ANSWERS = args.find((a) => !a.startsWith('--') && a.endsWith('.json')) || 'pipeline-answers.json';
const OUT = flag('out', 'pipeline-out');
const SERVER = flag('server', 'http://127.0.0.1:8080');
const RENDER = args.includes('--render');
const FORMS = (flag('forms', 'dv100,dv109,dv110')).split(',');

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

function renderPages(pdfPath, dir) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('gs', ['-dNOPAUSE', '-dBATCH', '-sDEVICE=png16m', '-r110',
    '-sOutputFile=' + path.join(dir, 'page-%d.png'), pdfPath], { stdio: 'ignore' });
  return fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(ANSWERS, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  console.log('answers: ' + Object.keys(data).length + ' values from ' + ANSWERS);

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
    console.log('  checkboxes ' + ticked.length + '/' + boxes.length + ' ticked');
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
      const n = renderPages(file, path.join(OUT, base + '-pages'));
      console.log('  rendered ' + n + ' page(s) to ' + path.join(OUT, base + '-pages'));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
