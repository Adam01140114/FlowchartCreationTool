/**
 * The deterministic half of the packet process, for one DocHelper session.
 *
 * Input: each form's unlocked PDF, and the two artifacts a person (or model)
 * writes for it - the field config and the hints (Hand Off/NEW-FORM.md) - plus
 * packet.json, which says which forms an answer brings in.
 *
 * Steps, the same as the repo's pipeline:
 *   1. check the field config against the PDF it names
 *   2. sanitize the PDF with it (auto-form/pdf-field-sanitizer.js) - this is
 *      the copy /edit_pdf fills
 *   3. compile the interview (compile-form.js) - the flowchart is written out
 *      too, so the form opens in the editor like any other
 *   4. run the wording rules over the compiled questions (wording-rules.js)
 *
 * and then one step the repo does in the browser (editor export + generate.js):
 * turn the compiled interview into interview.json, which DocHelper's chat walks.
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { sanitizePdfFields } = require('../../auto-form/pdf-field-sanitizer');
const compiler = require('../../compile-form');
const wording = require('../../wording-rules');

/** compile-form.js and its router print as they work; keep that out of the server log. */
function quietly(fn) {
  const saved = { log: console.log, warn: console.warn };
  const captured = [];
  console.log = (...a) => captured.push(a.join(' '));
  console.warn = (...a) => captured.push(a.join(' '));
  try { return { value: fn(), captured }; }
  finally { console.log = saved.log; console.warn = saved.warn; }
}

/**
 * Check a field config against its PDF, and repair what can be repaired.
 *
 * - An entry naming a field the PDF does not have is dropped (and reported).
 * - A fillable field the config leaves out would be deleted by the sanitizer,
 *   so it is put back under its own name and marked courtUse: kept on the
 *   paper, never asked. (NEW-FORM.md: "List every field.")
 * - Push buttons and signature boxes may be left out; the sanitizer removes them.
 */
async function checkFieldConfig(plainBytes, config) {
  const problems = [];
  const doc = await PDFDocument.load(plainBytes, { ignoreEncryption: true });
  const pdfFields = new Map(doc.getForm().getFields().map((f) => [f.getName(), f.constructor.name]));
  if (!config || !Array.isArray(config.fields)) {
    throw new Error('field config has no "fields" array');
  }
  const kept = [];
  // "remove": true deletes a field from the filled copy on purpose: a box that
  // only prints the form's own screen notice ("press the Clear This Form
  // button"), which has no business on the paper that gets filed.
  const removed = new Set();
  config.fields.forEach((entry) => {
    if (!entry || !entry.id) { problems.push('a field config entry has no "id" and was dropped'); return; }
    if (!pdfFields.has(entry.id)) { problems.push(`"${entry.id}" is not a field in this PDF; dropped`); return; }
    if (entry.remove === true) { removed.add(entry.id); return; }
    if (!entry.newName) { problems.push(`"${entry.id}" has no newName; kept under its own name`); entry.newName = entry.id; }
    kept.push(entry);
  });
  const listed = new Set(kept.map((e) => e.id));
  pdfFields.forEach((kind, id) => {
    if (listed.has(id) || removed.has(id) || kind === 'PDFButton' || kind === 'PDFSignature') return;
    kept.push({ id, newName: id, type: kind === 'PDFCheckBox' ? 'checkbox' : 'text', courtUse: true,
      _addedBy: 'DocHelper: left out of the field config, kept on the paper and not asked' });
    problems.push(`"${id}" was missing from the field config; kept on the paper, not asked`);
  });
  return { config: Object.assign({}, config, { fields: kept }), problems };
}

/** The question wording rules the pipeline enforces (form-rules.html). */
function wordingProblems(flowchart) {
  const out = [];
  (flowchart.cells || []).forEach((c) => {
    if (!c) return;
    const who = c._nameId || c.id;
    const say = (s, where) => {
      if (!s) return;
      const carried = wording.conditionTell && wording.conditionTell(s);
      if (carried) out.push(`${who}${where}: "${s}" carries its condition ("${carried}") - ask it as a Yes/No gate first`);
      const sent = wording.sendsFilerForAForm && wording.sendsFilerForAForm(s);
      if (sent) out.push(`${who}${where}: "${s}" sends the filer for a form ("${sent}")`);
    };
    say(c._questionText, '');
    say(c._subtitle, ' [subtitle]');
    (c._textboxes || []).forEach((b) => say(b && b.label, ' [box]'));
    if (c._questionText && wording.saysOptional && wording.saysOptional(c._questionText)) {
      out.push(`${who}: "${c._questionText}" says "optional" - mark it "optional": true instead`);
    }
    const notSentence = c._questionText && wording.sentenceProblem && wording.sentenceProblem(c._questionText);
    if (notSentence) out.push(`${who}: "${c._questionText}" is not a full sentence (${notSentence})`);
    const paper = c._questionText && wording.mentionsThePaper && wording.mentionsThePaper(c._questionText);
    if (paper) out.push(`${who}: "${c._questionText}" shows the filer the paper's machinery ("${paper}")`);
  });
  return out;
}

const UI_TYPES = {
  text: 'text', label: 'text', ssn: 'text', ein: 'text', file: 'text',
  textarea: 'textarea', bigParagraph: 'textarea',
  date: 'date', number: 'number', money: 'money', amount: 'money',
  email: 'email', phone: 'phone',
  dropdown: 'choice', radio: 'choice', checkbox: 'multi',
  multipleTextboxes: 'boxes', multipleDropdownType: 'repeat',
};

