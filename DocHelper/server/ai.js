/**
 * The judgment step through the Claude API, once there is a key.
 *
 * Same instructions as the prompt package (PROMPT.md), sent one form at a time
 * in packet order with the page images attached, and with the names earlier
 * forms already chose - which is the repo's "compile the primary form first and
 * let the others borrow its names" rule. Goes through auto-form/openai-fetch.js,
 * the repo's existing Claude client (retries, IPv4, Anthropic Messages API).
 *
 * Enabled when ANTHROPIC_API_KEY is in .env. DOCHELPER_MODEL picks the model.
 */
const fs = require('fs');
const path = require('path');
const { fetchOpenAiWithRetry } = require('../../auto-form/openai-fetch');
const { promptText, parseJsonLoose } = require('./package');

const REPO = path.join(__dirname, '..', '..');

function apiAvailable() {
  return !!String(process.env.ANTHROPIC_API_KEY || '').trim();
}

function modelName() {
  return String(process.env.DOCHELPER_MODEL || process.env.ANTHROPIC_MODEL || 'claude-opus-5-5').trim();
}

const RETURN_SHAPE = [
  'Reply with ONE JSON object and nothing else:',
  '{ "fieldConfig": { "formTitle": "...", "fields": [...] },',
  '  "hints": { ... },',
  '  "packetEntry": { "title": "<the form\'s number and name>", "includeWhen": [] },',
  '  "notes": "<anything the person should know, or empty>" }',
  'Leave includeWhen empty for a form that is always filled. It may only name answers from the forms listed under "Names already chosen".',
].join('\n');

async function designForm({ session, sessionDir, form, earlier, onProgress }) {
  const dir = path.join(sessionDir, 'forms', form.base);
  const pages = fs.readdirSync(path.join(dir, 'pages')).filter((n) => n.endsWith('.png')).sort();
  const reference = [
    ['NEW-FORM.md', path.join(REPO, 'Hand Off', 'NEW-FORM.md')],
    ['example-bcia8016-field-config.json', path.join(REPO, 'dv-field-configs', 'bcia8016-field-config.json')],
    ['example-bcia8016-hints.json', path.join(REPO, 'bcia8016-hints.json')],
  ].map(([n, p]) => `--- reference/${n} ---\n${fs.readFileSync(p, 'utf8')}`).join('\n\n');

  const earlierText = earlier.length
    ? earlier.map((e) => `Form ${e.base} ("${e.title}"):\n`
      + e.fieldConfig.fields.filter((f) => !f.courtUse).map((f) => `  ${f.newName} - ${f.label || ''}`).join('\n')
      + (e.questionIds.length ? '\n  questions/answers: ' + e.questionIds.join(', ') : '')).join('\n\n')
    : '(none - this is the first form)';

  const text = [
    promptText(session),
    '\n\n# This request\n',
    `Design ONE form now: "${form.base}" (uploaded as ${form.originalName}), form ${form.order} of ${session.forms.length}.`,
    'The page images are attached in order, with every field box numbered by its index in fields.json.',
    '\n## Names already chosen on earlier forms (reuse them for the same facts)\n',
    earlierText,
    '\n## fields.json\n',
    fs.readFileSync(path.join(dir, 'fields.json'), 'utf8'),
    '\n## page-text.txt\n',
    fs.readFileSync(path.join(dir, 'page-text.txt'), 'utf8'),
    '\n## Reference\n',
    reference,
    '\n\n' + RETURN_SHAPE,
  ].join('\n');

  const content = [{ type: 'text', text }].concat(pages.map((n) => ({
    type: 'image_url',
    image_url: { url: 'data:image/png;base64,' + fs.readFileSync(path.join(dir, 'pages', n)).toString('base64') },
  })));

  onProgress && onProgress(`Asking Claude to design ${form.originalName}`);
  const res = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName(),
      max_tokens: 32000,
      messages: [{ role: 'user', content }],
    }),
  });
  const data = await res.json();
  const reply = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : '';
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Claude's reply for ${form.originalName} had no JSON in it.`);
  return parseJsonLoose(reply.slice(start, end + 1), `Claude's reply for ${form.originalName}`);
}

/** Every form, in upload order, into the shape readOutput returns. */
async function designPacket({ session, sessionDir, onProgress }) {
  const forms = {};
  const packetForms = [];
  const notes = [];
  const earlier = [];
  for (const form of session.forms) {
    const out = await designForm({ session, sessionDir, form, earlier, onProgress });
    if (!out.fieldConfig || !out.hints) throw new Error(`Claude's reply for ${form.originalName} is missing fieldConfig or hints.`);
    forms[form.base] = { fieldConfig: out.fieldConfig, hints: out.hints };
    const entry = { form: form.base, title: (out.packetEntry && out.packetEntry.title) || out.fieldConfig.formTitle || form.originalName };
    const when = out.packetEntry && out.packetEntry.includeWhen;
    if (Array.isArray(when) && when.length) entry.includeWhen = when;
    packetForms.push(entry);
    if (out.notes) notes.push(`${form.originalName}: ${out.notes}`);
    const h = out.hints || {};
    const questionIds = Object.keys(h.questions || {}).concat((h.groups || []).map((g) => g.nameId))
      .concat((h.choices || []).map((c) => c.nameId)).filter((k) => k && k[0] !== '_');
    earlier.push({ base: form.base, title: entry.title, fieldConfig: out.fieldConfig, questionIds });
  }
  return { packet: { title: session.userNote || '', forms: packetForms }, forms, notes: notes.join('\n\n') };
}

/**
 * A shorter version of an answer, in the person's own voice, within `limit`
 * characters. The caller checks it against the box before offering it.
 */
async function shortenText({ text, limit, question, label }) {
  const prompt = [
    'Someone is filling out a court or government form. Their answer is too long for the box it is printed in.',
    `The question was: "${question}"` + (label ? ` (the part labelled "${label}")` : ''),
    `Rewrite their answer so it is at most ${limit} characters, including spaces.`,
    'Keep it in their voice and in the first person if they wrote that way. Keep every name, date, place, number and',
    'fact that matters; drop repetition and filler first. Do not add anything they did not say. Do not use',
    'abbreviations a court would not understand.',
    'Reply with the rewritten answer only - no quotes, no preamble.',
    '',
    'Their answer:',
    text,
  ].join('\n');
  const res = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName(), max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  return (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

module.exports = { apiAvailable, designPacket, modelName, shortenText };
