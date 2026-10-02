/**
 * Does an answer fit the box it goes in - and if not, what would?
 *
 * The judge is the filler itself: the dev server's POST /edit_pdf, which spills
 * a long answer onto the ruled lines under it, shrinks what is left down to 6pt
 * (MIN_FIT_FONT_SIZE), and names in X-Fill-Unfitted every box whose answer still
 * does not print. A separate estimate here would disagree with it at the edges,
 * and the edge is exactly where this matters.
 *
 * Only the boxes an answer reaches are sent, so a probe is quick. A one-line box
 * whose answer fits at the form's own size is passed without asking: spilling
 * and shrinking only ever add room.
 *
 * When an answer is too long, its limit is found by trying shorter versions of
 * the person's own words against the filler, and the version offered is either
 * Claude's rewrite (with an API key) or the person's own whole sentences that
 * fit. Nothing is offered that was not checked against the box.
 */
const fs = require('fs');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { payloadFor } = require('./fill');
const { walk } = require('../interview-walk');
const ruledLines = require('../../ruled-lines');

/* ------------------------------------------------------------------ */
/* the parts of an answer that are typed text                          */
/* ------------------------------------------------------------------ */

const TYPED = new Set(['text', 'textarea', 'phone', 'email', 'number', 'money']);

/** Every typed piece of an answer: [{ key, label, value }]. */
function slotsOf(q, answer) {
  if (TYPED.has(q.type) && typeof answer === 'string') return [{ key: '', label: '', value: answer }];
  if (q.type === 'boxes' && answer && typeof answer === 'object') {
    return (q.boxes || []).filter((b) => b.type !== 'choice' && b.type !== 'date' && answer[b.key])
      .map((b) => ({ key: b.key, label: b.label, value: String(answer[b.key]) }));
  }
  if (q.type === 'repeat' && answer && Array.isArray(answer.entries)) {
    const out = [];
    answer.entries.forEach((e, i) => (q.repeat.fields || []).forEach((f) => {
      if (f.type === 'choice' || f.type === 'date' || !e[f.key]) return;
      out.push({ key: i + ':' + f.key, label: `${q.repeat.entryTitle || 'Entry'} ${i + 1}, ${f.label}`, value: String(e[f.key]) });
    }));
    return out;
  }
  return [];
}

/** The answer with one typed piece replaced. */
function withSlot(q, answer, key, value) {
  if (key === '') return value;
  if (q.type === 'boxes') return Object.assign({}, answer, { [key]: value });
  if (q.type === 'repeat') {
    const [i, k] = [Number(key.split(':')[0]), key.slice(key.indexOf(':') + 1)];
    const entries = answer.entries.map((e, n) => (n === i ? Object.assign({}, e, { [k]: value }) : e));
    return Object.assign({}, answer, { entries });
  }
  return answer;
}

/* ------------------------------------------------------------------ */
/* asking the filler                                                    */
/* ------------------------------------------------------------------ */

/**
 * The smallest type DocHelper accepts. The filler will shrink an answer down to
 * 6pt to get it onto the paper; DocHelper asks the person to shorten anything
 * that would print below this, so what they file can be read.
 */
const READABLE_MIN = 8;

const fieldInfo = new Map(); // sanitized pdf path -> Map(name -> { kind, size, width, height, multiline, rules })
let helv = null;

