#!/usr/bin/env node
/**
 * Why is this PDF field still empty?
 *
 * Rule 4a allows a blank field only when the answers ruled it out. That has to
 * be shown, not assumed: this walks back from an empty field to the question
 * that produces it, then up its conditional chain, and reports the answer that
 * closed the gate. A field whose question exists, whose gates are all open, and
 * which is still empty is a defect, not a branch.
 *
 * Usage: node pipeline-explain.js <form-base> [--gui f.json] [--answers f.json]
 */
const fs = require('fs');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const BASE = args.find((a) => !a.startsWith('--')) || 'dv110';
const gui = JSON.parse(fs.readFileSync(flag('gui', 'dv-packet-gui.json'), 'utf8'));
const answers = JSON.parse(fs.readFileSync(flag('answers', 'pipeline-answers.json'), 'utf8'));
const readback = JSON.parse(fs.readFileSync(flag('readback', 'pipeline-out/' + BASE + '-readback.json'), 'utf8'));
// Fields the form says the court completes are blank on purpose, so they are
// not "unmapped" - they are the packet doing what the printed instruction says.
const configPath = flag('config', 'dv-field-configs/' + BASE + '-field-config.json');
const courtUse = new Set(fs.existsSync(configPath)
  ? (JSON.parse(fs.readFileSync(configPath, 'utf8')).fields || [])
      .filter((f) => f.courtUse === true).map((f) => f.newName)
  : []);

const questions = new Map();     // questionId -> question
const byName = new Map();        // posted name -> question
gui.sections.forEach((s) => (s.questions || []).forEach((q) => {
  questions.set(String(q.questionId), Object.assign({ section: s.sectionName }, q));
  if (q.nameId) byName.set(q.nameId, q);
  (((q.hiddenLogic || {}).configs) || []).forEach((h) => { if (h.nodeId) byName.set(h.nodeId, q); });
  // A combined question posts one field per box, by the box's own id.
  if (q.type === 'multipleTextboxes') {
    (q.allFieldsInOrder || []).forEach((f) => { if (f.nodeId) byName.set(f.nodeId, q); });
  }
  // A numbered block produces one field per entry; {n} says where the number goes.
  const max = parseInt(q.max, 10);
  if (q.type === 'numberedDropdown' && max > 0) {
    (q.allFieldsInOrder || []).forEach((f) => {
      if (!f.nodeId) return;
      for (let n = 1; n <= max; n++) {
        byName.set(f.nodeId.indexOf('{n}') !== -1
          ? f.nodeId.split('{n}').join(String(n)) : f.nodeId + '_' + n, q);
      }
    });
  }
}));

/** The answer the fill actually gave a question, as the form posted it. */
function answerOf(q) {
  if (!q) return null;
  if (answers[q.nameId] !== undefined) return answers[q.nameId];
  const ticked = (((q.hiddenLogic || {}).configs) || [])
    .filter((h) => answers[h.nodeId] !== undefined).map((h) => h.trigger);
  return ticked.length ? ticked.join(' + ') : null;
}

/** Walk the "show this when question N answered X" chain to the first closed gate. */
function gateChain(q, seen = new Set()) {
  const chain = [];
  let current = q;
  while (current && !seen.has(String(current.questionId))) {
    seen.add(String(current.questionId));
    const conds = ((current.logic || {}).enabled && current.logic.conditions) || [];
    if (!conds.length) break;
    const cond = conds[0];
    const gate = questions.get(String(cond.prevQuestion));
    const given = answerOf(gate);
    const wanted = String(cond.prevAnswer || '');
    const open = wanted.toLowerCase() === 'any text'
      ? given != null && String(given).trim() !== ''
      : String(given || '').toLowerCase().includes(wanted.toLowerCase());
    chain.push({
      gateId: cond.prevQuestion,
      gate: gate ? gate.text : '(no question ' + cond.prevQuestion + ')',
      wanted, given, open, missing: !gate
    });
    if (!open) break;
    current = gate;
  }
  return chain;
}

const empty = readback.filter((f) => f.kind === 'text' && String(f.value).trim() === '');
console.log(BASE + ': ' + empty.length + ' empty text field(s)\n');

const verdicts = { branch: [], defect: [], unmapped: [], court: [] };
empty.forEach((f) => {
  if (courtUse.has(f.name)) { verdicts.court.push({ field: f.name }); return; }
  const q = byName.get(f.name);
  if (!q) { verdicts.unmapped.push({ field: f.name }); return; }
  const chain = gateChain(q);
  const closed = chain.find((c) => !c.open);
  const entry = { field: f.name, question: q.text, questionId: q.questionId, chain, closed };
  (closed ? verdicts.branch : verdicts.defect).push(entry);
});

const show = (title, list, withChain) => {
  console.log(title + ' (' + list.length + ')');
  list.forEach((e) => {
    console.log('  - ' + e.field + (e.question ? '\n      question: ' + e.question : ''));
    if (withChain && e.closed) {
      console.log('      closed by q' + e.closed.gateId + ': ' + e.closed.gate);
      console.log('        wanted "' + e.closed.wanted + '", answered ' + JSON.stringify(e.closed.given));
    }
    if (withChain && !e.closed && e.chain.length === 0) {
      console.log('      no conditional logic — this question is always shown');
    }
  });
  console.log('');
};

show('BRANCH — a gate the answers closed', verdicts.branch, true);
show('DEFECT — question exists, gates open, still empty', verdicts.defect, true);
show('UNMAPPED — no question produces this field (rule 1)', verdicts.unmapped, false);
console.log('LEFT FOR THE COURT — blank by design (' + verdicts.court.length + ')');
if (verdicts.court.length) {
  console.log('  ' + verdicts.court.map((e) => e.field).join(', '));
}
