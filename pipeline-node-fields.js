/**
 * The editor's PDF preview marks the boxes a selected node fills, and says in
 * red when a node fills nothing on its form. This holds that preview to what the
 * exported form really posts.
 *
 * For every question node of every form in the packet spec, the fields its
 * question posts - read by postedNames(), the same reading pipeline-audit.js
 * rule 1 uses - that exist on the form's own sanitized PDF are what the preview
 * must find. The preview's names come from node-field-names.js, the file the
 * editor loads, so this checks the rule the editor runs and not a copy of it.
 *
 * A joined box counts as filled by every question whose answers it joins
 * (court_name_and_street_address by both court questions). A node whose
 * question is asked once in another form has no GUI question of its own; there
 * the preview must find the node's own field, and must not mark a box that
 * nothing in the packet fills.
 *
 *   shown red       the node fills a box on this PDF and the preview finds none:
 *                   it would tell a person that a wired node is broken
 *   not all marked  it finds some of the boxes the node fills, not all of them
 *   marks another   it marks a box this node does not fill
 *
 * It was written after the preview showed 152 of the packet's 288 question
 * nodes in red - every checkbox and dropdown question, most multi-textbox
 * questions, every numbered block - while all of them were wired.
 *
 * Usage: node pipeline-node-fields.js [dv-packet-gui.json] [--spec dv-packet.spec.json] [--verbose]
 * Exit 1 when any node would be shown red, would mark only some of the boxes it
 * fills, or would mark a box it does not fill.
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { postedNames } = require('./pipeline-audit');
const { namesOf, joinsFromCells } = require('./node-field-names');

const args = process.argv.slice(2);
const GUI = args.find((a) => !a.startsWith('--') && a.endsWith('.json')) || 'dv-packet-gui.json';
const specAt = args.indexOf('--spec');
const SPEC = specAt !== -1 ? args[specAt + 1] : 'dv-packet.spec.json';
const VERBOSE = args.includes('--verbose');
const PDF_DIR = path.join(__dirname, 'FormWiz GUI');

const isQuestion = (c) => /nodeType=question/.test(String((c && c.style) || ''));

/** What one question posts - postedNames() asked about that question alone. */
function postedBy(question) {
  return postedNames({ sections: [{ questions: [question] }] }).names;
}

/** The cells each cell's arrows lead to, from the saved flowchart. */
function targetsFrom(cells) {
  const byId = new Map(cells.map((c) => [String(c.id), c]));
  const out = new Map();
  cells.forEach((c) => {
    if (!c.edge || c.source == null || c.target == null) return;
    const from = String(c.source);
    const to = byId.get(String(c.target));
    if (!to) return;
    if (!out.has(from)) out.set(from, []);
    out.get(from).push(to);
  });
  return (cell) => out.get(String(cell.id)) || [];
}

async function fieldNamesOn(file) {
  const doc = await PDFDocument.load(fs.readFileSync(file), { ignoreEncryption: true });
  return doc.getForm().getFields().map((f) => f.getName());
}

