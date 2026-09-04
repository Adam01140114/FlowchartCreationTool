/**
 * Generic form-schema -> Flowchart Creation Tool JSON compiler.
 *
 * Works for ANY form. It reads a logical schema (field_config.txt shape),
 * infers the interview (exclusive groups, gates, follow-ups, merges), lays it
 * out top-to-bottom, and routes wires with the shared circuit-board router.
 *
 * Usage:
 *   node compile-form.js <schema.txt|json> [out.json] [--hints hints.json]
 *
 * Interview inference can always be overridden declaratively — put an
 * "interview" block in the schema, or pass a --hints file with the same shape:
 *   {
 *     "sections":  [{ "name": "Identification", "fields": ["taxpayer_name"] }],
 *     "groups":    [{ "nameId": "tax_classification", "question": "...",
 *                     "members": ["tax_classification_individual", ...],
 *                     "multiSelect": false }],
 *     "questions": { "<fieldId>": { "text": "...", "type": "dropdown",
 *                                   "options": [...] } },
 *     "gates":     { "<fieldId>": { "nameId": "...", "question": "..." } },
 *     "order":     ["taxpayer_name", "business_name", ...]
 *   }
 */
const fs = require('fs');
const path = require('path');
const engine = require('./flowchart-engine.js');

const {
  Q_W, Q_H, O_W, O_H, CENTER_X,
  OPTION_GAP, BUS, TEXT_GAP, BRANCH_GAP, NODE_GAP,
  HUB_SIZE, SPLIT_TRUNK, SPLIT_BUS, JOIN_TRUNK, OUT_SPLIT_MIN,
  SECTION_COLORS,
  fitBox, packRow, separateOverlappingNodes, countNodeOverlaps,
  segmentHitsRect, routeCircuitBoard,
  isOptionCell, isQuestionCell, isHubCell, questionTypeOf, walkOutgoing, slug
} = engine;

/* ------------------------------------------------------------------ */
/* text                                                                */
/* ------------------------------------------------------------------ */

const ACRONYMS = /^(SSN|EIN|TIN|LLC|FATCA|ZIP|IRS|DBA|NPI|VIN|DOB|ID|US|USA|PDF)$/;

