#!/usr/bin/env node
/**
 * Print the interview the way a person meets it, for a human to read.
 *
 * This is the step the audit cannot do. `pipeline-audit.js` only finds what
 * someone taught it to look for, so every rule it enforces was written after a
 * defect got through - it is a regression test, not a review. A packet reported
 * zero failures while asking
 *
 *     "Do you have a dV 100[0].Page4[0].List6[0].Li7[0].item26d tf[0]?"
 *
 * because the rule against showing a person a field name looked for
 * underscores, and the humanizer had already replaced them with spaces.
 *
 * Reading one pass of this output found four defects that broke no rule: that
 * raw AcroForm path, two whole blocks of questions with no gate in front of
 * them, a question about the restrained person asking for "your date of birth",
 * and an age asked as a currency amount.
 *
 * Usage:  node pipeline-review.js [packet-gui.json] [--section N] [--form NAME]
 */
const fs = require('fs');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const GUI = args.find((a) => !a.startsWith('--') && a.endsWith('.json')) || 'dv-packet-gui.json';
const ONLY_SECTION = flag('section', null);
const ONLY_FORM = flag('form', null);

const gui = JSON.parse(fs.readFileSync(GUI, 'utf8'));
const forms = gui.projectForms || [];
const formOf = (sectionId) => forms.find((f) => sectionId >= f.firstSection && sectionId <= f.lastSection);

const label = (o) => (o && typeof o === 'object') ? (o.label || o.text || o.value || '') : String(o);

/** What a question waits on, in the words the reader would use. */
function gateOf(q) {
  const conds = ((q.logic || {}).enabled && (q.logic || {}).conditions) || [];
  if (!conds.length) return '';
  return '   [shown when ' + conds
    .map((c) => 'q' + c.prevQuestion + ' = ' + c.prevAnswer)
    .join('  OR  ') + ']';
}

let shown = 0;
(gui.sections || []).forEach((section) => {
  const form = formOf(Number(section.sectionId));
  if (ONLY_FORM && (!form || form.name !== ONLY_FORM)) return;
  if (ONLY_SECTION && String(section.sectionId) !== String(ONLY_SECTION)) return;

  console.log('');
  console.log('='.repeat(78));
  console.log('SECTION ' + section.sectionId + '  ' + (section.sectionName || '')
    + (form ? '        (' + form.name + ')' : ''));
  console.log('='.repeat(78));

  (section.questions || []).forEach((q) => {
    shown++;
    const id = 'q' + String(q.questionId).padEnd(4);
    console.log('');
    console.log(id + '(' + q.type + ')  ' + (q.text || '(no text)'));
    const g = gateOf(q);
    if (g) console.log('      ' + g.trim());

    (q.options || []).forEach((o) => console.log('        o  ' + label(o)));

    // The boxes inside a combined or repeating question are read too, and are
    // where a field name most often survives.
    (q.allFieldsInOrder || []).forEach((f) => {
      if (f.type === 'checkbox') {
        console.log('        [ ' + (f.fieldName || '') + ' ]  ('
          + (f.selectionType === 'single' ? 'pick one' : 'pick any') + ')');
        (f.options || []).forEach((o) => console.log('           o  ' + (o.text || o.nodeId)));
        return;
      }
      // A dropdown box keeps its caption in fieldName - the page shows it as the
      // first option - so a box with no label is not a blank one.
      console.log('        _  ' + (f.label || f.fieldName || f.nodeId || '') + '   (' + f.type + ')');
    });
    if (q.type === 'numberedDropdown') {
      console.log('        repeats ' + q.min + '-' + q.max + ' times, each headed "'
        + (q.entryTitle || '(untitled)') + ' #n"');
    }
  });
});

console.log('');
console.log('-'.repeat(78));
console.log(shown + ' question(s). Read every one. What the audit cannot see:');
console.log('  - wording only a person holding the paper form could answer');
console.log('  - the wrong subject ("your date of birth" about someone else)');
console.log('  - a block of questions with no gate in front of it');
console.log('  - a control that does not suit the answer (an age as currency)');
console.log('  - two questions that read identically in the same section');
console.log('Then open the preview and answer each gate No, and confirm the');
console.log('block it guards actually disappears - correct logic in this output');
console.log('can still be overridden by how the form renders.');
