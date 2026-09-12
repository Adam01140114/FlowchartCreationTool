#!/usr/bin/env node
/**
 * Apply form_connections — make one answer fill every form that prints it.
 *
 * A packet asks for the same values on every cover form: the protected person's
 * name is item 1 of DV-110, item 1 of DV-109 and the top of DV-100. Each PDF
 * calls it something different, so without this the interview asks three times
 * and a survivor retypes their abuser's name on every form.
 *
 * The connections file names one canonical field - DV-100's, since that is the
 * form the filer completes - and the aliases each other form uses. Renaming the
 * alias in that form's field config is enough: the packet export then sees one
 * nameId, asks once, and the filler writes the answer into every PDF that has a
 * field by that name.
 *
 * Usage: node pipeline-connect.js [connections.json] [--check]
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const FILE = args.find((a) => !a.startsWith('--')) || 'dv-packet-connections.json';
const CONFIG_DIR = 'dv-field-configs';

const spec = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const configs = new Map();

function load(form) {
  if (!configs.has(form)) {
    const file = path.join(CONFIG_DIR, form + '-field-config.json');
    configs.set(form, { file, data: JSON.parse(fs.readFileSync(file, 'utf8')), changed: 0 });
  }
  return configs.get(form);
}

let missing = 0;
Object.entries(spec.canonical || {}).forEach(([canonical, byForm]) => {
  Object.entries(byForm).forEach(([form, aliases]) => {
    const entry = load(form);
    aliases.forEach((alias) => {
      const hits = entry.data.fields.filter((f) => f.newName === alias);
      // A second run finds the alias already renamed. That is the connection
      // made, not a field gone missing - it used to exit 1 on every re-run.
      if (!hits.length && entry.data.fields.some((f) => f.connectedFrom === alias && f.newName === canonical)) {
        return;
      }
      if (!hits.length) {
        console.log('  ! ' + form + ': no field named ' + alias);
        missing += 1;
        return;
      }
      hits.forEach((f) => {
        f.newName = canonical;
        f.connectedFrom = alias;
        entry.changed += 1;
      });
      console.log('  ' + form + ': ' + alias + '  ->  ' + canonical + (hits.length > 1 ? '  x' + hits.length : ''));
    });
  });
});

/* ------------------------------------------------------------------ */
/* the inverse rule: a court field must not share a filer's name       */
/* ------------------------------------------------------------------ */

/**
 * Sharing a name is how this packet wires one answer into every form that
 * prints it - which makes an accidental share indistinguishable from a
 * deliberate one, and there is one kind that is never deliberate.
 *
 * DV-110 says the filer completes items 1, 2 and 3 and the court completes the
 * rest. Its item 6 is a court FINDING - "The court finds that you have the
 * following prohibited items" - and its field for the first firearm was called
 * firearm_item_1_description, the same as the box on DV-100 where the filer
 * lists what they believe the person has. So the filer's claim was posted
 * straight into the judge's finding, and the same for item 12a's stay-away
 * grant. Nine fields, and the filled order read as though the court had already
 * decided.
 *
 * A field the form says the court completes is marked courtUse, so the rule
 * needs no list: a courtUse field may not carry a name that a filer field
 * somewhere in the packet also carries. Where it does, the court's copy is
 * renamed with its own form in front, and the answer stops reaching it.
 */
function separateCourtFieldsFromFilerFields(spec, load, check) {
  const forms = (spec.forms || Object.keys(spec.canonical || {}).reduce((all, key) => {
    Object.keys(spec.canonical[key]).forEach((f) => { if (!all.includes(f)) all.push(f); });
    return all;
  }, [])).slice();

  const filerNames = new Set();
  forms.forEach((form) => {
    load(form).data.fields.forEach((f) => { if (!f.courtUse) filerNames.add(f.newName); });
  });

  let renamed = 0;
  forms.forEach((form) => {
    const entry = load(form);
    entry.data.fields.forEach((f) => {
      if (!f.courtUse || !filerNames.has(f.newName)) return;
      const separated = form + '_' + f.newName;
      console.log('  ' + form + ': court field ' + f.newName + '  ->  ' + separated
        + '   (a filer answers a field of that name)');
      f.courtSeparatedFrom = f.newName;
      f.newName = separated;
      entry.changed += 1;
      renamed += 1;
    });
  });
  if (renamed) {
    console.log(renamed + ' court field(s) separated from a filer field of the same name'
      + (check ? ' (check only)' : ''));
  }
  return renamed;
}

const CONFIG_FORMS = require('./packet-forms').packetForms({ withConfig: true });
const separated = separateCourtFieldsFromFilerFields(
  Object.assign({ forms: CONFIG_FORMS }, spec), load, CHECK);

configs.forEach((entry, form) => {
  if (!CHECK) fs.writeFileSync(entry.file, JSON.stringify(entry.data, null, 2));
  console.log(form + ': ' + entry.changed + ' field(s) renamed' + (CHECK ? ' (check only)' : ''));
});
if (missing) process.exitCode = 1;
if (CHECK && separated) process.exitCode = 1;
console.log(CHECK ? '\ncheck only — nothing written' : '\nnow re-run pipeline-sanitize.js for the forms above');