async function infoFor(pdfPath) {
  if (fieldInfo.has(pdfPath)) return fieldInfo.get(pdfPath);
  const bytes = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  // The rules each box's page prints, for a box laid out on its ruled lines -
  // the same reading /edit_pdf does (ruled-lines.js).
  const pageOf = new Map();
  doc.getPages().forEach((page, index) => {
    const annots = page.node.Annots();
    if (annots) annots.asArray().forEach((ref) => { const d = doc.context.lookup(ref); if (d) pageOf.set(d, index); });
  });
  const pages = await ruledLines.harvest(bytes, 'dochelper-fit:' + pdfPath);
  const map = new Map();
  doc.getForm().getFields().forEach((f) => {
    const kind = f.constructor.name;
    const entry = { kind };
    if (kind === 'PDFTextField') {
      try {
        const m = String(f.acroField.getDefaultAppearance() || '').match(/([\d.]+)\s+Tf/);
        entry.size = m ? parseFloat(m[1]) : 0;
      } catch (e) { entry.size = 0; }
      try { entry.multiline = f.isMultiline(); } catch (e) { entry.multiline = false; }
      try { entry.combed = f.isCombed(); } catch (e) { entry.combed = false; }
      try { entry.maxLength = f.getMaxLength() || 0; } catch (e) { entry.maxLength = 0; }
      try {
        const w = f.acroField.getWidgets()[0];
        const r = w.getRectangle();
        entry.width = r.width; entry.height = r.height;
        const page = pages[pageOf.get(w.dict)];
        entry.rules = entry.multiline && page ? ruledLines.linesInBox(page, r).length : 0;
      } catch (e) { /* no widget */ }
    }
    map.set(f.getName(), entry);
  });
  fieldInfo.set(pdfPath, map);
  if (!helv) helv = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  return map;
}

/** One character's advance width at 1pt; a character Helvetica cannot draw counts as a W. */
const widths = new Map();
function charWidth(ch) {
  let w = widths.get(ch);
  if (w === undefined) {
    try { w = helv.widthOfTextAtSize(ch, 1); } catch (e) { w = helv.widthOfTextAtSize('W', 1); }
    widths.set(ch, w);
  }
  return w;
}

/** Plain advance widths, the way a viewer draws a Tj (see measureAsDrawn in dev-server.js). */
function drawnWidth(text, size) {
  let w = 0;
  for (const ch of String(text)) w += charWidth(ch) * size;
  return w;
}

/** A box that certainly prints this text, without asking the filler. */
function surelyFits(info, value) {
  if (!info || info.kind !== 'PDFTextField') return true;
  if (!info.size || info.combed) return true;           // auto-sized or combed: left to pdf-lib
  if (info.maxLength && value.length > info.maxLength) return false;
  if (isBlock(info, info.size)) return false;            // laid out over lines: measured below
  return drawnWidth(value, info.size) <= info.width - 4;
}

/** A multiline box tall enough to be drawn as lines, at this size (fitToBox in dev-server.js). */
function isBlock(info, size) {
  return !!info.multiline && info.height >= helv.heightAtSize(size) * 1.2 + 2;
}

/**
 * How many lines pdf-lib's layoutMultilineText breaks this text into - the
 * same breaks, worked out in one pass per line. pdf-lib measures the whole
 * rest of a paragraph and backs off a word at a time, which on a long
 * statement is minutes of measuring; here a running total of character widths
 * answers each "does this much fit" at once. Rules mirrored exactly: tabs and
 * odd separators become four spaces, paragraphs split on newlines, a line
 * breaks at the last whitespace before it stops fitting (strictly narrower
 * than the box), and a word too long for a line takes the whole rest.
 */
// pdf-lib's cleanText: a tab and three odd separators become four spaces, backspace and
// vertical tab are dropped. Built from char codes: a raw U+2028 in a regex literal ends the line.
const SEPARATORS = new RegExp('[' + String.fromCharCode(9, 0x85, 0x2028, 0x2029) + ']', 'g');
const CONTROLS = new RegExp('[' + String.fromCharCode(8, 11) + ']', 'g');
function linesNeeded(text, size, maxWidth) {
  const clean = String(text).replace(SEPARATORS, '    ').replace(CONTROLS, '');
  let count = 0;
  for (const paragraph of clean.split(/[\n\f\r\u000B]/)) {
    let rest = paragraph;
    // pdf-lib lays out an empty paragraph as one empty line.
    do {
      const sums = [0];
      for (let i = 0; i < rest.length; i++) sums.push(sums[i] + charWidth(rest[i]) * size);
      let cut = rest.length;
      if (!(sums[cut] < maxWidth)) {
        let ws = -1;
        for (let i = rest.length - 1; i >= 1; i--) {
          if (/\s/.test(rest[i]) && sums[i] < maxWidth) { ws = i; break; }
        }
        cut = ws > 0 ? ws : rest.length;
      }
      count += 1;
      // pdf-lib trims what is left, and lays out even an empty remainder as a line.
      rest = cut < rest.length ? rest.slice(cut).trim() : undefined;
    } while (rest !== undefined);
  }
  return count;
}

