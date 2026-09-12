/**
 * The wording rules, written once and read by everything that enforces them.
 *
 * compile-form.js refuses to write a flowchart that breaks the cornerstone, and
 * pipeline-audit.js fails the run on any of them. They share this file so the
 * two can never disagree - and so a pattern that stops matching is found by its
 * own self-test below rather than by a filer. The audit's copy of the condition
 * pattern once held literal backspace characters where \b belonged; it matched
 * nothing, reported "passes" for as long as it existed, and DV-105 shipped
 * "If there is another parent or legal guardian besides you and the other
 * person, what is their name?".
 *
 * The rules themselves are on form-rules.html:
 *   #rule-a-question-never-carries-its-condition   (the cornerstone)
 *   #rule-every-title-is-a-full-sentence
 *   #rule-optional-is-coded-not-said
 *   #rule-one-question-one-thing
 *   #rule-ask-in-the-right-type
 */
'use strict';

// A question, a box label or a choice that carries its own condition. The
// condition belongs in a Yes/No gate that comes first; the question is shown
// only on Yes. A part the filer may not know is optional, and the form says so.
const CONDITION_TELLS = [
  /^\s*if\b/i,                         // "If there is another parent ..., what is their name?"
  /,\s*if\b/i,                         // "Where is it, if you know?"  "End, if it applies"
  /\(\s*if\b/i,                        // "(if any)"  "(include it if you know it)"
  /\bif (you|they|there|it|any|known|applicable|applies|needed|so|someone|one|possible)\b/i,
  /\bunless\b/i
];

// A continuation line is overflow from one answer, not a second fact, and is
// the one shape allowed to say "if".
const CONTINUATION = /\b(continue|continued|did not fit|more space|additional space)\b/i;

/** The phrase that carries a condition, or null. */
function conditionTell(text) {
  const t = String(text == null ? '' : text);
  if (!t.trim() || CONTINUATION.test(t)) return null;
  for (const re of CONDITION_TELLS) {
    const m = re.exec(t);
    if (m) return m[0].trim();
  }
  return null;
}

// What the form appends after a title is not part of the sentence. "(optional)"
// is not one of them: a title never says it (saysOptional, below).
const FORM_SUFFIX = /\s*\((check all that apply|select all that apply)\)\s*$/i;

// A question the filer may skip is marked optional - "optional": true in the
// hints, exported as required: false - and the Next button lets them past it.
// Its title never says so: "How can the court reach you? (optional)" was a
// title making a promise the form did not keep, because nothing marked it.
const SAYS_OPTIONAL = /\(\s*optional\s*\)|\boptional\b/i;
function saysOptional(text) {
  const m = SAYS_OPTIONAL.exec(String(text == null ? '' : text));
  return m ? m[0] : null;
}

/**
 * Why a question title is not a full sentence, or null when it is one.
 * A title reads on its own: the one-question-at-a-time mode shows nothing else.
 */
function sentenceProblem(text) {
  let t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  while (FORM_SUFFIX.test(t)) t = t.replace(FORM_SUFFIX, '').trim();
  if (!t) return null;
  if (/:\s*$/.test(t)) return 'ends in a colon';
  if (/^(and|or|but|also|then|plus)\b/i.test(t)) return 'leans on the question before it';
  if (/^[A-Z][^:?.!]{0,40}:\s/.test(t)) return 'opens with a label and a colon';
  if (!/^["“(]?[A-Z0-9]/.test(t)) return 'does not start with a capital letter';
  if (!/[?.!]["”)]?$/.test(t)) return 'does not end like a sentence';
  const first = t.split(/(?<=[?.!])\s+/)[0];
  if (first.split(' ').length < 4) return 'is a fragment - name what is asked about';
  return null;
}

// One box that asks for two things: "City and state", "Driver's license number
// and state", "Employer (name and address)".
const TWO_THINGS = /\b(name|number|city|street|date|time|phone|address|county)\b[^,;]*\b(and|&)\b[^,;]*\b(address|state|zip|time|date|number|name|city|country|county)\b/i;
function twoThingsInOneBox(label) {
  return TWO_THINGS.test(String(label == null ? '' : label));
}

// A box whose words say it holds a date, whatever its field is called:
// "Lived there from (month/year)", "Living there since", "Until".
const DATE_WORDS = /\b(date|dated|since)\b|\(\s*month\s*\/\s*(day\s*\/\s*)?year\s*\)|\bmm\s*\/\s*(dd\s*\/\s*)?yy|^\s*(from|until|start date|end date)\s*$/i;
function asksForDate(label) {
  const t = String(label == null ? '' : label);
  if (/\bdate of birth\b/i.test(t)) return true;
  return DATE_WORDS.test(t);
}

module.exports = { conditionTell, sentenceProblem, saysOptional, twoThingsInOneBox, asksForDate, CONDITION_TELLS };

// A checker that cannot fail is not a checker. Run: node wording-rules.js
if (require.main === module) {
  const expect = (label, got, want) => {
    const ok = Boolean(got) === want;
    console.log((ok ? 'ok    ' : 'FAIL  ') + label + (got && typeof got === 'string' ? '  -> ' + got : ''));
    if (!ok) process.exitCode = 1;
  };
  expect('cornerstone: "If there is another parent ..."', conditionTell('If there is another parent or legal guardian besides you and the other person, what is their name?'), true);
  expect('cornerstone: "Where is it, if you know?"', conditionTell('Where is it, if you know?'), true);
  expect('cornerstone: "End, if it applies"', conditionTell('End, if it applies'), true);
  expect('cornerstone: "If someone else, their relationship"', conditionTell('If someone else, their relationship to the child'), true);
  expect('cornerstone: "(include the serial number if you know it)"', conditionTell('Describe it (include the serial number if you know it)'), true);
  expect('cornerstone passes: "Is there another parent or legal guardian ...?"', conditionTell('Is there another parent or legal guardian besides you and the other person?'), false);
  expect('cornerstone passes: a continuation line', conditionTell('Continue here if the answer did not fit'), false);
  expect('sentence: "And before that?"', sentenceProblem('And before that?'), true);
  expect('sentence: "Which county?"', sentenceProblem('Which county?'), true);
  expect('sentence: "Your lawyer\'s information"', sentenceProblem("Your lawyer's information"), true);
  expect('sentence: "Monday: what should the visit look like?"', sentenceProblem('Monday: what should the visit look like?'), true);
  expect('sentence: "... take the children outside:"', sentenceProblem('They must have written permission or a court order to take the children outside:'), true);
  expect('sentence passes: "What is their name?"', sentenceProblem('What is their name?'), false);
  expect('sentence passes: "... (check all that apply)"', sentenceProblem('Which orders do you want? (check all that apply)'), false);
  expect('optional said: "How can the court reach you? (optional)"', saysOptional('How can the court reach you? (optional)'), true);
  expect('optional not said: "How can the court reach you?"', saysOptional('How can the court reach you?'), false);
  expect('two things: "City and state"', twoThingsInOneBox('City and state'), true);
  expect('two things: "Driver\'s license number and state"', twoThingsInOneBox("Driver's license number and state"), true);
  expect('two things: "Employer (name and address)"', twoThingsInOneBox('Employer (name and address)'), true);
  expect('two things passes: "State bar number"', twoThingsInOneBox('State bar number'), false);
  expect('date: "Living there since (month/year)"', asksForDate('Living there since (month/year)'), true);
  expect('date: "Until"', asksForDate('Until'), true);
  expect('date passes: "State bar number"', asksForDate('State bar number'), false);
}
