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
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf('--' + name);
  return at >= 0 ? args[at + 1] : fallback;
};
const FROM = flag('from', 'pipeline-out');
const PROJECT = flag('project', '');
const TO = flag('to', 'Current Form Output');

/**
 * Every field on every page, with what it ended up holding - including the
 * ones it did not.
 *
 * The readback lists what the PDF holds; this asks the PDF itself which page
 * each widget sits on, so a page can show its own fields. Empty fields are the
 * point rather than an oversight: a blank on a filed form is the thing worth
 * knowing about, and a list that quietly omits them is a list that says
 * everything is fine.
 */
async function fieldsByPage(pdfFile) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(pdfFile)), isEvalSupported: false,
    standardFontDataUrl: path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep,
  }).promise;

  const pages = {};
  const seen = new Set();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const rows = [];
    (await page.getAnnotations())
      .filter((a) => a.subtype === 'Widget' && a.fieldName)
      .forEach((a) => {
        // A field printed on several pages is one field; show it on each page
        // it appears, but only once per page.
        const key = n + '|' + a.fieldName;
        if (seen.has(key)) return;
        seen.add(key);
        const kind = a.checkBox || a.radioButton ? 'checkbox'
          : (a.pushButton ? 'button' : 'text');
        let value;
        if (kind === 'checkbox') {
          value = !!(a.fieldValue && String(a.fieldValue) !== 'Off');
        } else {
          value = a.fieldValue == null ? '' : String(a.fieldValue);
        }
        rows.push({ name: a.fieldName, kind, value,
          y: Math.round(page.view[3] - Math.max(a.rect[1], a.rect[3])),
          x: Math.round(Math.min(a.rect[0], a.rect[2])) });
      });
    // Down the page and across, the order a reader meets them.
    rows.sort((p, q) => (p.y - q.y) || (p.x - q.x));
    pages[n] = rows.map((r) => ({ name: r.name, kind: r.kind, value: r.value }));
  }
  return pages;
}

/** DV-100's images live in dv100-pages; the folder people say out loud is DV100. */
function folderNameFor(base) {
  return base.toUpperCase();
}

function pageNumber(file) {
  const m = /page-(\d+)\./.exec(file);
  return m ? Number(m[1]) : 0;
}

async function main() {
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

  // Published under the project it belongs to, so two projects do not write
  // over each other's output and a link handed out for one keeps pointing at
  // that one.
  let projectId = PROJECT;
  if (!projectId) {
    try {
      projectId = String(JSON.parse(fs.readFileSync('pipeline-answers.json', 'utf8')).__projectId || '');
    } catch (e) { /* no answers file */ }
  }
  if (!projectId) {
    try {
      projectId = String(JSON.parse(fs.readFileSync('dv-packet-project.json', 'utf8')).projectId || '');
    } catch (e) { /* no project file */ }
  }
  if (!projectId) projectId = 'default';

  const root = path.join(TO, projectId);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });

  // Output used to live at the top level, before it was filed under a project.
  // Those leftovers look like a project's folder to anyone reading the
  // directory and are not one, so they go the first time a project publishes.
  fs.readdirSync(TO).forEach((name) => {
    if (name === 'index.json' || name.startsWith('p_')) return;
    fs.rmSync(path.join(TO, name), { recursive: true, force: true });
    console.log('  removed pre-project leftover: ' + name);
  });

  const lines = [];
  const manifest = { publishedAt: new Date().toISOString(), forms: [] };
  let total = 0;
  for (const source of sources.sort()) {
    const base = source.replace(/-pages$/, '');
    const target = path.join(root, folderNameFor(base));
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
    const filledPdf = path.join(FROM, base + '-filled.pdf');
    let counts = { text: 0, checkbox: 0, ticked: 0, filled: 0 };
    if (fs.existsSync(filledPdf)) {
      const byPage = await fieldsByPage(filledPdf);
      Object.keys(byPage).forEach((n) => byPage[n].forEach((f) => {
        if (f.kind === 'button') return;
        if (f.kind === 'checkbox') { counts.checkbox++; if (f.value) counts.ticked++; }
        else { counts.text++; if (String(f.value).trim() !== '') counts.filled++; }
      }));
      fs.writeFileSync(path.join(target, 'fields.json'), JSON.stringify(byPage, null, 1));

      // Why each blank is blank. A blank the answers account for and a blank
      // nobody can explain look identical on a page, and only one of them is a
      // defect - so the page should be able to say which it is looking at
      // rather than leaving a reader to count empties and worry.
      try {
        const out = execFileSync(process.execPath,
          ['pipeline-explain.js', base, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        fs.writeFileSync(path.join(target, 'why.json'), out);
      } catch (e) {
        // A non-zero exit means it found a defect and still printed the JSON.
        if (e && e.stdout) fs.writeFileSync(path.join(target, 'why.json'), e.stdout);
      }
    }

    manifest.forms.push({ name: folderNameFor(base), pages: pages.length, fields: counts });
    lines.push('  ' + folderNameFor(base).padEnd(8) + pages.length + ' page(s)');
    console.log('  ' + folderNameFor(base).padEnd(8) + pages.length + ' page(s)');
  }

  const filled = fs.existsSync(FROM)
    ? fs.readdirSync(FROM).filter((f) => f.endsWith('-filled.pdf')).sort()
    : [];
  const answers = 'pipeline-answers.json';
  const stamp = fs.existsSync(answers)
    ? fs.statSync(answers).mtime.toISOString()
    : new Date().toISOString();

  manifest.projectId = projectId;
  fs.writeFileSync(path.join(root, 'README.txt'), [
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
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // A directory of what has been published, so the dashboard can offer a
  // project when the link does not name one.
  const indexFile = path.join(TO, 'index.json');
  let index = [];
  try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch (e) { index = []; }
  index = index.filter((p) => p && p.id !== projectId);
  index.unshift({ id: projectId, publishedAt: manifest.publishedAt, pages: total,
    forms: manifest.forms.map((f) => f.name) });
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));

  console.log('\npublished ' + total + ' page(s) to ' + root + path.sep);
  console.log('  ' + 'http://127.0.0.1:8080/form-output-dashboard.html?project=' + projectId);
}

main().catch((e) => { console.error(e); process.exit(1); });
