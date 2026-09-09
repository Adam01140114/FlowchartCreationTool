#!/usr/bin/env node
/**
 * Publish the page images I actually looked at.
 *
 * The page-image audit is the last and least skippable step, and it used to end
 * with me describing what I saw. That asks you to take my word for it. This
 * copies the exact images the audit read into one folder, one subfolder per
 * form, so the pages under discussion are the same pages on both sides.
 *
 *   Current Form Output/
 *     DV100/  page-01.png ... page-13.png
 *     DV101/  page-01.png  page-02.png
 *     ...
 *     README.txt      when this was rendered, from which answers
 *
 * The folder is replaced rather than merged, because a leftover page from an
 * older run is worse than no page at all: it looks current and is not. Page
 * numbers are zero-padded so ten sorts after nine.
 *
 * Usage: node pipeline-current-output.js [--from pipeline-out] [--to "Current Form Output"]
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf('--' + name);
  return at >= 0 ? args[at + 1] : fallback;
};
const FROM = flag('from', 'pipeline-out');
const TO = flag('to', 'Current Form Output');

/** DV-100's images live in dv100-pages; the folder people say out loud is DV100. */
function folderNameFor(base) {
  return base.toUpperCase();
}

function pageNumber(file) {
  const m = /page-(\d+)\./.exec(file);
  return m ? Number(m[1]) : 0;
}

function main() {
  if (!fs.existsSync(FROM)) {
    console.error('No ' + FROM + ' to publish. Run pipeline-fill.js --render first.');
    process.exit(1);
  }
  const sources = fs.readdirSync(FROM)
    .filter((name) => name.endsWith('-pages'))
    .filter((name) => fs.statSync(path.join(FROM, name)).isDirectory());

  if (!sources.length) {
    console.error('No rendered pages in ' + FROM + '. Run pipeline-fill.js --render first.');
    process.exit(1);
  }

  fs.rmSync(TO, { recursive: true, force: true });
  fs.mkdirSync(TO, { recursive: true });

  const lines = [];
  const manifest = { publishedAt: new Date().toISOString(), forms: [] };
  let total = 0;
  sources.sort().forEach((source) => {
    const base = source.replace(/-pages$/, '');
    const target = path.join(TO, folderNameFor(base));
    fs.mkdirSync(target, { recursive: true });

    const pages = fs.readdirSync(path.join(FROM, source))
      .filter((f) => /^page-\d+\.png$/i.test(f))
      .sort((a, b) => pageNumber(a) - pageNumber(b));

    pages.forEach((file) => {
      const n = String(pageNumber(file)).padStart(2, '0');
      fs.copyFileSync(path.join(FROM, source, file), path.join(target, 'page-' + n + '.png'));
    });
    total += pages.length;

    // What the PDF actually ended up holding, beside the pictures of it. The
    // images show where a value printed; this shows what the field is called
    // and what is in it, which is the other half of reading an output and the
    // half you cannot get by looking.
    const readback = path.join(FROM, base + '-readback.json');
    let counts = { text: 0, checkbox: 0, ticked: 0, filled: 0 };
    if (fs.existsSync(readback)) {
      const fields = JSON.parse(fs.readFileSync(readback, 'utf8'));
      fields.forEach((f) => {
        if (f.kind === 'checkbox') {
          counts.checkbox++;
          if (f.value === true || f.value === 'on' || f.value === 'Yes') counts.ticked++;
        } else {
          counts.text++;
          if (String(f.value == null ? '' : f.value).trim() !== '') counts.filled++;
        }
      });
      fs.writeFileSync(path.join(target, 'fields.json'), JSON.stringify(fields, null, 1));
    }

    manifest.forms.push({ name: folderNameFor(base), pages: pages.length, fields: counts });
    lines.push('  ' + folderNameFor(base).padEnd(8) + pages.length + ' page(s)');
    console.log('  ' + folderNameFor(base).padEnd(8) + pages.length + ' page(s)');
  });

  const filled = fs.existsSync(FROM)
    ? fs.readdirSync(FROM).filter((f) => f.endsWith('-filled.pdf')).sort()
    : [];
  const answers = 'pipeline-answers.json';
  const stamp = fs.existsSync(answers)
    ? fs.statSync(answers).mtime.toISOString()
    : new Date().toISOString();

  fs.writeFileSync(path.join(TO, 'README.txt'), [
    'These are the page images of the filled PDFs, exactly as the last audit read',
    'them. One folder per form; page numbers are zero-padded so they sort.',
    '',
    'Rendered from : ' + filled.join(', '),
    'Answers dated : ' + stamp,
    'Published     : ' + new Date().toISOString(),
    '',
  ].concat(lines).concat([
    '',
    'Regenerate with:',
    '  node pipeline-fill.js --render',
    '  node pipeline-current-output.js',
    '',
  ]).join('\n'));

  // The dashboard polls this rather than guessing what is on disk.
  fs.writeFileSync(path.join(TO, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\npublished ' + total + ' page(s) to ' + TO + path.sep);
}

main();
