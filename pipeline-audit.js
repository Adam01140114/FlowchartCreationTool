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
      // A combined question posts one field per box, by the box's own id -
      // there is one entry, so nothing is numbered.
      if (q.type === 'multipleTextboxes') {
        (q.allFieldsInOrder || []).forEach((f) => { if (f.nodeId) add(f.nodeId, q); });
      }
      // A numbered block asks for entry 1..max. The field's own id says where
      // the number goes: {n} in the middle for a PDF that names its rows
      // firearm_item_3_description, appended otherwise.
      const max = parseInt(q.max, 10);
      if (q.type === 'numberedDropdown' && max > 0) {
        const perEntry = (base) => {
          if (!base) return;
          for (let n = 1; n <= max; n++) {
            add(base.indexOf('{n}') !== -1 ? base.split('{n}').join(String(n)) : base + '_' + n, q);
          }
        };
        (q.allFieldsInOrder || q.textboxes || q.labels || []).forEach((field) => {
          if (!field || typeof field !== 'object') return;
          // A choice collected once per entry ("does this person live with
          // you?") holds its PDF names on the options, not on the field: the
          // field itself is the heading above them and fills nothing.
          if (Array.isArray(field.options) && field.options.length) {
            field.options.forEach((opt) => perEntry(opt && (opt.nodeId || opt.nameId)));
            return;
          }
          perEntry(field.nodeId || field.nameId);
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
  return doc.getForm().getFields().map((f) => {
    // The PDF says which boxes take a narrative: a multi-line widget is one the
    // form drew several ruled lines for. That is rule 12's evidence, so it does
    // not have to be guessed from the wording.
    let multiline = false;
    try { multiline = typeof f.isMultiline === 'function' && f.isMultiline(); } catch (e) { /* not a text field */ }
    return {
      name: f.getName(),
      kind: f.constructor.name === 'PDFCheckBox' ? 'checkbox' : 'text',
      multiline: multiline
    };
  });
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
      total: v.names.length,
      names: v.names
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
    // An answer's overflow lines are not questions. The compiler records which
    // ones it dropped; they stay on the PDF, unfilled, exactly as a paper filer
    // leaves them when their answer fits on the first line.
    const overflow = new Set();
    // A computed field is not unreachable, it is unasked on purpose: the form
    // works it out rather than making the filer guess. DV-100 item 32 wants the
    // number of extra pages attached, and counting them is the packet's job.
    const computed = new Set();
    try {
      const chart = JSON.parse(fs.readFileSync(base + '-flowchart.json', 'utf8'));
      (chart.continuationLines || []).forEach((c) => (c.drop || []).forEach((n) => overflow.add(n)));
      (chart.computedFields || []).forEach((c) => { if (c && c.nameId) computed.add(c.nameId); });
    } catch (e) { /* no flowchart beside the packet - nothing to exempt */ }
    const config = fs.existsSync(configPath) ? readFieldConfig(configPath) : [];
    const byName = new Map(config.map((c) => [c.name, c]));

    // Rule 1 is about what the filer must answer. A field the form itself says
    // the court completes is left blank on purpose, and asking for it would be
    // the defect - so those are counted apart, in both directions.
    const courtUse = new Set(config.filter((c) => c.courtUse).map((c) => c.name));
    const filerFields = fields.filter((f) => !courtUse.has(f.name));
    let unreachable = filerFields.filter((f) => !posted.has(f.name));
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

    const computedFields = unreachable.filter((f) => computed.has(f.name));
    unreachable = unreachable.filter((f) => !computed.has(f.name));
    const overflowFields = unreachable.filter((f) => overflow.has(f.name));
    unreachable = unreachable.filter((f) => !overflow.has(f.name));

    report.forms.push({
      form: form.name,
      pdf: base + '.pdf',
      overflowLines: overflowFields.map((f) => f.name),
      computedFields: computedFields.map((f) => f.name),
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
    // Numbering does not always mean repetition. "Which of the debts resulted
    // from the abuse? (check all that apply)" prints one box per debt, and the
    // interview asks it as one multi-select question - the numbers are its
    // options, not three questions. A family every one of whose fields hangs
    // off the same question is already asked once, however it is numbered.
    const askedAsOneQuestion = (b) => {
      const owners = new Set(b.names.map((n) => owner.get(n)).filter(Boolean));
      return owners.size === 1 && b.names.every((n) => owner.has(n));
    };
    // Rule 12: a multi-line box asked as a one-line question.
    report.rule12 = report.rule12 || [];
    fields.filter((f) => f.multiline && !courtUse.has(f.name)).forEach((f) => {
      const q = owner.get(f.name);
      if (!q) return;                        // rule 1 already reports unreachable
      if (q.type === 'bigParagraph') return;
      // A split's parts are short values that happen to share one tall box.
      if ((gui.linkedFields || []).some(function (l) { return l.linkedFieldId === f.name; })) return;
      report.rule12.push({ form: form.name, field: f.name, type: q.type,
                           text: String(q.text || '').slice(0, 52) });
    });
    const families = repeatedBlocks(fields.filter((f) => !courtUse.has(f.name)).map((f) => f.name));
    const satisfied = (b) => asBlocks.has(b.family) || askedAsOneQuestion(b);
    report.rule3.push({
      form: form.name,
      blocks: families.filter((b) => !satisfied(b)),
      converted: families.filter(satisfied).map((b) => b.family)
    });
  }

  // Rule 2 (gates): a condition that lists every option of the question above
  // it is not a gate. It reads like one in the JSON, and it shows the question
  // whatever the filer answered - the firearms table appearing after "No" and
  // after "I don't know" was this. Report them, because a form can pass every
  // other rule while asking about a gun nobody has.
  const byQuestionId = new Map();
  (gui.sections || []).forEach((sec) => (sec.questions || []).forEach((q) => {
    byQuestionId.set(String(q.questionId), q);
  }));
  const labelsOf = (q) => (q && Array.isArray(q.options) && q.options.length)
    ? q.options.map((o) => String((o && typeof o === 'object') ? (o.label || o.text || o.value) : o))
    : [];
  // Rule 2 (wording): a condition smuggled into the question text. The rule has
  // listed these tells since it was written; nothing was checking them, and two
  // slipped through - "Your lawyer's information, if you have one" and "Where
  // does the restrained person live, if you know?".
  const CONDITION_TELLS = /(if you have|if any|if known|if applicable|if it|if they|if there|if needed|if so)|,s*if/i;
  // A continuation line is the one shape allowed to say "if": it is overflow
  // from a single answer, not a second fact.
  const CONTINUATION = /continue|did not fit|more space|additional space/i;
  report.rule2wording = [];
  // Rule 11: a question that does not say what to enter. "What is your custody
  // case details?" is answerable only by someone holding the paper form, which
  // is the person the interview exists to spare.
  const VAGUE = /(details|information|info)/i;
  report.rule11 = [];
  (gui.sections || []).forEach((sec) => (sec.questions || []).forEach((q) => {
    const text = String(q.text || '');
    if (!text) return;
    if (CONDITION_TELLS.test(text) && !CONTINUATION.test(text)) {
      report.rule2wording.push({ question: q.nameId || q.nodeId || ('q' + q.questionId), text: text });
    }
    // Only a single free-text box: a multipleTextboxes question naming its
    // boxes has already said what it wants.
    if (VAGUE.test(text) && (q.type === 'text' || q.type === 'bigParagraph')) {
      report.rule11.push({ question: q.nameId || q.nodeId || ('q' + q.questionId), text: text, type: q.type });
    }
  }));

  report.rule2gates = [];
  (gui.sections || []).forEach((sec) => (sec.questions || []).forEach((q) => {
    const conds = (q.logic && q.logic.enabled && q.logic.conditions) || [];
    const grouped = new Map();
    conds.forEach((c) => {
      const k = String(c.prevQuestion);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(String(c.prevAnswer).toLowerCase());
    });
    grouped.forEach((answers, prev) => {
      const gate = byQuestionId.get(prev);
      const labels = labelsOf(gate);
      if (labels.length < 2) return;
      const chosen = new Set(answers);
      if (!labels.every((l) => chosen.has(l.toLowerCase()))) return;
      // A two-option Yes/No gate covered on BOTH sides is never a rejoin. A
      // gate with two answers exists precisely to branch, so listing both is
      // either a missing gate or a condition that should not be there. This is
      // reported separately from the multi-option case, and as a failure,
      // because the multi-option note ("not a failure on its own") is what let
      // "How close do you live to each other?" keep showing to a filer who had
      // just said they do not live close.
      const yesNo = labels.length === 2
        && labels.every((l) => /^(yes|no)$/i.test(String(l).trim()));
      if (yesNo) {
        report.rule2yesno = report.rule2yesno || [];
        report.rule2yesno.push({
          question: q.nameId || q.nodeId || ('q' + q.questionId),
          text: String(q.text || '').slice(0, 46),
          gate: gate.nameId || gate.nodeId || ('q' + prev),
          gateText: String(gate.text || '').slice(0, 44)
        });
        return;
      }
      report.rule2gates.push({
        question: q.nameId || q.nodeId || ('q' + q.questionId),
        text: String(q.text || '').slice(0, 46),
        gate: gate.nameId || gate.nodeId || ('q' + prev),
        gateText: String(gate.text || '').slice(0, 40),
        options: labels.length
      });
    });
  }));

  // Rule 2 (wording): nothing a person reads is a field name.
  //
  // A field config usually carries `label` equal to the PDF field's name, and
  // that name travels: a question reading "What is your
  // person_asking_protection_mailing_zip_code?", or - the one that got through
  // for longer - a checkbox list whose options were
  // "relationship_have_children_together". Question text was already checked by
  // eye; option labels were not, because they are one level down.
  const RAW_NAME = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;
  // A raw AcroForm path is a field name too, and it reaches a reader by a route
  // the underscore test cannot see: the humanizer rewrites separators, so
  // "…Li7[0].item26d_tf[0]" arrives as "…Li7[0].item26d tf[0]" with no
  // underscore left to catch. What survives is the bracket notation and the
  // page/list scaffolding, which no question ever legitimately contains.
  // This is what let "Do you have a dV 100[0].Page4[0].List6[0].Li7[0].item26d
  // tf[0]?" sit in the interview while the audit reported zero failures.
  const ACROFORM_PATH = /\[\d+\]|\b(page|list|li)\s?\d+\s?\[|\b(tf|cb)\b\s?\[/i;
  report.rule2 = [];
  (gui.sections || []).forEach((section) => (section.questions || []).forEach((q) => {
    const text = String(q.text || '').trim();
    if (RAW_NAME.test(text) || /[a-z0-9]_[a-z0-9]/.test(text) || ACROFORM_PATH.test(text)) {
      report.rule2.push({ where: 'question text', nameId: q.nameId, shown: text });
    }
    // A box label inside a combined or repeating question is read too.
    (q.allFieldsInOrder || []).forEach((f) => {
      const lbl = String((f && f.label) || '').trim();
      if (lbl && (RAW_NAME.test(lbl) || ACROFORM_PATH.test(lbl))) {
        report.rule2.push({ where: 'box label', nameId: q.nameId, shown: lbl, text: String(q.text || '') });
      }
    });
    const labels = q.labels || [];
    (q.options || []).forEach((opt, i) => {
      const raw = labels[i] && labels[i].label !== undefined ? labels[i].label : labels[i];
      const shown = String((raw || (opt && opt.label !== undefined ? opt.label : opt)) || '').trim();
      if (RAW_NAME.test(shown)) {
        report.rule2.push({ where: 'option', nameId: q.nameId, shown, text: String(q.text || '') });
      }
    });
  }));

  // Rule 8: one question asks one thing. Two signals, with different weight.
  // A field name that joins two nouns - court_name_and_street_address - is the
  // PDF telling you it holds two answers, and a question for it asks a person
  // for both at once. Wording alone is weaker: "names of people who heard or
  // saw" is one answer despite the "or", so that is reported for a human to
  // read rather than failed.
  const VALUE_TYPES = new Set(['text', 'bigParagraph', 'number', 'date', 'money', 'phone', 'email']);
  const joined = new Set((gui.linkedFields || [])
    .filter((f) => typeof f.join === 'string').map((f) => f.linkedFieldId));
  report.rule8 = { compound: [], review: [] };
  (gui.sections || []).forEach((section) => (section.questions || []).forEach((q) => {
    if (!VALUE_TYPES.has(q.type)) return;
    const name = String(q.nameId || '');
    const text = String(q.text || '');
    if (/_and_/.test(name) && !joined.has(name)) {
      report.rule8.compound.push({ name, text });
    } else if (/\b(?:and)\b|\s\/\s/.test(text) && !/_and_/.test(name)) {
      report.rule8.review.push({ name, text });
    }
  }));

  // Rule 9: fields that describe one subject are one question. An address asked
  // as four questions is four screens for one thing a person types in one go,
  // and the same is true of a lawyer's name, bar number and firm. The signal is
  // a run of value questions whose field names share a prefix.
  const combined = new Set();
  (gui.sections || []).forEach((section) => (section.questions || []).forEach((q) => {
    if (q.type === 'multipleTextboxes' && q.nodeId) combined.add(q.nodeId);
  }));
  const families = new Map();
  (gui.sections || []).forEach((section) => (section.questions || []).forEach((q) => {
    if (!VALUE_TYPES.has(q.type) || !q.nameId) return;
    const parts = String(q.nameId).split('_');
    if (parts.length < 2) return;
    const prefix = parts.slice(0, -1).join('_');
    if (!families.has(prefix)) families.set(prefix, []);
    families.get(prefix).push(q.nameId);
  }));
  const ADDRESS_TAIL = /^(street|street_address|address|city|state|zip|zip_code|postal_code)$/;
  report.rule9 = [];
  families.forEach((members, prefix) => {
    if (combined.has(prefix) || members.length < 3) return;
    const tails = members.map((m) => m.slice(prefix.length + 1));
    const address = tails.filter((t) => ADDRESS_TAIL.test(t)).length >= 3;
    report.rule9.push({ prefix, members, address });
  });

  // Rule 10: ask for a value in the field type it is. A date typed into a text
  // box has no picker and no format; a phone has no keypad on a phone.
  const EXPECTED_TYPE = [
    { test: /(^|_)(date_of_birth|dob)$/, type: 'date' },
    { test: /(^|_)date$/, type: 'date' },
    { test: /(^|_)(telephone|phone|phone_number|fax)$/, type: 'phone' },
    { test: /(^|_)email(_address)?$/, type: 'email' },
    { test: /(^|_)(age|count|years|months|yards)$/, type: 'number' }
  ];
  const TYPE_OK = { date: ['date'], phone: ['phone'], email: ['email'], number: ['money', 'number'] };
  report.rule10 = [];
  (gui.sections || []).forEach((section) => (section.questions || []).forEach((q) => {
    if (!q.nameId || !VALUE_TYPES.has(q.type)) return;
    const want = EXPECTED_TYPE.find((e) => e.test.test(q.nameId));
    if (!want) return;
    if ((TYPE_OK[want.type] || []).indexOf(q.type) === -1) {
      report.rule10.push({ name: q.nameId, is: q.type, should: want.type, text: q.text });
    }
  }));
  // A field inside a combined or repeating question carries its own type there.
  (gui.sections || []).forEach((section) => (section.questions || []).forEach((q) => {
    (q.allFieldsInOrder || []).forEach((f) => {
      if (!f.nodeId) return;
      const want = EXPECTED_TYPE.find((e) => e.test.test(f.nodeId));
      if (!want) return;
      const is = f.type === 'label' ? 'text' : f.type;
      if ((TYPE_OK[want.type] || []).indexOf(is) === -1 && is !== want.type) {
        report.rule10.push({ name: f.nodeId, is: is, should: want.type, text: '(inside "' + q.text + '")' });
      }
    });
  }));

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
    if ((f.overflowLines || []).length) {
      // Named rather than passed over quietly: a blank here should be a blank
      // because the answer fit on the first line, not because nobody asked.
      console.log('      ' + f.overflowLines.length
        + ' overflow line(s), which no question fills directly - the filler spills a long answer onto them: ' + f.overflowLines.join(', '));
    if ((f.computedFields || []).length) console.log('      ' + f.computedFields.length
      + ' computed field(s), which the form works out rather than asking: ' + f.computedFields.join(', '));
    }
    if (f.placeholderMapped.length) {
      console.log('      placeholder-mapped in field config: ' + f.placeholderMapped.length);
    }
  });
  console.log('');
  console.log('RULE 2 — nothing a person reads is a field name');
  if (!report.rule2.length) {
    console.log('  passes');
  } else {
    console.log('  FAILS  ' + report.rule2.length + ' place(s) show a field name');
    report.rule2.slice(0, 12).forEach((r) => console.log('      - ' + r.where + ': "'
      + r.shown + '"' + (r.text ? '   in "' + r.text + '"' : '')));
    if (report.rule2.length > 12) console.log('      ... ' + (report.rule2.length - 12) + ' more');
  }
  if (!(report.rule2wording || []).length) {
    console.log('  wording: no question hides a condition in its text');
  } else {
    console.log('  FAILS  ' + report.rule2wording.length
      + ' question(s) hide a condition in the wording - each should be a gate plus a follow-up:');
    report.rule2wording.forEach((r) => console.log('      - ' + r.question + ': "' + r.text + '"'));
  }
  // Anything the author declared always-shown, with its reason, read out of the
  // per-form flowcharts beside the packet.
  const declared = new Map();
  (gui.projectForms || []).forEach((f) => {
    const base = String(f.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    try {
      const chart = JSON.parse(fs.readFileSync(base + '-flowchart.json', 'utf8'));
      (chart.alwaysShown || []).forEach((x) => declared.set(x.question, x.why || ''));
    } catch (e) { /* no flowchart beside the packet */ }
  });
  const yesNoGates = (report.rule2yesno || []).filter((g) => !declared.has(g.question));
  const yesNoDeclared = (report.rule2yesno || []).filter((g) => declared.has(g.question));
  if (!yesNoGates.length) {
    console.log('  gates: no follow-up is shown on both Yes and No'
      + (yesNoDeclared.length ? '  (' + yesNoDeclared.length + ' declared always-shown)' : ''));
  } else {
    console.log('  FAILS  ' + yesNoGates.length
      + ' follow-up(s) shown on BOTH Yes and No of their gate - that is no gate at all:');
    yesNoGates.forEach((g) => console.log('      - ' + g.question
      + '  <- both answers of "' + g.gateText + '"'));
    console.log("      Fix the gate, or declare it in the hints alwaysShown, with a reason.");
  }
  const openGates = report.rule2gates || [];
  if (!openGates.length) {
    console.log('  gates: every condition names a subset of its gate options');
  } else {
    console.log('  ' + openGates.length + ' condition(s) list EVERY option of their gate, so the'
      + ' question shows whatever was answered:');
    openGates.slice(0, 10).forEach((g) => console.log('      - ' + g.question
      + '  <- all ' + g.options + ' options of "' + g.gateText + '"'));
    if (openGates.length > 10) console.log('      ... ' + (openGates.length - 10) + ' more');
    console.log('      (not a failure on its own - this is also how the compiler rejoins a'
      + ' branch to the spine. Read them before shipping.)');
  }

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
  console.log('RULE 8 — one question asks one thing');
  if (!report.rule8.compound.length) {
    console.log('  passes' + (joined.size ? '  (' + joined.size + ' field(s) asked in parts and rejoined)' : ''));
  }
  report.rule8.compound.forEach((c) => console.log('  FAILS  ' + c.name
    + ' holds two answers and is asked as one question: "' + c.text + '"'));
  if (report.rule8.review.length) {
    console.log('  review (wording joins two things, may still be one answer):');
    report.rule8.review.slice(0, 8).forEach((c) => console.log('      - ' + c.text));
    if (report.rule8.review.length > 8) console.log('      ... ' + (report.rule8.review.length - 8) + ' more');
  }

  console.log('');
  console.log('RULE 9 — fields about one subject are one question');
  if (!report.rule9.length) {
    console.log('  passes' + (combined.size ? '  (' + combined.size + ' combined question(s))' : ''));
  }
  report.rule9.forEach((f) => console.log('  ' + (f.address ? 'FAILS ' : 'review')
    + '  ' + f.members.length + ' separate questions share "' + f.prefix + '": '
    + f.members.map((m) => m.slice(f.prefix.length + 1)).join(', ')
    + (f.address ? '  — this is an address' : '')));

  console.log('');
  console.log('RULE 10 — ask for a value in the type it is');
  if (!report.rule10.length) console.log('  passes');
  report.rule10.forEach((f) => console.log('  FAILS  ' + f.name + ' is ' + f.is
    + ', should be ' + f.should + '   ' + (f.text || '')));

  console.log('');
  console.log('RULE 11 — a question says what to enter');
  if (!(report.rule11 || []).length) {
    console.log('  passes');
  } else {
    console.log('  FAILS  ' + report.rule11.length
      + ' question(s) ask for "details" or "information" in one box:');
    report.rule11.forEach((r) => console.log('      - ' + r.question + ': "' + r.text + '"'));
  }

  console.log('');
  console.log('RULE 12 — a narrative box is asked as a narrative');
  if (!(report.rule12 || []).length) {
    console.log('  passes');
  } else {
    console.log('  FAILS  ' + report.rule12.length
      + ' multi-line PDF box(es) asked as a one-line question:');
    report.rule12.forEach((r) => console.log('      - ' + r.form + ' ' + r.field
      + '  [' + r.type + ']  "' + r.text + '"'));
  }

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
