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

  const LOAD_SETTLE_MS = 1500;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
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
      const name = q.nameId;
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

/** Activation rules from the project's connectors, keyed by target form name. */
  function buildActivations() {
    if (typeof window.collectProjectConnectors !== 'function') return [];
    return window.collectProjectConnectors().map(function (c) {
      return {
        targetForm: c.targetForm,
        unconditional: !!c.unconditional,
        optionNameId: c.optionNodeId || null,
        optionLabel: c.optionLabel || null,
        fromForm: c.fromForm
      };
    });
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
    const perForm = [];

    for (let i = 0; i < forms.length; i++) {
      window.switchToProjectForm(i);
      await wait(LOAD_SETTLE_MS);
      perForm.push({
        name: forms[i].name || ('Form ' + (i + 1)),
        gui: JSON.parse(window.exportGuiJson(false))
      });
    }

    // Put the operator back where they were before the export walked the project.
    window.switchToProjectForm(startIndex);

    const merged = JSON.parse(JSON.stringify(perForm[0].gui));
    merged.sections = [];
    merged.hiddenFields = [];
    merged.additionalPDFs = [];
    merged.groups = [];

    const ranges = [];
    let sectionOffset = 0;
    let questionOffset = 0;

    perForm.forEach(function (entry, index) {
      const gui = offsetForm(entry.gui, sectionOffset, questionOffset);
      const count = (gui.sections || []).length;

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
        pdfName: gui.defaultPDFName || entry.name
      });

      merged.sections = merged.sections.concat(gui.sections || []);
      merged.hiddenFields = merged.hiddenFields.concat(gui.hiddenFields || []);
      merged.additionalPDFs = merged.additionalPDFs.concat(gui.additionalPDFs || []);
      merged.groups = merged.groups.concat(gui.groups || []);

      sectionOffset += count;
      // ids were shifted in place, so the highest one here is already in merged
      // numbering and is where the next form has to start from.
      questionOffset = Math.max(questionOffset, maxQuestionId(gui));
    });

    merged.sectionCounter = sectionOffset + 1;
    merged.questionCounter = questionOffset + 1;
    merged.formName = (document.getElementById('projectNameInput') || {}).value
      || merged.formName || 'Project';
    merged.projectForms = ranges;
    merged.formActivations = buildActivations();

    // Must run after every form is merged, so a value shared by forms one and
    // three is still recognised as the same question.
    const collapsed = collapseSharedQuestions(merged);
    if (collapsed) {
      console.log('[project-gui] Collapsed ' + collapsed + ' repeated shared question(s)');
    }

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

  window.buildProjectGuiJson = buildProjectGuiJson;
  window.exportProjectGuiJson = exportProjectGuiJson;
})();
