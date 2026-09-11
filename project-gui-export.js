/**
 * Project-level GUI JSON — every form in the project as one interview.
 *
 * exportGuiJson only ever describes the open form, so this loads each form in
 * turn, exports it, and merges the results. Section and question ids restart at
 * 1 in every form, so both are offset while merging and every reference to them
 * is rewritten to match.
 *
 * The merged file carries two extra keys the runtime needs:
 *   projectForms     — each form's section range, in order
 *   formActivations  — which answer switches a form on
 *
 * A form is only asked when something activates it. A connector fed by an
 * option activates on that answer; a connector wired to nothing activates
 * unconditionally. The first form is always included.
 */
(function () {
  'use strict';

  // A form's load leaves work on timers: the section legend at 50-100 ms, PDF
  // names spread down the chart at 500, node ids corrected at 1000, the name
  // field at 1200, PDF inheritance and node ids reset at 3000, the load marked
  // done at 4000. All of it runs before the form is exported.
  const LOAD_HORIZON_MS = 4000;
  // Ids for the timers run here, well clear of the browser's own.
  const VIRTUAL_TIMER_BASE = 2e9;
  const MAX_LOAD_STEPS = 10000;

  /**
   * Open form `index` and run the work its load leaves on timers straight
   * away, in the order the timers would have fired, so the form has settled
   * when this returns.
   *
   * The export used to wait a fixed 1.5 s after each switch: 12 s for an
   * eight-form packet, and longer once the editor tab is behind the Preview
   * Form tab, where the browser runs timers at most once a second. The wait
   * also ended before the 3 s reset, so each form's reset ran on the next form.
   * Timers set for later than the horizon are left to the browser.
   */
  function openFormSettled(index) {
    const realSetTimeout = window.setTimeout;
    const realClearTimeout = window.clearTimeout;
    const pending = [];
    const cancelled = new Set();
    let now = 0;
    let seq = 0;
    window.setTimeout = function (fn, ms) {
      const delay = Math.max(0, Number(ms) || 0);
      if (typeof fn !== 'function' || now + delay > LOAD_HORIZON_MS) {
        return realSetTimeout.apply(window, arguments);
      }
      seq++;
      pending.push({ at: now + delay, seq: seq, fn: fn, args: Array.prototype.slice.call(arguments, 2) });
      return VIRTUAL_TIMER_BASE + seq;
    };
    window.clearTimeout = function (id) {
      if (typeof id === 'number' && id > VIRTUAL_TIMER_BASE) cancelled.add(id - VIRTUAL_TIMER_BASE);
      else realClearTimeout.apply(window, arguments);
    };
    try {
      window.switchToProjectForm(index, true);
      let steps = 0;
      while (pending.length && steps < MAX_LOAD_STEPS) {
        pending.sort(function (a, b) { return a.at - b.at || a.seq - b.seq; });
        const next = pending.shift();
        if (cancelled.has(next.seq)) continue;
        now = next.at;
        steps++;
        try {
          next.fn.apply(window, next.args);
        } catch (err) {
          console.error(err);
        }
      }
      // A step that keeps rescheduling itself goes back to the browser.
      pending.forEach(function (t) {
        if (!cancelled.has(t.seq)) realSetTimeout.apply(window, [t.fn, t.at - now].concat(t.args));
      });
    } finally {
      window.setTimeout = realSetTimeout;
      window.clearTimeout = realClearTimeout;
    }
  }

  /** Highest question id in one form's GUI JSON, so the next form starts past it. */
  function maxQuestionId(gui) {
    let max = 0;
    (gui.sections || []).forEach(function (s) {
      (s.questions || []).forEach(function (q) {
        const id = parseInt(q.questionId, 10);
        if (!isNaN(id) && id > max) max = id;
      });
    });
    return max;
  }

  /**
   * Shift one form's ids into the merged numbering.
   *
   * Anything naming a question or section by number has to move with it, or the
   * logic silently points at whatever now holds that id in another form.
   */
  function offsetForm(gui, sectionOffset, questionOffset) {
    (gui.sections || []).forEach(function (section) {
      section.sectionId = (parseInt(section.sectionId, 10) || 0) + sectionOffset;

      (section.questions || []).forEach(function (q) {
        q.questionId = (parseInt(q.questionId, 10) || 0) + questionOffset;

        // "Show this question when question N answered X"
        if (q.logic && Array.isArray(q.logic.conditions)) {
          q.logic.conditions.forEach(function (c) {
            const prev = parseInt(c.prevQuestion, 10);
            if (!isNaN(prev)) c.prevQuestion = String(prev + questionOffset);
          });
        }
        // "Jump to section N" - "end" is a keyword and must survive untouched.
        if (q.jump && Array.isArray(q.jump.conditions)) {
          q.jump.conditions.forEach(function (c) {
            const to = parseInt(c.to, 10);
            if (!isNaN(to) && String(c.to).toLowerCase() !== 'end') {
              c.to = String(to + sectionOffset);
            }
          });
        }
        // Hidden-field logic names its trigger question the same way.
        if (q.hiddenLogic && Array.isArray(q.hiddenLogic)) {
          q.hiddenLogic.forEach(function (h) {
            if (!h || !Array.isArray(h.conditions)) return;
            h.conditions.forEach(function (c) {
              const prev = parseInt(c.prevQuestion, 10);
              if (!isNaN(prev)) c.prevQuestion = String(prev + questionOffset);
            });
          });
        }
      });
    });
    return gui;
  }

  /**
 * Ask each shared value once.
 *
 * The packet shares a lot of fields - the case number appears on all three
 * forms, as do the party names, court address and hearing date. Separately
 * that is fine; merged into one interview those become duplicate DOM ids,
 * where answers overwrite each other, and the person is asked the same thing
 * three times.
 *
 * The first question with a given nameId survives; later duplicates are
 * dropped and every reference to them is repointed at the survivor. The
 * dropped questions are recorded in packetMirrors so the filler still knows
 * every PDF field the single answer has to reach.
 */
function collapseSharedQuestions(merged) {
  const firstByName = new Map();
  const replacement = new Map();
  const mirrors = [];

  merged.sections.forEach(function (section) {
    const keep = [];
    section.questions.forEach(function (q) {
      // A question that owns a PDF field is identified by that field's name.
      // A repeating block owns a family rather than one field, so its identity
      // is the block's nodeId - and without this a block shared by two forms
      // (the other protected people are on DV-100 and DV-110 alike) is asked
      // once per form, because nameId is undefined on both.
      const name = q.nameId || q.nodeId;
      if (!name) { keep.push(q); return; }

      const first = firstByName.get(name);
      if (!first) {
        firstByName.set(name, { question: q, section: section.sectionId });
        mirrors.push({ nameId: name, askedInSection: section.sectionId,
                       questionId: q.questionId, alsoAnswers: [] });
        keep.push(q);
        return;
      }
      // Same value, asked again later in the packet - drop it.
      replacement.set(String(q.questionId), String(first.question.questionId));
      const record = mirrors.find(function (m) { return m.nameId === name; });
      if (record) record.alsoAnswers.push({ questionId: q.questionId, section: section.sectionId });
    });
    section.questions = keep;
  });

  if (replacement.size) repointReferences(merged, replacement);

  // Only the ones that actually stood in for something are worth carrying.
  merged.packetMirrors = mirrors.filter(function (m) { return m.alsoAnswers.length; });
  return replacement.size;
}

/** Repoint every reference from a dropped question to the one that replaced it. */
function repointReferences(merged, replacement) {
  // Form activations name their trigger question too; a rule left pointing at
  // a dropped duplicate would stop switching its form on.
  (merged.formActivations || []).forEach(function (rule) {
    const to = replacement.get(String(rule.questionId));
    if (to) rule.questionId = to;
  });
  merged.sections.forEach(function (section) {
    section.questions.forEach(function (q) {
      if (q.logic && Array.isArray(q.logic.conditions)) {
        q.logic.conditions.forEach(function (c) {
          const to = replacement.get(String(c.prevQuestion));
          if (to) c.prevQuestion = to;
        });
      }
      if (Array.isArray(q.hiddenLogic)) {
        q.hiddenLogic.forEach(function (h) {
          if (!h || !Array.isArray(h.conditions)) return;
          h.conditions.forEach(function (c) {
            const to = replacement.get(String(c.prevQuestion));
            if (to) c.prevQuestion = to;
          });
        });
      }
    });
  });
}

/**
 * The name the merged config gives a form, from any name that form goes by.
 *
 * A form answers to several: the project slot's name, the flowchart's own
 * formName, and the PDF's display name. A connector may have recorded any of
 * them. Match on the exact string first, then case-insensitively, then on one
 * being the start of the other ("DV-109" against "DV-109 Notice of Court
 * Hearing"), which is what renaming actually does to it.
 */
function canonicalFormName(name, identity) {
  const wanted = String(name == null ? '' : name).trim();
  if (!wanted || !identity || !identity.length) return wanted;
  const lower = wanted.toLowerCase();
  for (let i = 0; i < identity.length; i++) {
    if (identity[i].names.indexOf(wanted) !== -1) return identity[i].canonical;
  }
  for (let i = 0; i < identity.length; i++) {
    const names = identity[i].names;
    for (let j = 0; j < names.length; j++) {
      if (String(names[j]).toLowerCase() === lower) return identity[i].canonical;
    }
  }
  for (let i = 0; i < identity.length; i++) {
    const names = identity[i].names;
    for (let j = 0; j < names.length; j++) {
      const other = String(names[j]).toLowerCase();
      if (!other) continue;
      if (other.indexOf(lower) === 0 || lower.indexOf(other) === 0) {
        return identity[i].canonical;
      }
    }
  }
  return wanted;
}

/**
   * Activation rules from the project's connectors, keyed by target form name.
   *
   * A connector points at an option node, but that node is not what the
   * generated form renders. A dropdown option is a value on one <select>, and
   * an option node carrying no Node ID leaves nothing in the flowchart to name
   * it by at all - the old rule then fell back to the mxGraph cell id ("6"),
   * which matches nothing in the page, so the form never switched on and the
   * interview ended at the first form instead.
   *
   * So each rule also carries the question that owns the option, in the merged
   * numbering and under the name the form gives it. That is the anchor the
   * runtime can always resolve, and it keeps a bare "Yes" from being confused
   * with the same answer to some other question.
   *
   * @param {Array<Map<string, object>>} questionsByForm  per-form questionId ->
   *        question, captured before the ids were shifted
   * @param {number[]} questionOffsets  how far each form's ids moved
   */
  function buildActivations(questionsByForm, questionOffsets, formIdentity) {
    if (typeof window.collectProjectConnectors !== 'function') return [];
    return window.collectProjectConnectors().map(function (c) {
      const rule = {
        // A connector stores the name the target form had when it was drawn,
        // and a form's display name is not stable: the editor renames a slot
        // from the flowchart's own formName whenever it loads one, so a
        // connector to "DV-109" ends up pointing at a form now called
        // "DV-109 Notice of Court Hearing". The runtime matches the rule to
        // the form by that string, so the drift silently switched two of the
        // three forms off - the interview stopped after DV-100 and the packet
        // produced one PDF. Resolve to the name the merged config actually
        // uses, so the two sides cannot drift apart again.
        targetForm: canonicalFormName(c.targetForm, formIdentity),
        unconditional: !!c.unconditional,
        optionNameId: c.optionNodeId || null,
        optionLabel: c.optionLabel || null,
        fromForm: canonicalFormName(c.fromForm, formIdentity)
      };
      if (rule.unconditional) return rule;

      const byId = questionsByForm[c.fromFormIndex];
      const question = (byId && c.questionId) ? byId.get(String(c.questionId)) : null;
      if (!question) return rule;

      rule.questionId = String((parseInt(c.questionId, 10) || 0)
        + (questionOffsets[c.fromFormIndex] || 0));
      if (question.nameId) rule.questionNameId = question.nameId;

      // The option's exported name, which is what the page actually renders.
      // A checkbox option carries its own name; a dropdown option does not -
      // its Node ID survives only as the hidden field the answer is mirrored
      // into, and library.js qualifies a generic "yes" into "<question>_yes"
      // on the way, so the raw name off the flowchart cell matches nothing.
      const label = String(c.optionLabel || '').trim().toLowerCase();
      const sameLabel = function (text) {
        return String(text == null ? '' : text).trim().toLowerCase() === label;
      };
      const option = (question.options || []).find(function (o) {
        if (o && typeof o === 'object') return sameLabel(o.text) || sameLabel(o.label);
        return sameLabel(o);
      });
      const mirrored = (((question.hiddenLogic || {}).configs) || []).find(function (h) {
        return h && h.nodeId && sameLabel(h.trigger);
      });
      if (option && option.nameId) rule.optionNameId = option.nameId;
      else if (mirrored) rule.optionNameId = mirrored.nodeId;
      return rule;
    });
  }

/**
 * Drop sections the packet no longer asks anything in.
 *
 * A cover form can be entirely made of answers another form already collected -
 * DV-109 asks for the two party names and the court, all of which DV-100 asked
 * first - and once those duplicates collapse, its section holds nothing. Left in
 * place that is a progress step with no questions: the filer clicks Next twice
 * through an empty page for a form they never have to fill. The form itself is
 * still produced and still filled; it just has nothing to ask.
 *
 * Sections are renumbered, so everything that names a section by number moves
 * with them.
 */
function dropEmptySections(merged) {
  const kept = merged.sections.filter(function (s) { return (s.questions || []).length; });
  if (kept.length === merged.sections.length) return [];

  const removed = merged.sections.filter(function (s) { return !(s.questions || []).length; });
  const renumber = new Map();
  kept.forEach(function (section, i) {
    renumber.set(String(section.sectionId), i + 1);
    section.sectionId = i + 1;
  });
  merged.sections = kept;
  merged.sectionCounter = kept.length + 1;

  // "Jump to section N" has to follow the renumbering; "end" is a keyword.
  kept.forEach(function (section) {
    section.questions.forEach(function (q) {
      if (!q.jump || !Array.isArray(q.jump.conditions)) return;
      q.jump.conditions.forEach(function (c) {
        if (String(c.to).toLowerCase() === 'end') return;
        const to = renumber.get(String(c.to));
        if (to) c.to = String(to);
      });
    });
  });

  (merged.projectForms || []).forEach(function (form) {
    const ids = [];
    for (let n = form.firstSection; n <= form.lastSection; n++) {
      const to = renumber.get(String(n));
      if (to) ids.push(to);
    }
    // A form with nothing left to ask keeps its place in the packet and its PDF;
    // it simply owns no section, so navigation never lands in it.
    form.firstSection = ids.length ? Math.min.apply(null, ids) : 0;
    form.lastSection = ids.length ? Math.max.apply(null, ids) : -1;
    form.asksNothing = ids.length === 0;
  });

  (merged.packetMirrors || []).forEach(function (m) {
    const asked = renumber.get(String(m.askedInSection));
    if (asked) m.askedInSection = asked;
    (m.alsoAnswers || []).forEach(function (a) {
      const to = renumber.get(String(a.section));
      if (to) a.section = to;
    });
  });

  const gone = new Set(removed.map(function (s) { return String(s.sectionName || '').trim(); }));
  (merged.groups || []).forEach(function (g) {
    g.sections = (g.sections || []).filter(function (name) { return !gone.has(String(name).trim()); });
  });

  return removed.map(function (s) { return s.sectionName; });
}

/**
 * One form's groups, with the obvious default filled in.
 *
 * A group holds its sections by display name, and the packet's progress bar
 * only shows group names when at least one group actually holds a section.
 * Naming one group per form and never opening "Add Section to Group" is the
 * natural way to use this, and it quietly produced a stepper labelled by
 * section instead - so a form whose only group lists nothing gives that group
 * the whole form. Two or more empty groups in one form say nothing about where
 * the split falls, so those are left alone and reported instead.
 */
function groupsForForm(gui) {
  const groups = (gui.groups || []).map(function (g) {
    return { name: g.name || '', sections: (g.sections || []).slice() };
  });
  if (groups.length !== 1 || groups[0].sections.length) return groups;

  groups[0].sections = (gui.sections || [])
    .map(function (s) { return String(s.sectionName || '').trim(); })
    .filter(Boolean);
  return groups;
}

/**
 * Say why a packet's progress bar will fall back to section names.
 *
 * The stepper is group-based only when at least one group actually holds
 * sections, and a group names its sections by their display name - so an empty
 * group, or two forms that share a section name, silently costs a step.
 * Neither is visible in the editor, so report both at export time.
 */
function reportGroupProblems(merged) {
  const groups = merged.groups || [];
  if (!groups.length) return;

  const empty = groups.filter(function (g) { return !(g.sections || []).length; });
  if (empty.length) {
    console.warn('[project-gui] ' + empty.length + ' group(s) hold no sections, so they '
      + 'cannot appear in the progress bar: '
      + empty.map(function (g) { return g.name; }).join(', ')
      + '. Add each form\'s sections to its group with "Add Section to Group".');
  }
  if (empty.length === groups.length) {
    console.warn('[project-gui] No group holds a section, so the form falls back to '
      + 'one progress step per section.');
  }

  // Groups point at sections by name, so a name used twice in the packet can
  // only ever belong to one group.
  const seen = new Set();
  const clashes = new Set();
  (merged.sections || []).forEach(function (section) {
    const name = String(section.sectionName || '').trim();
    if (!name) return;
    if (seen.has(name)) clashes.add(name);
    seen.add(name);
  });
  if (clashes.size) {
    console.warn('[project-gui] Section name(s) used by more than one form: '
      + Array.from(clashes).join(', ')
      + '. Groups match sections by name, so give each one its own name.');
  }
}

  /**
   * Load every form, export each, and merge. Restores whichever form was open.
   */
  async function buildProjectGuiJson() {
    if (typeof window.captureCurrentProjectForm === 'function') {
      window.captureCurrentProjectForm();
    }
    const forms = window.projectForms || [];
    if (!forms.length) throw new Error('This project has no forms.');

    const startIndex = window.currentFormIndex;
    // Read before the walk. switchToProjectForm captures the canvas back into
    // the slot it leaves, and that capture rebuilds the flowchart from cells -
    // so anything the compiler wrote beside them is gone by the time the loop
    // comes back round.
    const computedBefore = forms.map(function (f) {
      return (f.flowchart && f.flowchart.computedFields) || [];
    });
    const overflowBefore = forms.map(function (f) {
      return (f.flowchart && f.flowchart.overflowLinks) || [];
    });
    const perForm = [];

    // Nobody looks at the forms the walk passes through, and redrawing each
    // one - after its load, its edge style, its PDF names, every node-id
    // reset - was most of the export's time. So the canvas draws nothing
    // until the walk is over and the operator's form is back.
    const view = window.graph ? window.graph.view : null;
    const wasRendering = view ? view.rendering : true;
    if (view) view.rendering = false;
    try {
      for (let i = 0; i < forms.length; i++) {
        openFormSettled(i);
        perForm.push({
          name: forms[i].name || ('Form ' + (i + 1)),
          gui: JSON.parse(window.exportGuiJson(false)),
          // exportGuiJson describes the questions; the page count and the
          // computed fields are properties of the form itself, so they are
          // taken from the flowchart the project is holding.
          flowchart: forms[i].flowchart || null,
          computedFields: computedBefore[i],
          overflowLinks: overflowBefore[i]
        });
      }
    } finally {
      if (view) view.rendering = wasRendering;
      // Put the operator back where they were before the export walked the
      // project. Reload even when the walk ended on that form, so it is drawn.
      window.switchToProjectForm(startIndex, true);
    }

    const merged = JSON.parse(JSON.stringify(perForm[0].gui));
    merged.sections = [];
    merged.hiddenFields = [];
    merged.additionalPDFs = [];
    merged.groups = [];
    // Rules that live beside the questions rather than in them. The merge kept
    // only the first form's, so a linked field or checklist item belonging to
    // form two or three was silently dropped from the packet.
    merged.linkedFields = [];
    merged.linkedCheckboxes = [];
    merged.inverseCheckboxes = [];
    merged.checklistItems = [];

    const ranges = [];
    // Activation rules are written against the flowchart's per-form question
    // numbers, so both the lookup and the shift have to be captured here,
    // before offsetForm renumbers everything in place.
    const questionsByForm = [];
    const questionOffsets = [];
    // Every name each form answers to, so a connector recorded against any of
    // them still resolves to the one name projectForms uses.
    const formIdentity = [];
    let sectionOffset = 0;
    let questionOffset = 0;
    let groupIdCounter = 0;

    perForm.forEach(function (entry, index) {
      const beforeOffset = new Map();
      (entry.gui.sections || []).forEach(function (section) {
        (section.questions || []).forEach(function (q) {
          beforeOffset.set(String(q.questionId), q);
        });
      });
      questionsByForm[index] = beforeOffset;
      questionOffsets[index] = questionOffset;

      const gui = offsetForm(entry.gui, sectionOffset, questionOffset);
      const count = (gui.sections || []).length;

      formIdentity.push({
        canonical: entry.name,
        names: [
          entry.name,
          entry.gui && entry.gui.formName,
          gui.defaultPDFName,
          gui.pdfOutputName
        ].filter(Boolean)
      });

      ranges.push({
        name: entry.name,
        index: index,
        firstSection: sectionOffset + 1,
        lastSection: sectionOffset + count,
        // The first form is the one the interview always starts in.
        alwaysIncluded: index === 0,
        // Each form fills its own PDF. The merged config keeps only the first
        // form's pdfOutputName, so without carrying the name per form the
        // packet finished by producing one PDF and silently dropping the rest.
        pdfFile: gui.pdfOutputName || gui.defaultPDFName || '',
        pdfName: gui.defaultPDFName || entry.name,
        // What this form adds to the pile a filer hands in.
        pdfPages: (entry.flowchart && entry.flowchart.defaultPdfProperties
          && entry.flowchart.defaultPdfProperties.pdfPages) || 0,
        // Which form this one is attached to. This list is the one place the
        // export names its keys one by one, so anything a form knows about
        // itself and the runtime needs has to be named here or it stops here.
        attachedTo: (entry.flowchart && entry.flowchart.defaultPdfProperties
          && entry.flowchart.defaultPdfProperties.attachedTo) || ''
      });

      merged.sections = merged.sections.concat(gui.sections || []);
      merged.hiddenFields = merged.hiddenFields.concat(gui.hiddenFields || []);
      merged.additionalPDFs = merged.additionalPDFs.concat(gui.additionalPDFs || []);
      // Two forms can state the same rule - a value they both print, split the
      // same way - so the same target appears once, from whichever form
      // declared it first.
      const seenLink = new Set(merged.linkedFields.map(function (f) { return f.linkedFieldId; }));
      (gui.linkedFields || []).forEach(function (f) {
        if (!f || seenLink.has(f.linkedFieldId)) return;
        seenLink.add(f.linkedFieldId);
        merged.linkedFields.push(f);
      });
      const seenBox = new Set(merged.linkedCheckboxes.map(function (c) { return c.linkedCheckboxId; }));
      (gui.linkedCheckboxes || []).forEach(function (c) {
        if (!c || seenBox.has(c.linkedCheckboxId)) return;
        seenBox.add(c.linkedCheckboxId);
        merged.linkedCheckboxes.push(c);
      });
      const seenInverse = new Set(merged.inverseCheckboxes.map(function (c) { return c.inverseCheckboxId; }));
      (gui.inverseCheckboxes || []).forEach(function (c) {
        if (!c || seenInverse.has(c.inverseCheckboxId)) return;
        seenInverse.add(c.inverseCheckboxId);
        merged.inverseCheckboxes.push(c);
      });
      (gui.checklistItems || []).forEach(function (item) {
        if (merged.checklistItems.indexOf(item) === -1) merged.checklistItems.push(item);
      });
      // Group ids restart at 1 in every form, and the builder keys its group
      // blocks by that id - two forms whose groups are both id 1 collapse into
      // one block, so the packet's progress bar lost a step per form. Renumber
      // in merge order, which also puts the steps in form order.
      groupsForForm(gui).forEach(function (group) {
        groupIdCounter += 1;
        merged.groups.push({
          groupId: groupIdCounter,
          name: group.name || ('Group ' + groupIdCounter),
          sections: group.sections
        });
      });

      sectionOffset += count;
      // ids were shifted in place, so the highest one here is already in merged
      // numbering and is where the next form has to start from.
      questionOffset = Math.max(questionOffset, maxQuestionId(gui));
    });

    merged.sectionCounter = sectionOffset + 1;
    merged.questionCounter = questionOffset + 1;
    merged.formName = (document.getElementById('projectNameInput') || {}).value
      || merged.formName || 'Project';
    merged.fieldCapacity = window.fieldCapacity || {};
    merged.projectId = (typeof window.currentProjectId === 'function')
      ? window.currentProjectId(true) : (window.projectId || '');
    merged.projectForms = ranges;
    // Fields the form asks for that no question can answer, gathered from
    // every form in the packet.
    merged.overflowLinks = perForm.reduce(function (all, entry) {
      return all.concat((entry.overflowLinks) || []);
    }, []);
    merged.computedFields = perForm.reduce(function (all, entry) {
      const own = entry.computedFields || [];
      return all.concat(own);
    }, []);
    merged.formActivations = buildActivations(questionsByForm, questionOffsets, formIdentity);

    // Must run after every form is merged, so a value shared by forms one and
    // three is still recognised as the same question.
    const collapsed = collapseSharedQuestions(merged);
    if (collapsed) {
      console.log('[project-gui] Collapsed ' + collapsed + ' repeated shared question(s)');
    }

    const emptied = dropEmptySections(merged);
    if (emptied.length) {
      console.log('[project-gui] Dropped ' + emptied.length + ' section(s) left with no questions: '
        + emptied.join(', '));
    }

    reportGroupProblems(merged);

    return merged;
  }

  async function exportProjectGuiJson(download) {
    const merged = await buildProjectGuiJson();
    const text = JSON.stringify(merged, null, 2);
    if (download !== false) {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project-gui.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return text;
  }

  /**
   * The merged packet JSON, offered as text before anything is saved.
   *
   * The export walks every form, so the dialog takes the promise and fills
   * itself in when it resolves.
   */
  function showExportProjectGuiJsonDialog() {
    window.showExportDialog({
      title: 'Export GUI JSON',
      description: 'Every form in the project merged into one interview. '
        + 'Copy it, or download it as a file.',
      filename: 'project-gui.json',
      text: function () { return exportProjectGuiJson(false); }
    });
  }

  window.buildProjectGuiJson = buildProjectGuiJson;
  window.exportProjectGuiJson = exportProjectGuiJson;
  window.showExportProjectGuiJsonDialog = showExportProjectGuiJsonDialog;
})();
