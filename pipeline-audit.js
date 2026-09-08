#!/usr/bin/env node
/**
 * Packet audit — the checks in form_quality_check.txt, run as a program.
 *
 * The rules were written to be run by hand, which means they were run once and
 * then trusted. This runs the static ones on demand:
 *
 *   Rule 1  every fillable PDF field is reachable from something the form posts
 *   Rule 3  no repeated <base>_<n>_<field> block left as flat numbered questions
 *   Rule 5  one group per form, named after the form, holding its sections
 *
 * Rule 4 is dynamic - it needs the form filled and the PDFs produced - and lives
 * in pipeline-fill.js. Rule 2 is about wording and stays a human read.
 *
 * Usage:
 *   node pipeline-audit.js [merged-gui.json] [--configs dir] [--pdfs dir] [--json]
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const GUI = args.find((a) => !a.startsWith('--') && a.endsWith('.json')) || 'dv-packet-gui.json';
const CONFIG_DIR = flag('configs', 'dv-field-configs');
const PDF_DIR = flag('pdfs', 'FormWiz GUI');
const AS_JSON = args.includes('--json');

/* ------------------------------------------------------------------ */
/* what the generated form posts                                       */
/* ------------------------------------------------------------------ */

/**
 * Mirrors dropdownMirror() in the generated form: an option's hidden checkbox is
 * <question nameId>_<slugged option text> unless hiddenLogic already names one.
 */
function slugOption(value) {
  return String(value || '').replace(/[^A-Za-z0-9_]+/g, '_').toLowerCase()
    .replace(/^_+|_+$/g, '');
}

function postedNames(gui) {
  const names = new Set();
  const owner = new Map();          // posted name -> question that produces it
  const add = (name, question) => {
    if (!name) return;
    names.add(name);
    if (!owner.has(name)) owner.set(name, question);
  };

  (gui.sections || []).forEach((section) => {
    (section.questions || []).forEach((q) => {
      add(q.nameId, q);
      const configs = ((q.hiddenLogic || {}).configs) || [];
      configs.forEach((h) => add(h.nodeId, q));
      // Options with no hiddenLogic entry still mirror into a hidden checkbox.
      const named = new Set(configs.map((h) => String(h.trigger || '')));
      (q.options || []).forEach((opt) => {
        const text = (opt && typeof opt === 'object') ? (opt.text || opt.label) : opt;
        if (!text || named.has(String(text))) return;
        if (opt && typeof opt === 'object' && opt.nameId) return add(opt.nameId, q);
        add(q.nameId + '_' + slugOption(text), q);
      });
      // A numbered block asks for entry 1..max. The field's own id says where
      // the number goes: {n} in the middle for a PDF that names its rows
      // firearm_item_3_description, appended otherwise.
      const max = parseInt(q.max, 10);
      if (q.type === 'numberedDropdown' && max > 0) {
        (q.allFieldsInOrder || q.textboxes || q.labels || []).forEach((field) => {
          const base = (field && typeof field === 'object') ? (field.nodeId || field.nameId) : null;
          if (!base) return;
          for (let n = 1; n <= max; n++) {
            add(base.indexOf('{n}') !== -1 ? base.split('{n}').join(String(n)) : base + '_' + n, q);
          }
        });
      }
    });
  });
  (gui.hiddenFields || []).forEach((f) => add(f.nameId || f.name, null));
  (gui.linkedFields || []).forEach((f) => add(f.linkedFieldId, null));
  return { names, owner };
}

/** Sections are numbered across the packet, so the range says whose question it is. */
function sectionIndexOf(gui, question) {
  const section = (gui.sections || []).find((s) => (s.questions || []).some((q) => q === question));
  return section ? Number(section.sectionId) : null;
}

/* ------------------------------------------------------------------ */
/* the PDFs                                                            */
/* ------------------------------------------------------------------ */

async function pdfFieldNames(file) {
  const doc = await PDFDocument.load(fs.readFileSync(file), { ignoreEncryption: true });
  return doc.getForm().getFields().map((f) => ({
    name: f.getName(),
    kind: f.constructor.name === 'PDFCheckBox' ? 'checkbox' : 'text'
  }));
}

