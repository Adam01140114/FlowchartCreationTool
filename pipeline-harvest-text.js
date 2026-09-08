#!/usr/bin/env node
/**
 * Move authored question wording out of a built artifact and into the hints.
 *
 * Question text is interview knowledge: "What is your person_asking_protection_
 * mailing_zip_code?" is what a field name gives you, and "What is your ZIP
 * code?" is what someone wrote. When that wording only exists inside a compiled
 * flowchart, the next recompile silently throws it away - which is exactly what
 * happened here. Hints are the layer that survives a recompile, so the wording
 * belongs there.
 *
 * Reads a previously exported packet GUI JSON, and for every question writes the
 * text (and, for a grouped choice, the option labels in member order) into the
 * hints file of the form that owns it.
 *
 * Usage: node pipeline-harvest-text.js old-packet-gui.json [--write]
 */
const fs = require('fs');

const args = process.argv.slice(2);
const SOURCE = args.find((a) => !a.startsWith('--')) || 'dv-packet-gui.json';
const WRITE = args.includes('--write');
const HINTS = { 'DV-100': 'dv100-hints.json', 'DV-109': 'dv109-hints.json', 'DV-110': 'dv110-hints.json' };

const gui = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const formOf = (sectionId) => {
  const form = (gui.projectForms || []).find((f) => sectionId >= f.firstSection && sectionId <= f.lastSection);
  return form ? form.name.split(' ')[0] : null;
};

const harvest = {};   // form -> { texts: {nameId: text}, labels: {nameId: {memberNodeId: label}} }
Object.keys(HINTS).forEach((f) => { harvest[f] = { texts: {}, labels: {} }; });

gui.sections.forEach((section) => {
  const form = formOf(Number(section.sectionId));
  if (!form || !harvest[form]) return;
  (section.questions || []).forEach((q) => {
    if (!q.nameId || !q.text) return;
    harvest[form].texts[q.nameId] = q.text;
    // A grouped choice keeps the option wording in its hiddenLogic: each config
    // pairs the option's label (trigger) with the PDF field it ticks (nodeId).
    const configs = ((q.hiddenLogic || {}).configs) || [];
    const byMember = {};
    configs.forEach((c) => { if (c.nodeId && c.trigger) byMember[c.nodeId] = c.trigger; });
    if (Object.keys(byMember).length) harvest[form].labels[q.nameId] = byMember;
  });
});

Object.entries(HINTS).forEach(([form, file]) => {
  if (!fs.existsSync(file)) return;
  const hints = JSON.parse(fs.readFileSync(file, 'utf8'));
  hints.questions = hints.questions || {};
  hints.groups = hints.groups || [];

  let textAdded = 0, textKept = 0, labelled = 0;
  Object.entries(harvest[form].texts).forEach(([nameId, text]) => {
    const existing = hints.questions[nameId];
    if (existing && existing.text) { textKept += 1; return; }   // a later edit wins
    hints.questions[nameId] = Object.assign({}, existing, { text });
    textAdded += 1;
  });

  hints.groups.forEach((group) => {
    const byMember = harvest[form].labels[group.nameId];
    if (!byMember || group.labels) return;
    const labels = (group.members || []).map((m) => byMember[m]);
    if (labels.every(Boolean)) { group.labels = labels; labelled += 1; }
  });

  console.log(form + ': +' + textAdded + ' question texts (' + textKept + ' already in hints), '
    + labelled + ' group(s) given option labels');
  if (WRITE) fs.writeFileSync(file, JSON.stringify(hints, null, 2));
});

console.log(WRITE ? '\nhints updated' : '\ndry run — pass --write to save');
