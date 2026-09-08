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

configs.forEach((entry, form) => {
  if (!CHECK) fs.writeFileSync(entry.file, JSON.stringify(entry.data, null, 2));
  console.log(form + ': ' + entry.changed + ' field(s) renamed' + (CHECK ? ' (check only)' : ''));
});
if (missing) process.exitCode = 1;
console.log(CHECK ? '\ncheck only — nothing written' : '\nnow re-run pipeline-sanitize.js for the forms above');
