#!/usr/bin/env node
/**
 * Audit the flowchart itself, not the interview it exports to.
 *
 * pipeline-audit.js reads the packet GUI JSON - what the flowchart *became*.
 * That misses anything the export quietly repairs or drops, and the flowchart is
 * the artifact a person opens, edits and reviews. A chart can export a clean
 * interview and still be unreadable: a question with no way in, an option under
 * no question, an End nobody reaches, a node whose text is a raw field name.
 *
 * Structural only. Whether the interview reads well is rule 2 and a human read
 * (pipeline-review.js); this checks the graph is sound.
 *
 * Usage:  node pipeline-audit-flowchart.js [project.json]
 */
const fs = require('fs');

const args = process.argv.slice(2);
const FILE = args.find((a) => !a.startsWith('--') && a.endsWith('.json')) || 'dv-packet-project.json';

const styleOf = (c) => String(c.style || '');
const attr = (c, k) => { const m = new RegExp(k + '=([^;]*)').exec(styleOf(c)); return m ? m[1] : ''; };
const nodeType = (c) => attr(c, 'nodeType');
const nodeId = (c) => attr(c, 'nodeId');
const plain = (v) => String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const RAW_NAME = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;
const ACROFORM_PATH = /\[\d+\]|\b(page|list|li)\s?\d+\s?\[|\b(tf|cb)\b\s?\[/i;

const project = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const forms = project.forms || [{ name: project.formName || 'form', flowchart: project }];

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAILS  ' + msg); };

forms.forEach((entry) => {
  const chart = entry.flowchart || {};
  const cells = chart.cells || [];
  const vertices = cells.filter((c) => c.vertex);
  const edges = cells.filter((c) => c.edge);
  const byId = new Map(vertices.map((c) => [String(c.id), c]));
  formFailures = 0;

  console.log('');
  console.log('='.repeat(70));
  console.log((entry.name || 'form') + '   ' + vertices.length + ' nodes, ' + edges.length + ' edges');
  console.log('='.repeat(70));

  const incoming = new Map();
  const outgoing = new Map();
  edges.forEach((e) => {
    const s = String(e.source), t = String(e.target);
    if (!outgoing.has(s)) outgoing.set(s, []);
    if (!incoming.has(t)) incoming.set(t, []);
    outgoing.get(s).push(t);
    incoming.get(t).push(s);
  });

  // 1. Every edge joins two nodes that exist. A dangling edge draws to nowhere
  //    and silently drops whatever hung off it on export.
  const dangling = edges.filter((e) => !byId.has(String(e.source)) || !byId.has(String(e.target)));
  if (dangling.length) fail(dangling.length + ' edge(s) point at a node that is not in the chart');

  // 2. Reachability from the first question. An unreachable node is a question
  //    nobody can ever be asked, which the export cannot tell from a deliberate
  //    branch - it just never appears.
  const questions = vertices.filter((c) => nodeType(c) === 'question');
  const start = questions[0];
  if (!start) fail('no question nodes at all');
  const seen = new Set();
  if (start) {
    const stack = [String(start.id)];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      (outgoing.get(id) || []).forEach((t) => stack.push(t));
    }
    // A linked-logic node is deliberately wired to nothing: it is a rule about
    // fields, not a step in the interview.
    // linkedLogic is a rule about fields, and a connector wired to nothing means
    // "these two forms always travel together" - neither is a missed step.
    const DETACHED_BY_DESIGN = new Set(['linkedLogic', 'connector']);
    const orphans = vertices.filter((c) => !seen.has(String(c.id)) && !DETACHED_BY_DESIGN.has(nodeType(c)));
    if (orphans.length) {
      fail(orphans.length + ' node(s) cannot be reached from the first question: '
        + orphans.slice(0, 5).map((c) => nodeId(c) || plain(c.value).slice(0, 24) || c.id).join(', ')
        + (orphans.length > 5 ? ', ...' : ''));
    }
  }

  // 3. Every path ends. A question with no way out leaves the filer stranded
  //    mid-interview with no Next.
  const ends = vertices.filter((c) => nodeType(c) === 'end');
  if (!ends.length) fail('no End node');
  const deadEnds = vertices.filter((c) => {
    const t = nodeType(c);
    if (t === 'end' || t === 'linkedLogic' || t === 'connector') return false;
    return !(outgoing.get(String(c.id)) || []).length;
  });
  if (deadEnds.length) {
    fail(deadEnds.length + ' node(s) have no outgoing edge and are not an End: '
      + deadEnds.slice(0, 5).map((c) => nodeId(c) || plain(c.value).slice(0, 24) || c.id).join(', ')
      + (deadEnds.length > 5 ? ', ...' : ''));
  }

  // 4. An option belongs to a question. One hanging off nothing exports as an
  //    orphan and its answer reaches no PDF field.
  const strayOptions = vertices.filter((c) => nodeType(c) === 'options'
    && !(incoming.get(String(c.id)) || []).length);
  if (strayOptions.length) fail(strayOptions.length + ' option node(s) hang off no question');

  // 5. Nothing a person reads is a field name or a raw AcroForm path. The same
  //    rule as the interview's, applied where an operator sees it too.
  const named = [];
  vertices.forEach((c) => {
    const t = nodeType(c);
    if (t !== 'question' && t !== 'options') return;
    const text = plain(c._questionText || c.value);
    if (!text) return;
    if (RAW_NAME.test(text) || ACROFORM_PATH.test(text)) named.push((nodeId(c) || c.id) + ': "' + text.slice(0, 46) + '"');
  });
  if (named.length) {
    fail(named.length + ' node(s) show a field name: ' + named.slice(0, 4).join('  |  '));
  }

  // 6. Two questions must not claim the same nodeId - the second silently wins
  //    in the generated form and the first fills nothing.
  const idCount = new Map();
  questions.forEach((c) => {
    const id = nodeId(c);
    if (!id) return;
    idCount.set(id, (idCount.get(id) || 0) + 1);
  });
  const dupes = [...idCount.entries()].filter(([, n]) => n > 1);
  if (dupes.length) fail('duplicate nodeId: ' + dupes.map(([k, n]) => k + ' x' + n).join(', '));

  // 7. A question with no nodeId cannot be wired to a PDF field at all.
  const unnamed = questions.filter((c) => !nodeId(c));
  if (unnamed.length) fail(unnamed.length + ' question(s) have no nodeId');

  // 8. Geometry: nodes must not overlap, or the chart cannot be read.
  const boxes = vertices.filter((c) => c.geometry).map((c) => ({ c, g: c.geometry }));
  let overlaps = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].g, b = boxes[j].g;
      if (a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height) overlaps++;
    }
  }
  if (overlaps) fail(overlaps + ' pair(s) of nodes overlap');

  if (!formFailures) console.log('  passes');
  console.log('  ' + questions.length + ' question(s), ' + ends.length + ' End node(s), '
    + vertices.filter((c) => nodeType(c) === 'options').length + ' option(s), '
    + vertices.filter((c) => nodeType(c) === 'linkedLogic').length + ' linked-logic node(s)');
});

console.log('');
console.log(failures ? failures + ' failure(s)' : 'flowchart audit clean');
process.exitCode = failures ? 1 : 0;