/** A field config's own view of a form: id (raw AcroForm path) -> newName. */
function readFieldConfig(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (data.fields || []).map((f) => ({
    id: f.id, name: f.newName, label: f.label, courtUse: f.courtUse === true
  }));
}

/**
 * Rule 1's escape hatch: a field "mapped" to its own raw AcroForm path is
 * preserved by the sanitizer, never filled. It counts as unreachable.
 */
function placeholderMapped(entry) {
  return entry.id === entry.name || /\[\d+\]/.test(String(entry.name || ''));
}

/* ------------------------------------------------------------------ */
/* Rule 3 - repeated entry blocks                                      */
/* ------------------------------------------------------------------ */

/**
 * <base>_<n>_<field> repeated for n = 1..k is a numbered block that should be
 * one multipleDropdownType node. Finds the families and how many n each has.
 */
function repeatedBlocks(names) {
  const families = new Map();
  names.forEach((name) => {
    const m = /^(.*?)_(\d+)(?:_(.+))?$/.exec(name);
    if (!m) return;
    const family = m[1];
    if (!families.has(family)) families.set(family, { numbers: new Set(), fields: new Set(), names: [] });
    const entry = families.get(family);
    entry.numbers.add(Number(m[2]));
    if (m[3]) entry.fields.add(m[3]);
    entry.names.push(name);
  });
  return [...families.entries()]
    // A real entry block is numbered 1..k with no gaps. "attachment_form_dv_820"
    // is a form number, and "..._line_1 / _line_2" are the overflow lines of one
    // answer, not two entries - neither is a numbered block.
    .filter(([family, v]) => {
      const numbers = [...v.numbers].sort((a, b) => a - b);
      if (numbers.length < 2 || numbers[0] !== 1) return false;
      if (numbers.some((n, i) => n !== i + 1)) return false;
      if (/(^|_)line$/.test(family) || (v.fields.size === 0 && /line/.test(family))) return false;
      return true;
    })
    .map(([family, v]) => ({
      family,
      entries: Math.max(...v.numbers),
      fieldsPerEntry: v.fields.size || 1,
      total: v.names.length
    }))
    .sort((a, b) => b.total - a.total);
}

/* ------------------------------------------------------------------ */

