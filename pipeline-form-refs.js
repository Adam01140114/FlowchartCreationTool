#!/usr/bin/env node
/**
 * Every form the paperwork mentions is accounted for.
 *
 * Court forms send the filer on to other forms: "If no, complete form
 * DV-105(A)", "you must also complete form FL-150", "See form SER-001". A form
 * the packet leaves out is one the filer has to find, fill in and attach by
 * themselves - the one job this tool exists to take off them. DV-105 item 4a
 * said "complete form DV-105(A)" and the packet had no DV-105(A); the interview
 * answered with a subtitle telling the filer to get it from the court clerk.
 * Every check passed, because every check read the forms the packet had.
 *
 * So this reads every PDF in the packet - and the court's own guides to the
 * process, listed in the spec's "referenceSources" - in reading order, finds
 * every form number mentioned anywhere, and holds each one to exactly one of:
 *
 *   - in the packet: a "forms" entry in the spec
 *   - "formsStillToBuild": the filer's, not built yet. Printed on every run,
 *     so a known gap is never a quiet one
 *   - "formsNotInPacket": not the filer's to prepare, and the entry says
 *     whose it is ("DV-120 is the other person's response")
 *   - an information sheet (a number ending in -INFO): read, never filed
 *
 * A form mentioned and declared nowhere fails --check - including one the
 * paper only lists or points at, because a form nobody decided about is how
 * DV-105(A) happened. "Use another form DV-105(A)" - the paper asking for a
 * second copy of itself - is held to the same, as "DV-105(A) (another copy)".
 *
 * Usage: node pipeline-form-refs.js [--check] [--spec dv-packet.spec.json]
 *   (default) every form mentioned, and what covers it
 *   --check   exit non-zero when a form is mentioned that nothing covers
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const SPEC = args.includes('--spec') ? args[args.indexOf('--spec') + 1] : 'dv-packet.spec.json';

// A Judicial Council form number: DV-105, DV-105(A), CLETS-001, FL-341(C),
// DV-800/JV-270's halves, DV-505-INFO.
const FORM_NUMBER = /\b[A-Z]{2,5}-\d{3}(?:\s?\([A-Z]\))?(?:-[A-Z]{2,5})?(?![\w-])/g;
// Words that give someone a form to prepare. A mention without them is still
// held to a declaration; these only mark which mentions are instructions.
const INSTRUCTION = /\b(complete|completing|fill (?:it |this |them |one )?(?:out|in)|attach|file and serve|turn in|use (?:another )?form|must (?:also )?(?:use|file|complete|fill))\b/i;

const norm = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

/** A page's text in reading order: pdf.js returns runs in content order, and
 *  the Judicial Council PDFs draw a linked form number after the sentence it
 *  sits in - "complete form , Income and Expense Declaration" ... "FL-150". */
async function pagesOf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(file)),
    isEvalSupported: false,
    standardFontDataUrl: path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep,
    verbosity: 0,
  }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const runs = content.items.filter((i) => i.str && i.str.trim())
      .map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5] }));
    runs.sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));
    const lines = [];
    runs.forEach((r) => {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - r.y) <= 3) last.runs.push(r);
      else lines.push({ y: r.y, runs: [r] });
    });
    pages.push(lines.map((l) => l.runs.sort((a, b) => a.x - b.x).map((r) => r.s).join(' '))
      .join(' ').replace(/\s+/g, ' '));
  }
  return pages;
}

/** The documents read: the packet's forms, then the court's guides to the process. */
function sourcesOf(spec) {
  return (spec.forms || []).map((f) => ({ name: f.name, pdf: f.pdf }))
    .concat((spec.referenceSources || []).filter((r) => r && r.pdf)
      .map((r) => ({ name: r.name || r.pdf, pdf: r.pdf, guide: true })));
}