/**
 * The size a multiline box prints this text at, the way the filler's
 * fitToBox picks it (declared size, then down by half points), or null when it
 * would have to go below READABLE_MIN.
 */
function blockSize(info, text) {
  for (let s = info.size; s >= READABLE_MIN - 1e-9; s -= 0.5) {
    if (!isBlock(info, s)) return drawnWidth(text, s) <= info.width - 4 ? s : null;
    const lines = info.rules >= 2 ? info.rules : Math.floor((info.height - 2) / (helv.heightAtSize(s) * 1.2));
    if (linesNeeded(text, s, info.width - 4) <= Math.max(1, lines)) return s;
  }
  return null;
}

/**
 * Ask /edit_pdf to fill only these boxes, and return the ones that do not print.
 * The upload's name keys the filler's cache of the page's ruled lines, so it is
 * unique to the session and form.
 */
async function unfittedBoxes({ serverUrl, pdfPath, cacheName, values }) {
  const keys = Object.keys(values);
  if (!keys.length) return new Set();
  const body = new FormData();
  body.append('pdf', new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' }), cacheName);
  keys.forEach((k) => body.append(k, values[k]));
  const res = await fetch(serverUrl + '/edit_pdf', { method: 'POST', body });
  if (!res.ok) throw new Error('measuring failed: ' + res.status);
  await res.arrayBuffer();
  const out = new Set(decodeURIComponent(res.headers.get('x-fill-unfitted') || '').split(',').filter(Boolean));
  // "agency_zip_code 10->6pt": printed, but smaller than DocHelper accepts.
  decodeURIComponent(res.headers.get('x-fill-shrunk') || '').split(',').forEach((s) => {
    const m = /^(.*) [\d.]+->([\d.]+)pt$/.exec(s.trim());
    if (m && Number(m[2]) < READABLE_MIN) out.add(m[1]);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* the check                                                            */
/* ------------------------------------------------------------------ */

/**
 * The typed text an answer puts in each PDF box, per form, compared with the
 * same answers without it - so a box joined from several answers is measured
 * with all of them in it, and is only blamed on this one if this one is in it.
 */
function boxesReachedBy(forms, answers, q, answer) {
  const withIt = Object.assign({}, answers, { [q.id]: answer });
  const without = Object.assign({}, answers);
  delete without[q.id];
  const onPath = new Set(walk(forms, withIt).path.map((p) => p.question.id));
  onPath.add(q.id);
  const out = [];
  forms.forEach((f) => {
    const a = payloadFor(f.interview, withIt, onPath);
    const b = payloadFor(f.interview, without, onPath);
    const values = {};
    Object.keys(a).forEach((k) => {
      const v = a[k];
      if (v && v !== 'Yes' && v !== 'Off' && v !== b[k]) values[k] = String(v);
    });
    if (Object.keys(values).length) out.push({ form: f, values, context: a });
  });
  return out;
}

/**
 * Every text box an interview can fill. The filler spills a long answer onto an
 * empty ruled line beneath it, so a box the person simply has not reached yet
 * must not look free: at fill time it will hold their answer. Boxes no question
 * fills - the continuation lines a form rules for exactly this - stay free.
 */
const filledByInterview = new Map();
function boxesTheInterviewFills(form) {
  if (filledByInterview.has(form)) return filledByInterview.get(form);
  const names = new Set();
  const visit = (q) => {
    if (q.field) q.field.targets.forEach((t) => names.add(t));
    else if (!q.options && q.type !== 'boxes' && q.type !== 'repeat') names.add(q.id);
    (q.boxes || []).forEach((b) => names.add(b.key));
    if (q.repeat) {
      for (let n = 1; n <= (q.repeat.max || 1); n++) {
        (q.repeat.fields || []).forEach((f) => { if (f.nameId) names.add(q.id + '_' + String(f.nameId).split('{n}').join(String(n))); });
      }
      if (q.repeat.joinInto && q.repeat.joinInto.field) names.add(q.repeat.joinInto.field);
    }
    (q.options || []).forEach((o) => (o.follow || []).forEach(visit));
  };
  form.interview.questions.forEach(visit);
  (form.interview.joins || []).forEach((j) => names.add(j.target));
  filledByInterview.set(form, names);
  return names;
}

/** Characters of ordinary text a box could hold at the filler's smallest size, generously. */
const SAMPLE = 'Maria Elena Lopez 455 Pearl Street Salinas 93901 He came to the door and shouted at me. ';
function mostThatCouldFit(info) {
  if (!info || info.kind !== 'PDFTextField' || !info.size || info.combed || !info.width) return Infinity;
  const min = READABLE_MIN;
  const perChar = drawnWidth(SAMPLE, min) / SAMPLE.length;
  const perLine = Math.ceil((info.width - 4) / perChar);
  const lines = info.multiline ? Math.max(1, Math.floor((info.height - 2) / (min * 1.2))) : 1;
  // A single-line box may spill onto up to seven ruled lines below it (the
  // filler's chain limit is eight), so its bound allows all of them.
  return Math.ceil(perLine * lines * (info.multiline ? 1.15 : 8));
}

async function tooLongBoxes(ctx, q, answer) {
  const found = [];
  for (const { form, values, context } of boxesReachedBy(ctx.forms, ctx.answers, q, answer)) {
    const info = await infoFor(form.sanitizedPdf);
    const ask = {};
    Object.keys(values).forEach((k) => {
      const i = info.get(k);
      if (!i || surelyFits(i, values[k])) return;
      if (values[k].length > mostThatCouldFit(i)) { found.push({ form, box: k }); return; }
      // A box drawn as lines is measured here, exactly; only one-line boxes,
      // which may spill onto ruled lines beneath them, go to the filler.
      if (isBlock(i, i.size)) { if (blockSize(i, values[k]) === null) found.push({ form, box: k }); return; }
      ask[k] = values[k];
    });
    if (!Object.keys(ask).length) continue;
    // The answers given so far, a stand-in for every box still to be answered,
    // and the boxes being measured.
    const body = {};
    boxesTheInterviewFills(form).forEach((k) => { const i = info.get(k); if (i && i.kind === 'PDFTextField') body[k] = 'x'; });
    Object.keys(context).forEach((k) => { if (info.has(k) && context[k] !== 'Off') body[k] = String(context[k]); });
    Object.assign(body, ask);
    const bad = await unfittedBoxes({ serverUrl: ctx.serverUrl, pdfPath: form.sanitizedPdf,
      cacheName: `${ctx.sessionId}-${form.form}.pdf`, values: body });
    Object.keys(ask).forEach((k) => { if (bad.has(k)) found.push({ form, box: k }); });
  }
  return found;
}

/** Sentences, keeping their own punctuation and the space after. */
function sentences(text) {
  return String(text).match(/[^.!?\n]+(?:[.!?]+["')\]]*|\n+|$)\s*/g) || [String(text)];
}

/**
 * The longest start of `value` - in whole words - that keeps every box fitting,
 * by halving. Fits-ness only gets worse as text gets longer, so it is monotone.
 */
const boxId = (b) => b.form.form + '/' + b.box;

async function longestFittingPrefix(ctx, q, answer, slot, boxes) {
  const words = slot.value.split(/(\s+)/); // keep the spaces so the prefix is the person's text exactly
  const prefix = (n) => words.slice(0, n).join('').trimEnd();
  // Nothing longer than the most any reached box could hold at 6pt can fit,
  // so the search starts there rather than at the whole answer.
  let cap = 0;
  for (const { form, values } of boxesReachedBy(ctx.forms, ctx.answers, q, answer)) {
    const info = await infoFor(form.sanitizedPdf);
    Object.keys(values).forEach((k) => { cap = Math.max(cap, mostThatCouldFit(info.get(k))); });
  }
  let lo = 0; let hi = words.length;      // lo fits (empty fits), hi does not
  if (Number.isFinite(cap)) {
    let n = 0;
    while (n < words.length && prefix(n + 1).length <= cap) n++;
    hi = Math.min(words.length, n + 1);
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const bad = (await tooLongBoxes(ctx, q, withSlot(q, answer, slot.key, prefix(mid)))).filter((b) => boxes.has(boxId(b)));
    if (bad.length) hi = mid; else lo = mid;
  }
  return prefix(lo);
}

/** The person's own whole sentences that fit, or failing that, whole words. */
function trimToSentences(full, maxPrefix) {
  let kept = '';
  for (const s of sentences(full)) {
    if ((kept + s).trimEnd().length > maxPrefix.length) break;
    kept += s;
  }
  kept = kept.trim();
  if (kept) return { text: kept, how: 'sentences' };
  // Cut between words, it ends where the words do - not on a dangling comma.
  return { text: maxPrefix.replace(/[\s,;:(-]+$/, ''), how: 'words' };
}

/**
 * Check one answer. Returns { fits: true } or
 * { fits: false, issues: [{ slot, label, form, length, limit, words, suggestion, source }], suggested }
 * where `suggested` is the whole answer with every suggestion applied.
 */
async function checkAnswer(ctx, q, answer) {
  const bad = await tooLongBoxes(ctx, q, answer);
  if (!bad.length) return { fits: true };

  const issues = [];
  let suggested = answer;
  for (const slot of slotsOf(q, answer)) {
    // The boxes still overflowing, with the pieces before this one already
    // shortened - and the ones of them this piece is in: blank it and see
    // which go away. Comparing against the first count blamed a piece that
    // fitted all along once an earlier one had been shortened.
    const now = await tooLongBoxes(ctx, q, suggested);
    if (!now.length) break;
    const without = new Set((await tooLongBoxes(ctx, q, withSlot(q, suggested, slot.key, ''))).map(boxId));
    const mine = new Set(now.map(boxId).filter((b) => !without.has(b)));
    if (!mine.size) continue;
    const prefix = await longestFittingPrefix(ctx, q, suggested, slot, mine);
    const limit = prefix.length;
    let suggestion = null;
    let source = 'words';
    if (ctx.rewrite && limit >= 40) {
      try {
        for (const target of [Math.floor(limit * 0.9), Math.floor(limit * 0.75)]) {
          const text = String(await ctx.rewrite({ text: slot.value, limit: target, question: q.text, label: slot.label })).trim();
          if (text && !(await tooLongBoxes(ctx, q, withSlot(q, suggested, slot.key, text))).some((b) => mine.has(boxId(b)))) {
            suggestion = text; source = 'rewritten'; break;
          }
        }
      } catch (e) { /* fall back to the person's own sentences */ }
    }
    if (!suggestion) {
      const trimmed = trimToSentences(slot.value, prefix);
      suggestion = trimmed.text;
      source = trimmed.how;
    }
    suggested = withSlot(q, suggested, slot.key, suggestion);
    issues.push({
      slot: slot.key,
      label: slot.label,
      forms: Array.from(new Set(now.filter((b) => mine.has(boxId(b))).map((b) => b.form.title))),
      length: slot.value.length,
      limit,
      words: Math.max(1, Math.round(limit / 6)),
      suggestion,
      source,
    });
  }
  if (!issues.length) {
    // The box is over because of other answers joined into it, not this one alone.
    return { fits: false, issues: [], suggested: null, forms: Array.from(new Set(bad.map((b) => b.form.title))) };
  }
  return { fits: false, issues, suggested };
}

module.exports = { checkAnswer, slotsOf, withSlot, sentences, trimToSentences, infoFor, blockSize, READABLE_MIN };