async function main() {
  const gui = JSON.parse(fs.readFileSync(GUI, 'utf8'));
  const { names: posted, owner } = postedNames(gui);
  const ownedByForm = (question, form) => {
    const index = sectionIndexOf(gui, question);
    return index != null && index >= form.firstSection && index <= form.lastSection;
  };
  const forms = gui.projectForms || [{ name: gui.formName, pdfFile: gui.pdfOutputName }];

  const report = { gui: GUI, postedNames: posted.size, forms: [], rule3: [], rule5: {} };

  for (const form of forms) {
    const base = String(form.pdfFile || form.name || '').replace(/\.pdf$/i, '');
    const pdfPath = path.join(PDF_DIR, base + '.pdf');
    const configPath = path.join(CONFIG_DIR, base.toLowerCase() + '-field-config.json');
    if (!fs.existsSync(pdfPath)) {
      report.forms.push({ form: form.name, error: 'no sanitized PDF at ' + pdfPath });
      continue;
    }
    const fields = await pdfFieldNames(pdfPath);
    const config = fs.existsSync(configPath) ? readFieldConfig(configPath) : [];
    const byName = new Map(config.map((c) => [c.name, c]));

    // Rule 1 is about what the filer must answer. A field the form itself says
    // the court completes is left blank on purpose, and asking for it would be
    // the defect - so those are counted apart, in both directions.
    const courtUse = new Set(config.filter((c) => c.courtUse).map((c) => c.name));
    const filerFields = fields.filter((f) => !courtUse.has(f.name));
    const unreachable = filerFields.filter((f) => !posted.has(f.name));
    // A court-use field can still receive a value: the packet asks the filer for
    // the firearms once on DV-100, and DV-110's proposed order repeats them by
    // name. That is a mirror, and the form itself asks for it ("Include
    // information from form DV-100, item 9"). What must not happen is a question
    // in THIS form's own sections asking the filer to fill the court's part.
    const askedButCourtUse = fields.filter((f) => {
      if (!courtUse.has(f.name) || !posted.has(f.name)) return false;
      const q = owner.get(f.name);
      return q && ownedByForm(q, form);
    });
    const prefilledCourtUse = fields.filter((f) => courtUse.has(f.name) && posted.has(f.name)
      && !askedButCourtUse.includes(f));
    const placeholders = config.filter(placeholderMapped);

    report.forms.push({
      form: form.name,
      pdf: base + '.pdf',
      fields: fields.length,
      courtUse: fields.length - filerFields.length,
      filerFields: filerFields.length,
      text: fields.filter((f) => f.kind === 'text').length,
      checkboxes: fields.filter((f) => f.kind === 'checkbox').length,
      reachable: filerFields.length - unreachable.length,
      unreachable: unreachable.map((f) => ({
        name: f.name, kind: f.kind,
        label: (byName.get(f.name) || {}).label || ''
      })),
      askedButCourtUse: askedButCourtUse.map((f) => f.name),
      prefilledCourtUse: prefilledCourtUse.map((f) => f.name),
      placeholderMapped: placeholders.map((p) => p.name)
    });
    // A family the interview already asks as one numbered block is satisfied:
    // its fields exist on the PDF but the question behind them is a single
    // "how many?" followed by that many entries.
    const asBlocks = new Set();
    (gui.sections || []).forEach((section) => (section.questions || []).forEach((q) => {
      if (q.type === 'numberedDropdown' && q.nodeId) asBlocks.add(q.nodeId);
    }));
    const families = repeatedBlocks(fields.filter((f) => !courtUse.has(f.name)).map((f) => f.name));
    report.rule3.push({
      form: form.name,
      blocks: families.filter((b) => !asBlocks.has(b.family)),
      converted: families.filter((b) => asBlocks.has(b.family)).map((b) => b.family)
    });
  }

  // A question gated on one that comes later can never open: the form reveals
  // questions in order, so its trigger is still unanswered when it is passed.
  // This is how a numbered block that the editor renumbered ended up waiting on
  // the question below it.
  const numbered = new Map();
  (gui.sections || []).forEach((s) => (s.questions || []).forEach((q) => numbered.set(Number(q.questionId), q)));
  report.forwardRefs = [];
  numbered.forEach((q, id) => {
    (((q.logic || {}).conditions) || []).forEach((c) => {
      const prev = Number(c.prevQuestion);
      if (prev > id) {
        report.forwardRefs.push({
          question: id, name: q.nameId || q.nodeId, dependsOn: prev,
          dependsOnName: (numbered.get(prev) || {}).nameId || (numbered.get(prev) || {}).nodeId || '?'
        });
      }
    });
  });

  // Rule 7: a form can legitimately ask nothing - every value it prints came
  // from an earlier form - but it must still be produced. What makes that go
  // wrong is silent: the form vanishes from the interview and nobody notices it
  // also vanished from the output.
  report.rule7 = forms.map((form) => ({
    form: form.name,
    asksNothing: form.asksNothing === true || form.lastSection < form.firstSection,
    pdfFile: form.pdfFile || '',
    alwaysIncluded: form.alwaysIncluded === true,
    activatedBy: (gui.formActivations || [])
      .filter((r) => r.targetForm === form.name)
      .map((r) => (r.unconditional ? 'unconditionally' : r.optionLabel + ' on q' + r.questionId))
  }));

  const groups = gui.groups || [];
  // A cover form whose every answer came from an earlier form asks nothing, so
  // its sections are dropped and its group is legitimately empty: there is no
  // step to show for a form the filer never fills. Any other empty group is the
  // old fault - a group nobody put sections in.
  const asksNothing = new Set(forms.filter((f) => f.asksNothing).map((f) => f.name));
  const emptyGroups = groups.filter((g) => !(g.sections || []).length && !asksNothing.has(g.name));
  report.rule5 = {
    groups: groups.map((g) => ({
      name: g.name, sections: (g.sections || []).length, asksNothing: asksNothing.has(g.name)
    })),
    oneGroupPerForm: groups.length === forms.length,
    namedAfterForms: groups.length === forms.length
      && groups.every((g, i) => String(g.name || '').trim() === String(forms[i].name || '').trim()),
    everyGroupHoldsSections: emptyGroups.length === 0,
    emptyGroups: emptyGroups.map((g) => g.name)
  };

  if (AS_JSON) { console.log(JSON.stringify(report, null, 2)); return; }

  console.log('PACKET AUDIT  ' + GUI);
  console.log('  names the form posts: ' + report.postedNames);
  console.log('');
  console.log('RULE 1 — every PDF field reachable');
  report.forms.forEach((f) => {
    if (f.error) { console.log('  ' + f.form + ': ' + f.error); return; }
    const verdict = (f.unreachable.length || f.askedButCourtUse.length) ? 'FAILS' : 'passes';
    console.log('  ' + f.pdf.padEnd(12) + verdict
      + '  ' + f.reachable + '/' + f.filerFields + ' filer fields reachable'
      + '   (' + f.courtUse + ' left for the court)');
    f.unreachable.forEach((u) => console.log('      - no question: ' + u.name + '  [' + u.kind + ']'
      + (u.label && u.label !== u.name ? '  ' + u.label : '')));
    f.askedButCourtUse.forEach((n) => console.log('      - asked but the court fills it: ' + n));
    if (f.prefilledCourtUse.length) {
      console.log('      ' + f.prefilledCourtUse.length
        + ' court field(s) prefilled from an earlier form: '
        + f.prefilledCourtUse.slice(0, 6).join(', ')
        + (f.prefilledCourtUse.length > 6 ? ', ...' : ''));
    }
    if (f.placeholderMapped.length) {
      console.log('      placeholder-mapped in field config: ' + f.placeholderMapped.length);
    }
  });
  console.log('');
  console.log('RULE 3 — repeated entries use a multipleDropdownType node');
  report.rule3.forEach((r) => {
    const done = r.converted.length ? '  (' + r.converted.length + ' already a block: '
      + r.converted.join(', ') + ')' : '';
    if (!r.blocks.length) { console.log('  ' + r.form + ': passes' + done); return; }
    console.log('  ' + r.form + ': ' + r.blocks.length + ' family(ies) still flat' + done);
    r.blocks.forEach((b) => console.log('      - ' + b.family
      + '  ' + b.entries + ' entries x ' + b.fieldsPerEntry + ' field(s) = ' + b.total + ' fields'));
  });
  console.log('');
  console.log('RULE 7 — a form that asks nothing still ships');
  report.rule7.forEach((f) => {
    const how = f.alwaysIncluded ? 'always included'
      : (f.activatedBy.length ? 'activated ' + f.activatedBy.join(', ') : 'NOTHING ACTIVATES IT');
    const verdict = (!f.pdfFile || (!f.alwaysIncluded && !f.activatedBy.length)) ? 'FAILS ' : '';
    console.log('  ' + verdict + f.form.padEnd(8)
      + (f.asksNothing ? 'asks nothing, ' : '')
      + (f.pdfFile ? 'produces ' + f.pdfFile : 'HAS NO PDF') + ', ' + how);
  });

  console.log('');
  console.log('ORDERING — no question waits on one that comes after it');
  if (!report.forwardRefs.length) console.log('  passes');
  report.forwardRefs.forEach((f) => console.log('  FAILS  q' + f.question + ' (' + f.name
    + ') waits on q' + f.dependsOn + ' (' + f.dependsOnName + '), which is shown later'));
  console.log('');
  console.log('RULE 5 — one group per form, named after the form');
  console.log('  groups: ' + (report.rule5.groups.length
    ? report.rule5.groups.map((g) => g.name + '(' + g.sections
        + (g.asksNothing ? ', asks nothing - filled from earlier forms' : '') + ')').join(', ')
    : 'none'));
  console.log('  one per form: ' + report.rule5.oneGroupPerForm
    + '   named after forms: ' + report.rule5.namedAfterForms
    + '   all hold sections: ' + report.rule5.everyGroupHoldsSections);
}

main().catch((err) => { console.error(err); process.exit(1); });
