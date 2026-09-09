#!/usr/bin/env node
/**
 * Rebuild a sanitized PDF from its field config.
 *
 * The Judicial Council PDFs are encrypted XFA forms whose AcroForm names are
 * paths like DV-110[0].Page2[0].List6[0].Li1[0].TextField[0]. The sanitizer
 * renames every field to the canonical name in the field config, and that
 * renamed copy is what /edit_pdf fills. So a field config edit is not live
 * until the PDF is rebuilt - this is that step, as a command.
 *
 * Usage: node pipeline-sanitize.js [dv100 dv110 ...] [--check]
 *   --check  rebuild into memory and report what would change, writing nothing
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { PDFDocument, PDFName, PDFNumber } = require('pdf-lib');
const { sanitizePdfFields } = require('./auto-form/pdf-field-sanitizer');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const FORMS = args.filter((a) => !a.startsWith('--'));
const OUT_DIR = 'FormWiz GUI';
const CONFIG_DIR = 'dv-field-configs';

/**
 * Where qpdf is, whether or not somebody put it on PATH.
 *
 * The Windows installer does not add itself to PATH, so `qpdf` is present and
 * unreachable - and the failure reads as "qpdf is not installed", which sends
 * the next person off to install it again.
 */
function qpdfCommand() {
  try {
    execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
    return 'qpdf';
  } catch (e) { /* not on PATH; look where the installers put it */ }

  const roots = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean);
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root).filter((d) => d.toLowerCase().startsWith('qpdf'));
    } catch (e) { continue; }
    for (const dir of entries) {
      const exe = path.join(root, dir, 'bin', 'qpdf.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw new Error(
    'qpdf not found. These PDFs ship encrypted and pdf-lib cannot open one.\n'
    + 'Install it (winget install QPDF.QPDF) or put qpdf on PATH.'
  );
}

/** qpdf strips the owner password these forms ship with; pdf-lib cannot. */
function decrypt(source) {
  const tmp = path.join(os.tmpdir(), 'pipeline-' + path.basename(source));
  try {
    execFileSync(qpdfCommand(), ['--decrypt', '--password=', source, tmp], { stdio: 'ignore' });
  } catch (err) {
    // qpdf exits 3 on warnings it also repairs; only a missing output is fatal.
    if (!fs.existsSync(tmp)) throw err;
  }
  return fs.readFileSync(tmp);
}

/**
 * Move a field's box off the form's own printed label.
 *
 * DV-101 item 3e is the case: the widget rectangle for "Describe any injuries"
 * starts eight points ABOVE the label it belongs to, so the label sits on the
 * box's first line. Anything that draws the answer from the top of the box -
 * this pipeline, and Acrobat too - prints it straight through the words
 * "Describe any injuries:". The value is correct, the field name is correct,
 * and the page is unreadable; only looking at the rendered page finds it.
 *
 * The fix belongs here rather than in the filler. A rectangle that covers ink
 * the page has already laid down is wrong in the PDF, and every consumer of
 * the sanitized PDF should see the corrected one. So: find text whose baseline
 * falls inside a multi-line box and whose columns overlap it, and lower the
 * top of the box to just under that text. Never grow a box, and never shrink
 * one past a single line of room.
 */
async function unoverlapLabels(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes), isEvalSupported: false,
    standardFontDataUrl: path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep,
  }).promise;

  const moved = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const texts = (await page.getTextContent()).items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width || 0, h: i.height || 8, str: i.str.trim() }));
    (await page.getAnnotations())
      .filter((a) => a.subtype === 'Widget' && a.fieldName && a.multiLine)
      .forEach((a) => {
        const [x1, y1, x2, y2] = a.rect;
        const left = Math.min(x1, x2), right = Math.max(x1, x2);
        const bottom = Math.min(y1, y2), top = Math.max(y1, y2);
        let lowest = null;
        texts.forEach((t) => {
          if (Math.min(right, t.x + t.w) - Math.max(left, t.x) <= 2) return;
          if (t.y < bottom || t.y > top) return;
          if (lowest === null || t.y < lowest) lowest = t.y;
        });
        if (lowest === null) return;
        // Just under the label's baseline, leaving room for its descenders.
        const newTop = lowest - 3;
        if (newTop >= top || newTop - bottom < 12) return;
        moved.push({ page: n, name: a.fieldName, from: Math.round(top), to: Math.round(newTop) });
      });
  }
  return moved;
}

/** Apply the corrected tops to the rebuilt document. */
async function applyRects(bytes, moved) {
  if (!moved.length) return bytes;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const wanted = new Map(moved.map((m) => [m.name, m.to]));
  doc.getPages().forEach((page) => {
    page.node.Annots() && page.node.Annots().asArray().forEach((ref) => {
      const dict = doc.context.lookup(ref);
      if (!dict || typeof dict.get !== 'function') return;
      const name = dict.get(PDFName.of('T'));
      const key = name && typeof name.decodeText === 'function' ? name.decodeText() : null;
      if (!key || !wanted.has(key)) return;
      const rect = dict.get(PDFName.of('Rect'));
      if (!rect || typeof rect.asArray !== 'function') return;
      const nums = rect.asArray().map((v) => v.asNumber());
      const top = Math.max(nums[1], nums[3]);
      const at = nums[1] === top ? 1 : 3;
      rect.set(at, PDFNumber.of(wanted.get(key)));
    });
  });
  return doc.save();
}

async function names(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getForm().getFields().map((f) => f.getName());
}

async function main() {
  for (const base of (FORMS.length ? FORMS : ['dv100', 'dv109', 'dv110'])) {
    const source = base + '.pdf';
    const config = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, base + '-field-config.json'), 'utf8'));
    const result = await sanitizePdfFields(decrypt(source), config);
    const moved = await unoverlapLabels(result.bytes);
    const rebuilt = await applyRects(result.bytes, moved);
    const after = result.fieldNames;
    const target = path.join(OUT_DIR, base + '.pdf');
    const before = fs.existsSync(target) ? await names(fs.readFileSync(target)) : [];

    const added = after.filter((n) => !before.includes(n));
    const removed = before.filter((n) => !after.includes(n));
    console.log(base + ': ' + after.length + ' fields'
      + '  (renamed ' + result.renamedCount + ', skipped ' + result.skippedCount + ')'
      + (added.length ? '  +' + added.length : '') + (removed.length ? '  -' + removed.length : ''));
    added.forEach((n) => console.log('    + ' + n));
    removed.forEach((n) => console.log('    - ' + n));
    moved.forEach((m) => console.log('    box lowered off its own label: ' + m.name + ' (page ' + m.page + ', top ' + m.from + ' -> ' + m.to + ')'));
    if (!CHECK) {
      fs.writeFileSync(target, rebuilt);
      console.log('    written to ' + target);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
