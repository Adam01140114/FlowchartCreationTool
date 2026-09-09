#!/usr/bin/env node
/**
 * form_disqualifiers — the combinations of answers that disqualify a filer.
 *
 * A court form does not only ask questions; it also says when the answers rule
 * the filer out. DV-100 item 3g is the shape of it:
 *
 *   "If no, you do not qualify for this kind of restraining order unless you
 *    checked one of the other relationships listed above."
 *
 * That sentence is a rule about *several* answers at once, and nothing in the
 * field list records it. Left undeclared, it is invisible to every other step:
 * the compiler cannot infer it, the audit cannot check it, and the filer only
 * discovers it at the courthouse. So it gets its own artifact, next to
 * form_connections, and the flowchart author reads it to know where the alert
 * nodes go.
 *
 * Three modes:
 *
 *   --scan     read the packet's PDFs and print sentences that sound like a
 *              disqualifier, with the form and page. This is a lead, not an
 *              answer: a person still has to decide which fields it is about.
 *
 *   --check    verify every declared disqualifier is actually implemented, by
 *              looking for an alert rule in the exported packet GUI JSON whose
 *              conditions match. This is the half that keeps the artifact
 *              honest - a rule written down and never wired up is worse than
 *              one nobody wrote down, because it looks handled.
 *
 *   (default)  print the declared disqualifiers in the order a person meets
 *              them, so they can be read.
 *
 * Usage:
 *   node pipeline-disqualifiers.js --scan
 *   node pipeline-disqualifiers.js --check [dv-packet-gui.json]
 *   node pipeline-disqualifiers.js
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const SCAN = args.includes('--scan');
const CHECK = args.includes('--check');
const FILE = args.find((a) => !a.startsWith('--') && a.endsWith('disqualifiers.json'))
  || 'dv-packet-disqualifiers.json';
const GUI = args.find((a) => !a.startsWith('--') && a !== FILE) || 'dv-packet-gui.json';

/* ------------------------------------------------------------------ */
/* --scan: what the paper form says                                    */
/* ------------------------------------------------------------------ */

// Sentences that make an answer conditional on other answers. Deliberately
// loose: a false lead costs a moment to read, and a missed one reaches a filer.
const TELLS = [
  /(?:you\s+)?do not qualify[^.]*\./gi,
  /you may not[^.]*\./gi,
  /unless you[^.]*\./gi,
  /only if you[^.]*\./gi,
  /you must (?:be|have)[^.]*\./gi,
];

async function scan(spec) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const standardFontDataUrl =
    path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep;

  for (const form of spec.forms) {
    const file = [path.join('FormWiz GUI', form.pdf), form.pdf].find((p) => fs.existsSync(p));
    if (!file) {
      console.log(`${form.name}: ${form.pdf} not found, skipped`);
      continue;
    }
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(fs.readFileSync(file)),
      isEvalSupported: false,
      standardFontDataUrl,
    }).promise;

    const found = new Map();
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await doc.getPage(n).then((p) => p.getTextContent());
      const text = content.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ');
      TELLS.forEach((re) => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text))) {
          const sentence = m[0].trim();
          if (sentence.length < 20) continue;
          if (!found.has(sentence)) found.set(sentence, n);
        }
      });
    }

    console.log(`\n=== ${form.name} (${doc.numPages} pages) — ${found.size} lead(s)`);
    if (!found.size) console.log('   nothing that reads as a disqualifier');
    [...found.entries()].forEach(([sentence, page]) => {
      console.log(`   p${page}: ${sentence}`);
    });
  }
  console.log('\nEach lead is a sentence, not a rule. Decide which fields it is about,');
  console.log(`then write it into ${FILE} and wire an alert node for it.`);
}

/* ------------------------------------------------------------------ */
/* conditions                                                          */
/* ------------------------------------------------------------------ */

/**
 * Expand the shorthand a person writes into the conditions a rule holds.
 *
 * `noneOf` is the common case and the one worth having sugar for: "you checked
 * none of these" is six conditions, and writing six of them by hand is how a
 * seventh option gets forgotten when the form is revised.
 */
function expand(when) {
  const out = [];
  (when || []).forEach((clause) => {
    if (Array.isArray(clause.noneOf)) {
      clause.noneOf.forEach((value) => {
        out.push({ question: clause.question, op: 'isNot', value });
      });
      return;
    }
    if (Array.isArray(clause.anyOf)) {
      clause.anyOf.forEach((value) => {
        out.push({ question: clause.question, op: 'is', value, _anyOf: true });
      });
      return;
    }
    out.push({ question: clause.question, op: clause.op || 'is', value: clause.value });
  });
  return out;
}