/** compile-form.js's interview tree -> what the chat walks. */
function toInterview(base, title, compiled, hints, config) {
  const sections = compiled.flowchart.sectionPrefs || {};
  const questionsHint = hints.questions || {};
  const newNameOf = new Map(config.fields.map((f) => [f.id, f.newName]));

  const option = (o, owner) => ({
    label: o.label,
    value: o.nameId,
    follow: (o.follow || []).map((f) => node(f, owner)),
  });

  function node(step, parent) {
    const hint = questionsHint[step.nameId] || {};
    // compile-form.js asks an optional value as "Do you have one?" and then the
    // value on Yes. Having said Yes, the value is no longer skippable.
    const behindOwnGate = !!(parent && parent.origin === 'gate' && step.field
      && parent.nameId === step.field.nameId + '_provided');
    const out = {
      id: step.nameId,
      form: base,
      formTitle: title,
      section: (sections[step.section] && sections[step.section].name) || '',
      text: step.text,
      subtitle: step.subtitle || hint.subtitle || '',
      type: UI_TYPES[step.type] || 'text',
      optional: !behindOwnGate && !!(step.optional || hint.optional || (step.field && step.field.optional && step.origin !== 'gate')),
    };
    if (step.origin) out.origin = step.origin;
    if (step.fromOptions) out.fromOptions = step.fromOptions.slice();
    if (step.alsoWhen) out.alsoWhen = step.alsoWhen.slice();
    if (step.options && step.options.length) out.options = step.options.map((o) => option(o, step));
    if (step.field) {
      const targets = (step.field.mirrorTargets || []).map((id) => newNameOf.get(id) || id);
      out.field = {
        name: step.field.nameId,
        pdfType: step.field.raw && step.field.raw.type || step.field.type,
        targets: Array.from(new Set([step.field.nameId].concat(targets))),
      };
    }
    if (step.combine) {
      const c = step.combine;
      out.boxes = c.boxes.map((b) => ({
        key: b.fullNameId || (c.nameId + '_' + b.nameId),
        label: b.label,
        type: b.options ? 'choice' : (UI_TYPES[b.type] || 'text'),
        optional: !!b.optional,
        options: b.options ? b.options.map((o) => ({ label: o.label, value: o.nameId })) : undefined,
      }));
    }
    if (step.repeat) {
      const r = step.repeat;
      out.repeat = {
        min: r.min || 0,
        max: r.max,
        entryTitle: r.entryTitle || 'Entry',
        fields: (r.fields || []).map((f, i) => ({
          key: f.nameId || ('choice_' + i),
          nameId: f.nameId || null,
          label: f.label || f.question || '',
          type: Array.isArray(f.options) ? 'choice' : (UI_TYPES[f.type] || 'text'),
          optional: !!f.optional,
          options: Array.isArray(f.options) ? f.options.map((o) => ({ label: o.label, value: o.nameId })) : undefined,
        })),
        joinInto: r.joinInto || null,
      };
    }
    return out;
  }

  const fl = compiled.flowchart;
  return {
    form: base,
    title,
    questions: compiled.steps.map((s) => node(s, null)),
    joins: (fl.cells || []).filter((c) => c._linkedLogicNodeId).map((c) => ({
      target: c._linkedLogicNodeId, parts: c._linkedFields || [], join: c._linkedJoin == null ? ' ' : c._linkedJoin,
    })),
    computed: fl.computedFields || [],
  };
}

/**
 * Build one form. Writes into formDir: field-config.json, hints.json,
 * flowchart.json, filled-from.pdf (the sanitized PDF), interview.json.
 * Returns { interview, problems, fieldCount, questionCount }.
 */
async function buildForm({ base, title, plainPdf, fieldConfig, hints, formDir }) {
  fs.mkdirSync(formDir, { recursive: true });
  const plainBytes = fs.readFileSync(plainPdf);
  const checked = await checkFieldConfig(plainBytes, fieldConfig);
  const config = checked.config;
  config.formTitle = config.formTitle || title;
  const problems = checked.problems.slice();

  const sanitized = await sanitizePdfFields(plainBytes, config);
  (sanitized.failed || []).forEach((f) => problems.push(`sanitizer: ${f.id}: ${f.reason}`));
  fs.writeFileSync(path.join(formDir, 'sanitized.pdf'), Buffer.from(sanitized.bytes));

  const run = quietly(() => compiler.compile(config, hints || {}));
  const compiled = run.value;
  compiled.flowchart.defaultPdfProperties = { pdfName: title, pdfFile: base + '.pdf', pdfPrice: '0' };
  problems.push(...wordingProblems(compiled.flowchart));
  (compiled.notes || []).filter((n) => /NOT ASKED/.test(n)).forEach((n) => problems.push(n));

  const interview = toInterview(base, title, compiled, hints || {}, config);
  fs.writeFileSync(path.join(formDir, 'field-config.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(formDir, 'hints.json'), JSON.stringify(hints || {}, null, 2));
  fs.writeFileSync(path.join(formDir, 'flowchart.json'), JSON.stringify(compiled.flowchart, null, 2));
  fs.writeFileSync(path.join(formDir, 'interview.json'), JSON.stringify(interview, null, 2));

  let questionCount = 0;
  const count = (q) => { questionCount += 1; (q.options || []).forEach((o) => o.follow.forEach(count)); };
  interview.questions.forEach(count);
  return {
    interview,
    problems,
    fieldCount: sanitized.fieldNames.length,
    askedFields: config.fields.filter((f) => !f.courtUse).length,
    questionCount,
  };
}

module.exports = { buildForm, checkFieldConfig, toInterview };