/** Every mention of a form number, with where it was and whether it instructs. */
async function mentions(spec) {
  const found = [];
  for (const src of sourcesOf(spec)) {
    const file = [path.join('FormWiz GUI', src.pdf), src.pdf, path.join('reference-forms', src.pdf)]
      .find((p) => p && fs.existsSync(p));
    if (!file) {
      found.push({ from: src.name, missingPdf: src.pdf });
      continue;
    }
    const self = norm(src.name);
    const pages = await pagesOf(file);
    pages.forEach((text, i) => {
      text.split(/(?<=[.!?])\s+/).forEach((sentence) => {
        const numbers = [...new Set((sentence.match(FORM_NUMBER) || []).map(norm))];
        numbers.forEach((number) => {
          let wanted = number;
          if (number === self) {
            // A form names itself in its footer and its caption; only
            // "use another form <itself>" asks for more of it.
            const another = new RegExp('another\\s+(?:copy of\\s+)?(?:form\\s+)?'
              + number.replace(/[()]/g, '\\$&'));
            if (!another.test(sentence.replace(/\s+(?=\()/g, ''))) return;
            wanted = number + ' (another copy)';
          }
          found.push({ from: src.name, page: i + 1, form: wanted, guide: !!src.guide,
            instructs: INSTRUCTION.test(sentence), sentence: sentence.trim() });
        });
      });
    });
  }
  return found;
}

/** What covers a mentioned form, or null. */
function coverOf(spec, wanted) {
  const declared = (table) => Object.keys(table || {})
    .find((k) => !k.startsWith('_') && norm(k) === norm(wanted));
  if (/ \(another copy\)$/.test(wanted)) {
    const base = wanted.replace(/ \(another copy\)$/, '');
    const blankOf = (f) => norm(f.blank || f.pdf);
    const original = (spec.forms || []).find((f) => norm(f.name) === norm(base));
    if (original && (spec.forms || []).filter((f) => blankOf(f) === blankOf(original)).length > 1) {
      return { how: 'in the packet', why: 'a second copy is in the packet' };
    }
  } else if ((spec.forms || []).some((f) => norm(f.name) === norm(wanted))) {
    return { how: 'in the packet' };
  }
  // MC-025 is drawn, not interviewed: every "need more space" continues on it,
  // and the forms the paper names for the same job (DV-101, MC-020) are
  // covered by it (rule the-packet-uses-mc025-for-more-space).
  const cont = spec.continuation || {};
  if (cont.form && norm(cont.form) === norm(wanted)) {
    return { how: 'in the packet', why: 'the page every continuation is drawn on' };
  }
  const replaced = declared(cont.replaces);
  if (replaced) return { how: 'in the packet', why: 'as ' + cont.form + ': ' + cont.replaces[replaced] };
  const pending = declared(spec.formsStillToBuild);
  if (pending) return { how: 'still to build', why: spec.formsStillToBuild[pending] };
  const notMine = declared(spec.formsNotInPacket);
  if (notMine) return { how: 'not the filer\'s', why: spec.formsNotInPacket[notMine] };
  // Outside the forms the packet covers ("scope"): a later stage, or a request
  // the packet does not make. Listed, never built, never sent for.
  const outOfScope = declared(spec.formsOutOfScope);
  if (outOfScope) return { how: 'out of scope', why: spec.formsOutOfScope[outOfScope] };
  // A guide without the -INFO suffix (DV-570, "Which Financial Form - For
  // Child Support?") is read, not filed, and says so in "formsToRead".
  const toRead = declared(spec.formsToRead);
  if (toRead) return { how: 'information sheet', why: spec.formsToRead[toRead] };
  if (/-INFO$/.test(wanted)) return { how: 'information sheet', why: 'read, never filed' };
  return null;
}

async function main() {
  const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  const found = await mentions(spec);
  const missingPdfs = found.filter((f) => f.missingPdf);
  const byForm = new Map();
  found.filter((f) => !f.missingPdf).forEach((f) => {
    if (!byForm.has(f.form)) byForm.set(f.form, []);
    byForm.get(f.form).push(f);
  });

  const groups = { 'in the packet': [], 'still to build': [], 'not the filer\'s': [], 'out of scope': [], 'information sheet': [], 'NOT ACCOUNTED FOR': [] };
  [...byForm.keys()].sort().forEach((form) => {
    const cover = coverOf(spec, form);
    groups[cover ? cover.how : 'NOT ACCOUNTED FOR'].push({ form, cover, where: byForm.get(form) });
  });

  console.log('Every form the packet\'s paperwork mentions (' + byForm.size + ' forms, from '
    + sourcesOf(spec).length + ' documents):');
  Object.keys(groups).forEach((g) => {
    if (!groups[g].length) return;
    console.log('\n  ' + g.toUpperCase() + ' (' + groups[g].length + ')');
    groups[g].forEach(({ form, cover, where }) => {
      const told = where.some((w) => w.instructs);
      const first = where.find((w) => w.instructs) || where[0];
      const mark = g === 'NOT ACCOUNTED FOR' ? 'FAIL ' : (g === 'still to build' ? 'TODO ' : 'ok   ');
      console.log('  ' + mark + form.padEnd(26) + (told ? 'told to complete/attach' : 'mentioned')
        + (cover && cover.why && g !== 'information sheet' ? ' - ' + cover.why : ''));
      if (g !== 'in the packet' && g !== 'information sheet') {
        console.log('         ' + first.from + ' page ' + first.page + ': "' + first.sentence.slice(0, 200)
          + (first.sentence.length > 200 ? '...' : '') + '"' + (where.length > 1 ? '  (+' + (where.length - 1) + ' more)' : ''));
      }
    });
  });
  missingPdfs.forEach((m) => console.log('  FAIL ' + m.from + ': ' + m.missingPdf + ' not found, so it was not read'));

  console.log('');
  const todo = groups['still to build'].map((g) => g.form);
  if (todo.length) {
    console.log('STILL TO BUILD: ' + todo.join(', ') + ' - the filer\'s, and the packet does not make '
      + (todo.length === 1 ? 'it' : 'them') + ' yet (formsStillToBuild in ' + SPEC + ').');
  }
  const bad = groups['NOT ACCOUNTED FOR'].map((g) => g.form).concat(missingPdfs.map((m) => m.missingPdf));
  if (bad.length) {
    console.log('FAILS  ' + bad.length + ' form(s) the paperwork mentions that nobody has decided about: ' + bad.join(', '));
    console.log('       Each is the filer\'s - add it to the packet (Hand Off/NEW-FORM.md), or list it in');
    console.log('       "formsStillToBuild" until it is - or someone else\'s, in "formsNotInPacket", saying whose -');
    console.log('       or outside the packet\'s scope, in "formsOutOfScope", saying why.');
    if (CHECK) process.exitCode = 1;
  } else {
    console.log('passes  every form the paperwork mentions is in the packet, still to build, someone else\'s, or out of scope');
  }

  // The packet makes exactly the forms in its scope - the user's list of
  // first-filing forms. A form in "forms" outside it, or a scope form nothing
  // makes, fails. A second copy ("DV-105(A) (2)") is its form; MC-025 is made
  // as the continuation form.
  const scope = spec.scope && Array.isArray(spec.scope.forms) ? spec.scope.forms : null;
  if (scope) {
    const base = (n) => norm(String(n).replace(/ \(\d+\)$/, ''));
    const wanted = scope.map(norm);
    const made = new Set((spec.forms || []).map((f) => base(f.name))
      .concat(spec.continuation && spec.continuation.form ? [norm(spec.continuation.form)] : []));
    const outside = (spec.forms || []).filter((f) => !wanted.includes(base(f.name))).map((f) => f.name);
    const missing = scope.filter((n) => !made.has(norm(n)));
    if (outside.length) console.log('FAILS  in the packet but outside its scope ("scope" in ' + SPEC + '): ' + outside.join(', '));
    if (missing.length) console.log('FAILS  in the packet\'s scope but made by nothing: ' + missing.join(', '));
    if (outside.length || missing.length) {
      if (CHECK) process.exitCode = 1;
    } else {
      console.log('passes  the packet makes exactly the ' + scope.length + ' forms in its scope');
    }
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exitCode = 1; });
}

module.exports = { mentions, coverOf, pagesOf, sourcesOf };