function describe(condition) {
  if (condition.op === 'answered') return `${condition.question} is answered`;
  if (condition.op === 'notAnswered') return `${condition.question} is left blank`;
  if (condition.op === 'isNot') return `${condition.question} is not "${condition.value}"`;
  return `${condition.question} is "${condition.value}"`;
}

/* ------------------------------------------------------------------ */
/* --check: is it actually wired up?                                   */
/* ------------------------------------------------------------------ */

/**
 * Does this question answer to the name the disqualifiers file uses?
 *
 * A question with a nameId answers to it. A checkbox question has none of its
 * own: the flowchart's node id survives only as the prefix on each option's
 * nameId, so it answers to any name every one of its options is prefixed with.
 *
 * Asked this way round on purpose. Deriving the name from the options instead -
 * by taking their common prefix - looks equivalent and is not: every option of
 * the DV-100 relationship question begins "We", so the common prefix runs on to
 * `relationship_to_person_to_restrain_we` and matches nothing.
 */
function questionAnswersTo(question, name) {
  if (!name) return false;
  if (question.nameId === name) return true;
  const optionIds = (question.options || []).map((o) => o && o.nameId).filter(Boolean);
  if (!optionIds.length) return false;
  return optionIds.every((id) => id.startsWith(name + '_'));
}

function check(spec) {
  if (!fs.existsSync(GUI)) {
    console.error(`${GUI} not found. Export the packet GUI JSON first.`);
    process.exit(1);
  }
  const gui = JSON.parse(fs.readFileSync(GUI, 'utf8'));
  const rules = gui.alertRules || [];

  const questionById = new Map();
  (gui.sections || []).forEach((section) => {
    (section.questions || []).forEach((q) => {
      questionById.set(String(q.questionId), q);
    });
  });

  const matches = (rule, wanted) =>
    wanted.every((want) =>
      (rule.conditions || []).some((have) => {
        const question = questionById.get(String(have.questionId));
        if (!question || !questionAnswersTo(question, want.question)) return false;
        if (have.op !== want.op) return false;
        if (want.op === 'answered' || want.op === 'notAnswered') return true;
        return String(have.value || '').trim().toLowerCase()
          === String(want.value || '').trim().toLowerCase();
      })
    );

  let missing = 0;
  console.log(`${rules.length} alert rule(s) in ${GUI}\n`);
  (spec.disqualifiers || []).forEach((d) => {
    const wanted = expand(d.when);
    const hit = rules.find((r) => matches(r, wanted));
    if (hit) {
      const extra = (hit.conditions || []).length - wanted.length;
      console.log(`  OK   ${d.id} -> ${hit.id}`
        + (extra > 0 ? `  (rule carries ${extra} further condition(s))` : ''));
    } else {
      missing++;
      console.log(`  MISS ${d.id} (${d.form} item ${d.item}) has no alert rule`);
      wanted.forEach((w) => console.log(`         needs: ${describe(w)}`));
    }
  });

  if (missing) {
    console.log(`\n${missing} declared disqualifier(s) are not wired up. Each needs an`);
    console.log('alert node in the flowchart with one arrow per condition — see');
    console.log('"Hand Off/NEW-FORM.md", "Disqualifying factors".');
    process.exit(1);
  }
  console.log('\nEvery declared disqualifier has an alert rule behind it.');
}

/* ------------------------------------------------------------------ */

function list(spec) {
  (spec.disqualifiers || []).forEach((d) => {
    console.log(`\n${d.id}  (${d.form} item ${d.item}, fires when ${d.mode || 'all'} hold)`);
    console.log(`  "${d.message}"`);
    expand(d.when).forEach((c) => console.log(`    - ${describe(c)}`));
    if (d.source) console.log(`  form says: ${d.source}`);
  });
  console.log(`\n${(spec.disqualifiers || []).length} declared. Run --check to see which are wired up.`);
}

if (!fs.existsSync(FILE)) {
  console.error(`${FILE} not found. Run --scan against the packet spec to find candidates.`);
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(FILE, 'utf8'));

if (SCAN) scan(spec).catch((e) => { console.error(e); process.exit(1); });
else if (CHECK) check(spec);
else list(spec);