async function main() {
  const gui = JSON.parse(fs.readFileSync(GUI, 'utf8'));
  const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));

  // A question asked once across the packet is one GUI question, whichever
  // form's chart the node is drawn in.
  const questionByName = new Map();
  (gui.sections || []).forEach((s) => (s.questions || []).forEach((q) => {
    [q.nameId, q.nodeId].forEach((n) => { if (n && !questionByName.has(n)) questionByName.set(n, q); });
  }));

  // Every name the form posts, and every box a join fills from them.
  const allPosted = postedNames(gui).names;
  const allPostedLower = new Set([...allPosted].map((n) => n.toLowerCase()));
  const joins = (gui.linkedFields || []).map((l) => ({ into: l.linkedFieldId, from: l.fields || [] }));
  const withJoins = (names) => {
    const out = new Set(names);
    joins.forEach((j) => { if (j.into && j.from.some((n) => out.has(n))) out.add(j.into); });
    return out;
  };

  const results = [];
  for (const form of spec.forms || []) {
    const pdfFile = path.join(PDF_DIR, path.basename(form.pdf));
    if (!fs.existsSync(form.flowchart) || !fs.existsSync(pdfFile)) {
      results.push({ form: form.name, error: 'missing ' + (fs.existsSync(form.flowchart) ? pdfFile : form.flowchart) });
      continue;
    }
    const cells = JSON.parse(fs.readFileSync(form.flowchart, 'utf8')).cells || [];
    const targetsOf = targetsFrom(cells);
    // The chart's own joins, as the editor reads them - checked against the
    // export's linkedFields, which is where `fills` gets them.
    const joins = joinsFromCells(cells);
    // Compared without case, as the preview compares them.
    const onPdf = new Map((await fieldNamesOn(pdfFile)).map((n) => [n.toLowerCase(), n]));

    const r = { form: form.name, fills: 0, fillsNothing: 0, red: [], partial: [], another: [], askedElsewhere: 0 };
    cells.filter(isQuestion).forEach((cell) => {
      const id = cell._nameId || '';
      const question = questionByName.get(id);
      const marked = new Set(namesOf(cell, targetsOf, joins)
        .map((n) => n.toLowerCase()).filter((n) => onPdf.has(n)));
      let posts;
      if (question) {
        posts = postedBy(question);
      } else {
        r.askedElsewhere++;
        posts = new Set([id].concat(cell._mirrorTargets || []).filter((n) => allPosted.has(n)));
      }
      const fills = new Set([...withJoins(posts)]
        .map((n) => n.toLowerCase()).filter((n) => onPdf.has(n)));

      const extra = [...marked].filter((n) => (question ? !fills.has(n) : !allPostedLower.has(n)));
      if (extra.length) r.another.push({ node: id, boxes: extra.map((n) => onPdf.get(n)) });
      if (!fills.size) { r.fillsNothing++; return; }
      r.fills++;
      const missed = [...fills].filter((n) => !marked.has(n));
      if (missed.length === fills.size) r.red.push({ node: id, boxes: missed.map((n) => onPdf.get(n)) });
      else if (missed.length) r.partial.push({ node: id, of: fills.size, boxes: missed.map((n) => onPdf.get(n)) });
    });
    results.push(r);
  }

  const list = (items, show) => {
    const shown = VERBOSE ? items : items.slice(0, 8);
    shown.forEach((x) => console.log('      - ' + show(x)));
    if (shown.length < items.length) console.log('      ... and ' + (items.length - shown.length) + ' more (--verbose)');
  };
  const boxes = (b) => b.slice(0, 4).join(', ') + (b.length > 4 ? ', +' + (b.length - 4) : '');

  console.log('');
  console.log("THE EDITOR'S PDF PREVIEW — a node points at the boxes it fills");
  let red = 0, another = 0, partial = 0;
  results.forEach((r) => {
    if (r.error) { console.log('  ' + r.form.padEnd(10) + '  FAILS  ' + r.error); red++; return; }
    red += r.red.length; another += r.another.length; partial += r.partial.length;
    const verdict = (r.red.length || r.another.length || r.partial.length) ? 'FAILS ' : 'passes';
    console.log('  ' + r.form.padEnd(10) + '  ' + verdict + '  '
      + (r.fills - r.red.length - r.partial.length) + '/' + r.fills + ' nodes that fill a box have every box marked'
      + '   (' + r.fillsNothing + ' fill nothing on this PDF'
      + (r.askedElsewhere ? '; ' + r.askedElsewhere + ' asked in another form' : '') + ')');
    if (r.red.length) {
      console.log('    shown red, though wired:');
      list(r.red, (x) => x.node + '  fills ' + boxes(x.boxes));
    }
    if (r.another.length) {
      console.log('    marks a box it does not fill:');
      list(r.another, (x) => x.node + '  marks ' + boxes(x.boxes));
    }
    if (r.partial.length) {
      console.log('    not all of its boxes marked:');
      list(r.partial, (x) => x.node + '  misses ' + x.boxes.length + ' of ' + x.of + ': ' + boxes(x.boxes));
    }
  });
  console.log('');
  if (red || another || partial) {
    console.log('NOT SHIPPABLE - ' + red + ' node(s) shown red though wired, '
      + partial + ' marking only some of their boxes, '
      + another + ' marking a box they do not fill');
    process.exit(1);
  }
  console.log('Every node that fills a box on its PDF has every one of them marked there,'
    + ' and none marks a box it does not fill.');
}

main().catch((err) => { console.error(err); process.exit(1); });