function humanize(s) {
  return String(s || '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** PDF caption -> conversational stem. "Name (as shown on ...)" -> "Name" */
function cleanLabel(label) {
  return String(label || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/,?\s*if any\b/gi, '')
    .replace(/,?\s*\boptional\b/gi, '')
    .replace(/^\s*(please\s+)?(enter|provide|input|type|list|specify)\s+/i, '')
    .replace(/^\s*(your|the)\s+/i, '')
    .replace(/\s*[:*]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lowerFirst(text) {
  const words = String(text).split(' ');
  if (!words.length) return text;
  if (ACRONYMS.test(words[0])) return words.join(' ');
  words[0] = words[0].charAt(0).toLowerCase() + words[0].slice(1);
  return words.join(' ');
}

function titleCase(text) {
  return String(text).split(' ').map((w) => (
    ACRONYMS.test(w.toUpperCase()) && w.length <= 5
      ? w.toUpperCase()
      : w.charAt(0).toUpperCase() + w.slice(1)
  )).join(' ');
}

function article(text) {
  return /^[aeiou]/i.test(String(text).trim()) ? 'an' : 'a';
}

function isPlural(text) {
  const t = String(text).trim();
  return /s$/i.test(t) && !/(ss|us|is)$/i.test(t);
}

const VERB_START = /^(is|are|was|were|do|does|did|has|have|had|will|would|can|should|must|may)\b/i;

/** Value question: "Name" -> "What is your name?" */
function valueQuestion(label, type) {
  const clean = cleanLabel(label);
  if (!clean) return 'What is your answer?';
  if (/\?$/.test(clean)) return clean;
  if (type === 'date') return `What is the ${lowerFirst(clean)}?`;
  return `What is your ${lowerFirst(clean)}?`;
}

/** Gate question: "Exempt payee code" -> "Do you have an exempt payee code?" */
function gateQuestion(label) {
  const clean = cleanLabel(label);
  if (!clean) return 'Do you want to answer this question?';
  if (/\?$/.test(clean)) return clean;
  if (VERB_START.test(clean)) return `${titleCase(clean.slice(0, 1)) + clean.slice(1)}?`;
  const low = lowerFirst(clean);
  return isPlural(low)
    ? `Do you have ${low}?`
    : `Do you have ${article(low)} ${low}?`;
}

/** Group question: "tax_classification" -> "What is your tax classification?" */
function groupQuestion(prefix) {
  const clean = lowerFirst(humanize(prefix));
  return `What is your ${clean}?`;
}

const YES_NO = [{ label: 'Yes', nameId: 'yes' }, { label: 'No', nameId: 'no' }];

/* ------------------------------------------------------------------ */
/* schema normalization + interview inference                          */
/* ------------------------------------------------------------------ */

const CHOICE_TYPES = new Set(['checkbox', 'radio']);
const KNOWN_TYPES = new Set([
  'text', 'checkbox', 'dropdown', 'date', 'number', 'ssn', 'ein',
  'radio', 'email', 'phone', 'money', 'textarea', 'file'
]);

function normalizeFields(schema) {
  return (schema.fields || []).map((f, i) => ({
    index: i,
    id: f.id || f.newName || `field_${i}`,
    nameId: f.newName || f.id || `field_${i}`,
    type: KNOWN_TYPES.has(String(f.type || '').toLowerCase())
      ? String(f.type).toLowerCase()
      : 'text',
    label: f.label || humanize(f.id || f.newName || ''),
    optional: f.optional === true || /\bif any\b|\boptional\b/i.test(f.label || ''),
    section: f.section,
    group: f.group || f.exclusiveGroup || f.radioGroup || null,
    options: f.options || null,
    question: f.question || f.questionText || null,
    conditional: f.conditional || null,
    raw: f
  }));
}

/**
 * Collapse fields that always hold the same value into a single question.
 *
 * A case number reprinted on every page is one answer, not thirteen. The
 * surviving field records every PDF field the answer has to reach, so one
 * response can fill all of them at fill time. Merging them in the PDF itself
 * would mean two AcroForm fields sharing a fully-qualified name, which is
 * malformed and read inconsistently by viewers.
 */
function applyMirrors(fields, hints) {
  const specs = hints.mirrors || [];
  if (!specs.length) return fields;

  const dropped = new Set();
  specs.forEach((spec) => {
    const members = (spec.members || [])
      .map((m) => fields.find((f) => f.id === m || f.nameId === m))
      .filter(Boolean);
    if (members.length < 2) return;

    const [keeper, ...rest] = members;
    if (spec.nameId) keeper.nameId = spec.nameId;
    if (spec.question) keeper.question = spec.question;
    if (spec.label) keeper.label = spec.label;
    // Every target, keeper included - the filler needs the whole list.
    keeper.mirrorTargets = members.map((m) => m.id);
    rest.forEach((m) => dropped.add(m.id));
  });

  return fields.filter((f) => !dropped.has(f.id));
}

/** Longest shared underscore-token prefix across ids (>=1 token). */
function commonTokenPrefix(ids) {
  const parts = ids.map((s) => s.split('_'));
  const out = [];
  for (let i = 0; i < parts[0].length; i++) {
    const tok = parts[0][i];
    if (parts.every((p) => p[i] === tok)) out.push(tok);
    else break;
  }
  return out.join('_');
}

/**
 * Runs of consecutive choice-type fields sharing an id prefix become ONE
 * question with option nodes (trainer rule A). Explicit `group` wins.
 */
function detectGroups(fields, hints) {
  const groups = [];
  const claimed = new Set();

  (hints.groups || []).forEach((g) => {
    const members = (g.members || []).map((m) => fields.find((f) => f.id === m || f.nameId === m)).filter(Boolean);
    if (members.length < 2) return;
    members.forEach((m) => claimed.add(m.id));
    groups.push({
      nameId: g.nameId || commonTokenPrefix(members.map((m) => m.id)) || slug(g.question || 'choice'),
      question: g.question || groupQuestion(g.nameId || commonTokenPrefix(members.map((m) => m.id))),
      members,
      multiSelect: g.multiSelect === true,
      source: 'hint'
    });
  });

  const byExplicit = new Map();
  fields.forEach((f) => {
    if (claimed.has(f.id) || !f.group) return;
    if (!byExplicit.has(f.group)) byExplicit.set(f.group, []);
    byExplicit.get(f.group).push(f);
  });
  byExplicit.forEach((members, name) => {
    if (members.length < 2) return;
    members.forEach((m) => claimed.add(m.id));
    groups.push({
      nameId: slug(name),
      question: groupQuestion(name),
      members,
      multiSelect: members.some((m) => m.raw.multiSelect === true),
      source: 'schema group'
    });
  });

  let run = [];
  const flushRun = () => {
    if (run.length >= 2) {
      const prefix = commonTokenPrefix(run.map((f) => f.id));
      if (prefix && prefix.split('_').length >= 1 && prefix.length >= 3) {
        run.forEach((m) => claimed.add(m.id));
        groups.push({
          nameId: prefix,
          question: groupQuestion(prefix),
          members: run.slice(),
          multiSelect: run.some((m) => m.raw.multiSelect === true),
          source: 'id prefix'
        });
      }
    }
    run = [];
  };
  fields.forEach((f) => {
    if (claimed.has(f.id)) { flushRun(); return; }
    if (!CHOICE_TYPES.has(f.type)) { flushRun(); return; }
    if (run.length && !commonTokenPrefix([run[0].id, f.id])) flushRun();
    run.push(f);
  });
  flushRun();

  return groups;
}

/** Strip a group's shared prefix off an option label when the label is empty. */
function optionLabel(field, groupNameId) {
  const label = cleanLabel(field.label);
  if (label) return label;
  const tail = field.id.startsWith(groupNameId) ? field.id.slice(groupNameId.length) : field.id;
  return titleCase(humanize(tail)) || field.id;
}

/**
 * Build the interview tree: a flat list of steps, where conditional fields are
 * nested as follow-ups under the option that enables them.
 */
function buildInterview(fields, hints) {
  // hints may re-state a field's conditional (the payload often cannot express
  // "show when Partnership OR Trust OR LLC-P")
  fields.forEach((f) => {
    const o = (hints.questions || {})[f.id] || (hints.questions || {})[f.nameId];
    if (o && o.conditional) f.conditional = o.conditional;
  });

  const groups = detectGroups(fields, hints);
  const groupOfField = new Map();
  groups.forEach((g) => g.members.forEach((m) => groupOfField.set(m.id, g)));

  const stepOf = new Map();     // nameId -> step
  const optionIndex = new Map(); // option nameId -> { step, option }
  const steps = [];
  const notes = [];

  function makeStep(spec) {
    const step = {
      nameId: spec.nameId,
      text: spec.text,
      type: spec.type,
      options: spec.options || null,
      section: null,
      field: spec.field || null,
      origin: spec.origin || 'field'
    };
    stepOf.set(step.nameId, step);
    (step.options || []).forEach((o) => {
      o.follow = o.follow || [];
      o._owner = step;
      optionIndex.set(o.nameId, { step, option: o });
    });
    return step;
  }

  /** Where does this step attach? Root spine, or under an option. */
  function place(step, host) {
    if (host && host.fromOptions) {
      // Gated on several options: it sits on the spine fed only by those
      // branches, with the others skipping around it. It must land directly
      // after the branching step it depends on, or the branch exits it needs
      // will already have been consumed by an intervening question.
      step.fromOptions = host.fromOptions;
      step._root = step;
      const anchors = host.owners
        .map((o) => steps.indexOf(rootOf(o._owner)))
        .filter((i) => i >= 0);
      const at = anchors.length ? Math.max(...anchors) + 1 : steps.length;
      steps.splice(at, 0, step);
    } else if (host) {
      step._root = rootOf(host._owner);
      host.follow.push(step);
    } else {
      step._root = step;
      steps.push(step);
    }
  }

  function rootOf(step) {
    let cur = step;
    const guard = new Set();
    while (cur && cur._root && cur._root !== cur && !guard.has(cur)) {
      guard.add(cur);
      cur = cur._root;
    }
    return cur;
  }

  function condTargets(cond) {
    const when = cond.onlyWhen || cond.when || cond.showWhen;
    if (!when) return [];
    return (Array.isArray(when) ? when : String(when).split(/\s*,\s*/)).filter(Boolean);
  }

  /**
   * Returns the option to nest under, or { fromOptions } when the field is
   * gated on several options and must sit on the spine below them with skip
   * paths around it.
   */
  function hostFor(field) {
    const cond = field.conditional;
    if (!cond) return null;
    const targets = condTargets(cond);
    if (!targets.length) return null;

    const hits = targets.map((t) => optionIndex.get(t) || optionIndex.get(slug(t))).filter(Boolean);
    if (hits.length && hits.length === targets.length) {
      // (a) all names are existing options
      if (hits.length === 1) return hits[0].option;
      return {
        fromOptions: hits.map((h) => h.option.nameId),
        owners: hits.map((h) => h.option)
      };
    }

    const when = targets[0];

    // (b) onlyWhen names a gate that does not exist yet -> create it
    const gateId = when;
    let gate = stepOf.get(gateId);
    if (!gate) {
      const gh = (hints.gates || {})[field.id] || (hints.gates || {})[field.nameId] || (hints.gates || {})[gateId];
      gate = makeStep({
        nameId: gateId,
        text: cond.gateQuestion || cond.question || (gh && gh.question) || gateQuestion(field.label),
        type: 'dropdown',
        options: YES_NO.map((o) => ({ ...o, follow: [] })),
        origin: 'gate'
      });
      notes.push(`created gate "${gateId}" -> ${gate.text}`);
      steps.push(gate);
    }
    return gate.options[0]; // Yes
  }

  const order = hints.order && hints.order.length
    ? hints.order.map((id) => fields.find((f) => f.id === id || f.nameId === id)).filter(Boolean)
        .concat(fields.filter((f) => !hints.order.includes(f.id) && !hints.order.includes(f.nameId)))
    : fields;

  const emittedGroups = new Set();

  const choices = (hints.choices || []).slice();

  // a gates hint on a field with no conditional still creates the gate
  fields.forEach((f) => {
    const gh = (hints.gates || {})[f.id] || (hints.gates || {})[f.nameId];
    if (gh && gh.nameId && !f.conditional) {
      f.conditional = { onlyWhen: gh.nameId, gateQuestion: gh.question };
    }
  });

  order.forEach((field) => {
    // an invented choice question the schema cannot express (trainer rule D)
    choices.filter((c) => c.before === field.id || c.before === field.nameId).forEach((c) => {
      const step = makeStep({
        nameId: c.nameId,
        text: c.question,
        type: c.type || 'dropdown',
        options: (c.options || []).map((o) => (
          typeof o === 'string'
            ? { label: o, nameId: slug(o), follow: [] }
            : { label: o.label, nameId: o.nameId || slug(o.label), follow: [] }
        )),
        origin: 'choice'
      });
      place(step, c.onlyWhen ? hostFor({ conditional: { onlyWhen: c.onlyWhen } }) : null);
      notes.push(`choice hint: "${c.question}" with ${step.options.length} options`);
      choices.splice(choices.indexOf(c), 1);
    });

    const override = (hints.questions || {})[field.id] || (hints.questions || {})[field.nameId];

    // 1. exclusive / multi-select family -> one question with option nodes
    const group = groupOfField.get(field.id);
    if (group) {
      if (emittedGroups.has(group)) return;
      emittedGroups.add(group);
      const step = makeStep({
        nameId: group.nameId,
        text: group.question,
        type: group.multiSelect ? 'checkbox' : 'dropdown',
        options: group.members.map((m) => ({
          label: optionLabel(m, group.nameId),
          nameId: m.nameId,
          follow: []
        })),
        field: null,
        origin: 'group'
      });
      place(step, hostFor(field));
      notes.push(`${group.source}: ${group.members.length} ${group.multiSelect ? 'checkbox' : 'exclusive'} fields -> "${group.question}"`);
      return;
    }

    // 2. explicit override — applied as a modifier so the rules below still run
    //    (an override with no options must not turn a lone checkbox into an
    //    optionless checkbox question; that exports as a Yes/No fallback)
    if (override) {
      if (override.text) field.question = override.text;
      if (override.nameId) field.nameId = override.nameId;
      if (override.type) field.type = override.type;
      if (override.options && override.options.length) field.options = override.options;
    }

    // 3. field carries its own options
    if (field.options && field.options.length) {
      const step = makeStep({
        nameId: field.nameId,
        text: field.question || valueQuestion(field.label, field.type),
        type: field.type === 'checkbox' ? 'checkbox' : 'dropdown',
        options: field.options.map((o) => (
          typeof o === 'string'
            ? { label: o, nameId: slug(o), follow: [] }
            : { label: o.label || o.text, nameId: o.nameId || slug(o.label || o.text), follow: [] }
        )),
        field
      });
      place(step, hostFor(field));
      return;
    }

    // 4. lone checkbox -> Yes/No dropdown (never a checkbox pair)
    if (CHOICE_TYPES.has(field.type)) {
      const step = makeStep({
        nameId: field.nameId,
        text: field.question || gateQuestion(field.label),
        type: 'dropdown',
        options: YES_NO.map((o) => ({ ...o, follow: [] })),
        field
      });
      place(step, hostFor(field));
      notes.push(`lone ${field.type} "${field.id}" -> Yes/No dropdown`);
      return;
    }

    // 5. optional value -> gate + value on Yes (never a bare "if any" box)
    const host = hostFor(field);
    const gateHint = (hints.gates || {})[field.id] || (hints.gates || {})[field.nameId];
    if ((field.optional || gateHint) && !host) {
      const gateId = (gateHint && gateHint.nameId) || `${field.nameId}_provided`;
      const gate = makeStep({
        nameId: gateId,
        text: (gateHint && gateHint.question) || gateQuestion(field.label),
        type: 'dropdown',
        options: YES_NO.map((o) => ({ ...o, follow: [] })),
        origin: 'gate'
      });
      steps.push(gate);
      const value = makeStep({
        nameId: field.nameId,
        text: field.question || valueQuestion(field.label, field.type),
        type: field.type,
        field
      });
      gate.options[0].follow.push(value);
      notes.push(`optional "${field.id}" -> gate "${gateId}" + value on Yes`);
      return;
    }

    // 6. plain value question
    const step = makeStep({
      nameId: field.nameId,
      text: field.question || valueQuestion(field.label, field.type),
      type: field.type,
      field
    });
    place(step, host);
  });

  return { steps, notes, groups };
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function walkSteps(steps, fn, depth = 0) {
  steps.forEach((s) => {
    fn(s, depth);
    (s.options || []).forEach((o) => walkSteps(o.follow || [], fn, depth + 1));
  });
}

/**
 * Sections come from the payload when it says so; otherwise from topic runs
 * (id prefix families), merged forward so no section has fewer than 2
 * questions, capped at the 7-colour rotation.
 */
function assignSections(steps, fields, hints, sectionPrefs) {
  const hinted = hints.sections || [];

  // (a) the payload says where sections start
  if (hinted.length) {
    const startAt = new Map();
    hinted.forEach((sec, i) => (sec.fields || []).forEach((f) => startAt.set(f, i)));
    hinted.forEach((sec, i) => {
      sectionPrefs[String(i + 1)] = {
        borderColor: SECTION_COLORS[i % SECTION_COLORS.length],
        name: sec.name || `Section ${i + 1}`
      };
    });
    let cur = 0;
    steps.forEach((step) => {
      if (startAt.has(step.nameId)) cur = startAt.get(step.nameId);
      walkSteps([step], (sub) => { sub.section = cur + 1; });
    });
    return hinted.length;
  }

  // (b) otherwise: topic runs (id prefix families), merged forward so no
  //     section holds fewer than 2 questions, capped at the colour rotation
  const explicit = new Map();
  fields.forEach((f) => { if (f.section) explicit.set(f.nameId, f.section); });

  const topic = (step) => {
    const tokens = String(step.nameId || '').split('_');
    return tokens.length > 1 ? tokens[0] : (step.nameId || '');
  };

  const runs = [];
  steps.forEach((step) => {
    const t = topic(step);
    const last = runs[runs.length - 1];
    if (last && last.topic === t) last.steps.push(step);
    else runs.push({ topic: t, steps: [step] });
  });

  const merged = [];
  runs.forEach((r) => {
    const last = merged[merged.length - 1];
    if (last && last.steps.length < 2) last.steps.push(...r.steps);
    else merged.push({ topic: r.topic, steps: r.steps.slice() });
  });
  while (merged.length > 1 && merged[merged.length - 1].steps.length < 2) {
    const tail = merged.pop();
    merged[merged.length - 1].steps.push(...tail.steps);
  }
  while (merged.length > SECTION_COLORS.length) {
    let smallest = 0;
    merged.forEach((r, i) => { if (r.steps.length < merged[smallest].steps.length) smallest = i; });
    const into = smallest > 0 ? smallest - 1 : 1;
    merged[into].steps.push(...merged[smallest].steps);
    merged.splice(smallest, 1);
  }

  merged.forEach((run, i) => {
    const num = i + 1;
    const named = run.steps.map((s2) => explicit.get(s2.nameId)).find((v) => v && v.name);
    sectionPrefs[String(num)] = {
      borderColor: SECTION_COLORS[(num - 1) % SECTION_COLORS.length],
      name: (named && named.name) || titleCase(humanize(run.topic)) || `Section ${num}`
    };
    run.steps.forEach((step) => walkSteps([step], (sub) => { sub.section = num; }));
  });

  return merged.length;
}

/* ------------------------------------------------------------------ */
/* builder                                                             */
/* ------------------------------------------------------------------ */

function createBuilder() {
  let nextId = 2;
  let questionCounter = 1;
  const cells = [];
  const pendingEdges = [];
  const sectionPrefs = {};

  function id() {
    let assigned = nextId++;
    // never mint 1 or 19: the editor has historically special-cased them
    while (assigned === 1 || assigned === 19) assigned = nextId++;
    return String(assigned);
  }

  function sectionStyle(section) {
    const key = String(section);
    if (!sectionPrefs[key]) {
      sectionPrefs[key] = {
        borderColor: SECTION_COLORS[(section - 1) % SECTION_COLORS.length],
        name: `Section ${section}`
      };
    }
    return sectionPrefs[key].borderColor;
  }

  function addVertex(cell) {
    cell._pdfName = cell._pdfName ?? '';
    cell._pdfFile = cell._pdfFile ?? '';
    cell._pdfPrice = cell._pdfPrice ?? '';
    cells.push(cell);
    return cell;
  }

  function addEdge(source, target, kind) {
    pendingEdges.push({ source, target, kind: kind || 'normal' });
  }

  function addHub(cx, y, nameId) {
    return addVertex({
      id: id(),
      value: '',
      geometry: { x: Math.round(cx - HUB_SIZE / 2), y: Math.round(y), width: HUB_SIZE, height: HUB_SIZE },
      style: 'ellipse;whiteSpace=wrap;html=1;nodeType=mergeHub;fillColor=#4a6fa5;strokeColor=#4a6fa5;',
      vertex: true,
      edge: false,
      source: null,
      target: null,
      _nameId: nameId || 'merge_hub'
    });
  }

  function funnelInto(sources, target) {
    sources.forEach((s) => addEdge(s.id, target.id, 'funnel'));
  }

  function addQuestion({ text, type, nameId, section, x, y, mirrorTargets }) {
    const box = fitBox(text, { minW: Q_W, minH: Q_H, maxW: Q_W });
    const stroke = sectionStyle(section);
    return addVertex({
      id: id(),
      value: text,
      geometry: {
        x: Math.round(x ?? (CENTER_X - box.width / 2)),
        y: Math.round(y),
        width: box.width,
        height: box.height
      },
      style: `shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;spacing=16;fontSize=16;align=center;verticalAlign=middle;questionType=${type};nodeId=${nameId};section=${section};fillColor=#80bfff;fontColor=#070665;strokeColor=${stroke}`,
      vertex: true,
      edge: false,
      source: null,
      target: null,
      _textboxes: null,
      _questionText: text,
      _questionId: String(questionCounter++),
      _nameId: nameId,
      _placeholder: '',
      _mirrorTargets: (mirrorTargets && mirrorTargets.length) ? mirrorTargets : null
    });
  }

  function addOptions(question, options, type, section) {
    const stroke = sectionStyle(section);
    const boxes = options.map((opt) => ({
      label: opt.label,
      nameId: opt.nameId || slug(opt.label),
      ...fitBox(opt.label, { minW: O_W, minH: O_H, maxW: 260 })
    }));
    const rowH = Math.max(...boxes.map((b) => b.height));
    const total = boxes.reduce((s, b) => s + b.width, 0) + (boxes.length - 1) * OPTION_GAP;
    const qg = question.geometry;
    const qcx = qg.x + qg.width / 2;

    let sourceId = question.id;
    let y;
    if (options.length >= OUT_SPLIT_MIN) {
      // 3+ outgoing: one trunk into a split hub, then a shared fan-out bus
      const hub = addHub(qcx, qg.y + qg.height + SPLIT_TRUNK, `${question._nameId || 'q'}_split_hub`);
      addEdge(question.id, hub.id, 'trunk');
      sourceId = hub.id;
      y = hub.geometry.y + HUB_SIZE + SPLIT_BUS;
    } else {
      y = qg.y + qg.height + BUS;
    }

    let x = qcx - total / 2;
    return boxes.map((box) => {
      const cell = addVertex({
        id: id(),
        value: box.label,
        geometry: { x: Math.round(x), y: Math.round(y), width: box.width, height: rowH },
        style: `shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=${type};spacing=16;fontSize=16;align=center;verticalAlign=middle;section=${section};fillColor=#ffffff;fontColor=#070665;strokeColor=${stroke}`,
        vertex: true,
        edge: false,
        source: null,
        target: null,
        _nameId: box.nameId
      });
      addEdge(sourceId, cell.id, 'fanout');
      x += box.width + OPTION_GAP;
      return cell;
    });
  }

  function addEnd(cx, y) {
    return addVertex({
      id: id(),
      value: 'End',
      geometry: { x: Math.round(cx - 60), y: Math.round(y), width: 120, height: 60 },
      style: 'shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=end;fillColor=#CCCCCC;fontColor=#000000;spacing=12;fontSize=16;',
      vertex: true,
      edge: false,
      source: null,
      target: null
    });
  }

  const mark = () => cells.length;

  function bboxSince(from) {
    const slice = cells.slice(from).filter((c) => c.vertex);
    if (!slice.length) return { x: 0, y: 0, width: 0, height: 0 };
    const x0 = Math.min(...slice.map((c) => c.geometry.x));
    const x1 = Math.max(...slice.map((c) => c.geometry.x + c.geometry.width));
    const y0 = Math.min(...slice.map((c) => c.geometry.y));
    const y1 = Math.max(...slice.map((c) => c.geometry.y + c.geometry.height));
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  function translateSince(from, dx) {
    if (!dx) return;
    cells.slice(from).forEach((c) => { if (c.vertex) c.geometry.x = Math.round(c.geometry.x + dx); });
  }

  return {
    cells, pendingEdges, sectionPrefs,
    addVertex, addEdge, addHub, funnelInto, addQuestion, addOptions, addEnd,
    mark, bboxSince, translateSince
  };
}

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

/**
 * Lay a sequence of steps down a spine at centerX. Branch columns are laid out
 * relative to x=0 and then translated into a packed row, so side-by-side
 * follow-ups can never overlap (trainer rule 4.1).
 */
function layoutSequence(b, steps, startY, centerX) {
  let entry = null;
  let exits = null;   // [{ cell, origin }] — origin = option nameId this exit came from
  let y = startY;

  steps.forEach((step) => {
    // A step may be gated on several options at once ("show if Partnership,
    // Trust or LLC-P"). Those exits feed it; every other exit skips around it
    // and merges at the next join instead.
    const gatedOn = step.fromOptions && step.fromOptions.length ? step.fromOptions : null;
    const matches = (e) => gatedOn.some((g) => e.origins.includes(g));
    const incoming = gatedOn && exits ? exits.filter(matches) : exits;
    const bypass = gatedOn && exits ? exits.filter((e) => !matches(e)) : [];

    let qy = y;
    let joinHub = null;
    if (incoming && incoming.length > 1) {
      joinHub = b.addHub(centerX, y, `${step.nameId}_join`);
      b.funnelInto(incoming.map((e) => e.cell), joinHub);
      qy = joinHub.geometry.y + HUB_SIZE + JOIN_TRUNK;
    }

    const q = b.addQuestion({
      text: step.text,
      type: step.type,
      nameId: step.nameId,
      section: step.section || 1,
      x: centerX - Q_W / 2,
      y: qy,
      // Set only on mirrored fields; every step carries its source field.
      mirrorTargets: step.field ? step.field.mirrorTargets : null
    });
    step.cell = q;

    if (!entry) entry = joinHub || q;
    if (incoming && incoming.length) {
      if (joinHub) b.addEdge(joinHub.id, q.id, 'trunk');
      else b.addEdge(incoming[0].cell.id, q.id);
    }

    if (!step.options || !step.options.length) {
      exits = [{ cell: q, origins: [] }].concat(bypass);
      y = q.geometry.y + q.geometry.height + TEXT_GAP;
      return;
    }

    const optionCells = b.addOptions(q, step.options, step.type, step.section || 1);
    step.optionCells = optionCells;
    const branchY = Math.max(...optionCells.map((o) => o.geometry.y + o.geometry.height)) + BRANCH_GAP;

    const branches = step.options.map((opt, i) => {
      const optionCell = optionCells[i];
      if (!opt.follow || !opt.follow.length) {
        return { optionCell, exits: [{ cell: optionCell, origins: [opt.nameId] }], mark: null };
      }
      const from = b.mark();
      const sub = layoutSequence(b, opt.follow, branchY, 0); // relative column
      return {
        optionCell,
        // prepend the option that opened this branch, keeping the whole chain
        // so an outer gate can name an option nested several levels down
        exits: sub.exits.map((e) => ({ cell: e.cell, origins: [opt.nameId].concat(e.origins || []) })),
        entry: sub.entry,
        mark: from,
        bbox: b.bboxSince(from)
      };
    });

    const withFollow = branches.filter((x) => x.mark !== null);
    if (withFollow.length) {
      const prefXs = withFollow.map((x) => (
        x.optionCell.geometry.x + x.optionCell.geometry.width / 2 - x.bbox.width / 2
      ));
      const packed = packRow(prefXs, withFollow.map((x) => x.bbox.width), NODE_GAP);
      withFollow.forEach((x, i) => {
        b.translateSince(x.mark, packed[i] - x.bbox.x);
        b.addEdge(x.optionCell.id, x.entry.id);
      });
    }

    exits = branches.reduce((acc, x) => acc.concat(x.exits), []).concat(bypass);
    y = Math.max(branchY, ...exits.map((e) => e.cell.geometry.y + e.cell.geometry.height)) + BRANCH_GAP;
  });

  return { entry, exits: exits || [], bottomY: y };
}

/* ------------------------------------------------------------------ */
/* compile                                                             */
/* ------------------------------------------------------------------ */

function compile(schema, hints = {}) {
  const merged = Object.assign({}, schema.interview || {}, hints);
  const fields = applyMirrors(normalizeFields(schema), merged);
  const { steps, notes, groups } = buildInterview(fields, merged);

  const b = createBuilder();
  const sectionCount = assignSections(steps, fields, merged, b.sectionPrefs);

  const seq = layoutSequence(b, steps, 60, CENTER_X);

  // every path reaches End
  const endY = seq.bottomY;
  if (seq.exits.length > 1) {
    const hub = b.addHub(CENTER_X, endY, 'end_join');
    b.funnelInto(seq.exits.map((e) => e.cell), hub);
    const end = b.addEnd(CENTER_X, hub.geometry.y + HUB_SIZE + JOIN_TRUNK);
    b.addEdge(hub.id, end.id, 'trunk');
  } else if (seq.exits.length === 1) {
    const end = b.addEnd(CENTER_X, endY);
    b.addEdge(seq.exits[0].cell.id, end.id);
  }

  // boxes first, wires second — never route before nodes are separated
  const moved = separateOverlappingNodes(b.cells);
  routeCircuitBoard(b.cells, b.pendingEdges);

  const flowchart = {
    formName: schema.formTitle || schema.formName || 'Untitled Form',
    edgeStyle: 'curved',
    cells: b.cells,
    sectionPrefs: b.sectionPrefs,
    groups: [],
    defaultPdfProperties: schema.defaultPdfProperties || {
      pdfName: schema.formTitle || 'Form',
      pdfFile: 'form.pdf',
      pdfPrice: '0'
    }
  };

  return { flowchart, notes, groups, steps, fields, sectionCount, moved };
}

/* ------------------------------------------------------------------ */
/* audit                                                               */
/* ------------------------------------------------------------------ */

function audit({ flowchart, fields, steps, notes }) {
  const cells = flowchart.cells;
  const verts = cells.filter((c) => c.vertex);
  const edges = cells.filter((c) => c.edge);
  const questions = verts.filter(isQuestionCell);
  const issues = [];

  console.log('\n--- interview inference ---');
  notes.forEach((n) => console.log(' *', n));

  console.log('\n--- form audit (hubs are transparent) ---');
  questions.forEach((q) => {
    const type = questionTypeOf(q);
    const opts = walkOutgoing(flowchart, q.id).filter(isOptionCell).map((o) => o.value);
    console.log(` ${q._nameId} [${type}]`, opts.length ? opts.join(' | ') : '(no options)');
    if ((type === 'dropdown' || type === 'checkbox') && opts.length < 2) {
      issues.push(`${q._nameId}: ${type} exports ${opts.length} option(s); Preview Form would fall back to Yes/No`);
    }
  });

  // every schema field must survive as a nodeId or option _nameId
  const names = new Set(verts.map((v) => v._nameId).filter(Boolean));
  const missing = fields.filter((f) => !names.has(f.nameId) && !names.has(f.id));
  if (missing.length) issues.push(`fields absent from the flowchart: ${missing.map((f) => f.id).join(', ')}`);

  // node overlap
  const overlaps = countNodeOverlaps(cells, 0);
  if (overlaps.length) issues.push(`${overlaps.length} node pair(s) overlap: ${overlaps.slice(0, 5).map((p) => p.join(' / ')).join('; ')}`);

  // wires must not cross foreign nodes
  let crossings = 0;
  edges.forEach((e) => {
    const pts = (e.edgeGeometry && e.edgeGeometry.points) || [];
    const s = verts.find((v) => v.id === e.source);
    const t = verts.find((v) => v.id === e.target);
    if (!s || !t) return;
    const full = [
      { x: s.geometry.x + s.geometry.width / 2, y: s.geometry.y + s.geometry.height },
      ...pts,
      { x: t.geometry.x + t.geometry.width / 2, y: t.geometry.y }
    ];
    verts.forEach((v) => {
      if (v.id === e.source || v.id === e.target) return;
      const g = v.geometry;
      const r = { x: g.x + 2, y: g.y + 2, w: g.width - 4, h: g.height - 4 };
      for (let i = 0; i < full.length - 1; i++) {
        if (segmentHitsRect(full[i], full[i + 1], r)) { crossings += 1; return; }
      }
    });
  });
  if (crossings) issues.push(`${crossings} edge/node crossing(s)`);

  // reachability: every vertex reaches an End node
  const endIds = new Set(verts.filter((v) => (v.style || '').includes('nodeType=end')).map((v) => v.id));
  if (!endIds.size) issues.push('no End node');
  const out = new Map();
  edges.forEach((e) => {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source).push(e.target);
  });
  const reachesEnd = new Set(endIds);
  let changed = true;
  while (changed) {
    changed = false;
    verts.forEach((v) => {
      if (reachesEnd.has(v.id)) return;
      if ((out.get(v.id) || []).some((t) => reachesEnd.has(t))) { reachesEnd.add(v.id); changed = true; }
    });
  }
  const dead = verts.filter((v) => !reachesEnd.has(v.id));
  if (dead.length) issues.push(`${dead.length} node(s) never reach End: ${dead.slice(0, 5).map((v) => v._nameId || v.value).join(', ')}`);

  console.log('\n--- checks ---');
  console.log(' cells', cells.length, '| vertices', verts.length, '| edges', edges.length,
    '| routed', edges.filter((e) => e.edgeGeometry && e.edgeGeometry.points).length);
  console.log(' node overlaps', overlaps.length, '| edge/node crossings', crossings,
    '| unreachable', dead.length, '| missing fields', missing.length);

  if (issues.length) {
    console.warn('\nAUDIT FAILED');
    issues.forEach((i) => console.warn(' -', i));
  } else {
    console.log('\naudit ok');
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* cli                                                                 */
/* ------------------------------------------------------------------ */

if (require.main === module) {
  const argv = process.argv.slice(2);
  const hintsAt = argv.indexOf('--hints');
  let hints = {};
  if (hintsAt !== -1) {
    hints = JSON.parse(fs.readFileSync(argv[hintsAt + 1], 'utf8'));
    argv.splice(hintsAt, 2);
  }
  const schemaPath = argv[0];
  if (!schemaPath) {
    console.error('usage: node compile-form.js <schema.txt|json> [out.json] [--hints hints.json]');
    process.exit(1);
  }
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const result = compile(schema, hints);
  const outPath = argv[1] || path.join(
    __dirname,
    `${slug(result.flowchart.formName).slice(0, 40) || 'form'}-flowchart.json`
  );
  const issues = audit(result);
  fs.writeFileSync(outPath, JSON.stringify(result.flowchart, null, 2));
  console.log('\nWrote', outPath);
  process.exitCode = issues.length ? 2 : 0;
}

module.exports = { compile, audit, buildInterview, normalizeFields };
