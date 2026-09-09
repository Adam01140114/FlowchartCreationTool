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
const { PDFDocument } = require('pdf-lib');
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

async function names(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getForm().getFields().map((f) => f.getName());
}

async function main() {
  for (const base of (FORMS.length ? FORMS : ['dv100', 'dv109', 'dv110'])) {
    const source = base + '.pdf';
    const config = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, base + '-field-config.json'), 'utf8'));
    const result = await sanitizePdfFields(decrypt(source), config);
    const rebuilt = result.bytes;
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
    if (!CHECK) {
      fs.writeFileSync(target, rebuilt);
      console.log('    written to ' + target);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
