/**
 * Which questions a filer meets, given the answers so far.
 *
 * Shared by the chat page (to find the next question) and the server (to
 * decide which answers count when the PDFs are filled), so the two can never
 * disagree about what was asked.
 *
 * The walk is recomputed from the answers every time instead of kept as a
 * queue: going back, or changing an earlier answer, is then just editing the
 * answers, and anything a changed answer closes simply stops being on the path.
 * Answers to questions that are no longer on the path are kept (so changing
 * your mind back restores them) but never reach a PDF.
 *
 * Interview shape (DocHelper/server/build.js toInterview): a question has an
 * `id`, a `type`, and for a choice `options: [{ label, value, follow: [...] }]`;
 * `follow` are the questions that answer opens. `fromOptions` sits on the spine
 * but is asked only after one of those options; `alsoWhen` is a follow-up that
 * another, earlier answer opens too.
 *
 * A form comes in when packet.json says so: `includeWhen` lists answers, any of
 * which brings it in. An answer is named as an option's value, as a question id
 * (that question answered Yes), or as "questionId=optionValue".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InterviewWalk = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function has(answers, id) {
    return Object.prototype.hasOwnProperty.call(answers, id);
  }

  /** The option values an answer picks. */
  function picked(question, answer) {
    if (answer == null || answer === '') return [];
    if (question.type === 'multi') return Array.isArray(answer) ? answer : [];
    if (question.type === 'choice') return [answer];
    if (question.type === 'boxes' && typeof answer === 'object') {
      return (question.boxes || []).filter((b) => b.type === 'choice').map((b) => answer[b.key]).filter(Boolean);
    }
    return [];
  }

  function isYes(question, value) {
    const opt = (question.options || []).find((o) => o.value === value);
    return /^yes$/i.test(String(value)) || (opt && /^yes$/i.test(String(opt.label)));
  }

  function remember(selected, question, answer) {
    picked(question, answer).forEach((value) => {
      selected.add(value);
      selected.add(question.id + '=' + value);
      if (isYes(question, value)) selected.add(question.id);
    });
  }

  function anySelected(selected, names) {
    return (names || []).some((n) => selected.has(n));
  }

  /** Is a packet form in, given what has been chosen so far? */
  function formActive(entry, selected) {
    const when = entry && entry.includeWhen;
    if (!when || (Array.isArray(when) && !when.length)) return true;
    return anySelected(selected, Array.isArray(when) ? when : [when]);
  }

  /**
   * Walk the packet.
   *   forms:   [{ form, title, includeWhen?, interview: { questions } }] in packet order
   *   answers: { questionId: answer }
   * Returns { path: [{ question, answered, shared }], current, activeForms, selected }.
   * `current` is the first unanswered question, or null when the interview is done.
   */
  function walk(forms, answers) {
    const selected = new Set();
    const seen = new Set();
    const path = [];
    const activeForms = [];
    let current = null;

    function visit(q) {
      if (current) return;
      if (q.fromOptions && !anySelected(selected, q.fromOptions)) return;
      const shared = seen.has(q.id);
      if (!shared) {
        seen.add(q.id);
        const answered = has(answers, q.id);
        path.push({ question: q, answered: answered, shared: false });
        if (!answered) { current = q; return; }
      }
      const answer = answers[q.id];
      remember(selected, q, answer);
      const chosen = new Set(picked(q, answer));
      (q.options || []).forEach((o) => {
        (o.follow || []).forEach((f) => {
          if (current) return;
          if (chosen.has(o.value) || anySelected(selected, f.alsoWhen)) visit(f);
        });
      });
    }

    for (const entry of forms) {
      if (current) break;
      if (!formActive(entry, selected)) continue;
      activeForms.push(entry.form);
      for (const q of entry.interview.questions) {
        visit(q);
        if (current) break;
      }
    }
    // Forms after the current question cannot be decided yet; report the ones
    // known to be in so far.
    return { path, current, activeForms, selected, done: !current };
  }

  return { walk, formActive, picked };
}));
