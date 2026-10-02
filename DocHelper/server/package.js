/**
 * The makeshift API: prompt_package_input.zip out, prompt_package_output.zip in.
 *
 * With no API key, the judgment step (field config + hints, NEW-FORM.md) is done
 * by a chat session: DocHelper packs everything that session needs - the unlocked
 * PDFs, the field lists, the pages with every box numbered, the hints reference
 * and a shipped example - and takes back the files it writes.
 *
 * The same package is also written unzipped to DocHelper/inbox/<session>/, so a
 * Claude Code session on this machine can work straight from it and drop its
 * answer in DocHelper/outbox/<session>/, which the page picks up by itself.
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const REPO = path.join(__dirname, '..', '..');
const PROMPT = path.join(__dirname, '..', 'prompt', 'PROMPT.md');
const REFERENCE = [
  ['reference/NEW-FORM.md', path.join(REPO, 'Hand Off', 'NEW-FORM.md')],
  ['reference/flowchart_ai_trainer_doc.txt', path.join(REPO, 'Hand Off', 'flowchart_ai_trainer_doc.txt')],
  ['reference/example-bcia8016-field-config.json', path.join(REPO, 'dv-field-configs', 'bcia8016-field-config.json')],
  ['reference/example-bcia8016-hints.json', path.join(REPO, 'bcia8016-hints.json')],
  ['reference/example-mc030-response/packet.json', path.join(__dirname, '..', 'examples', 'mc030-response', 'packet.json')],
  ['reference/example-mc030-response/forms/mc030/field-config.json', path.join(__dirname, '..', 'examples', 'mc030-response', 'forms', 'mc030', 'field-config.json')],
  ['reference/example-mc030-response/forms/mc030/hints.json', path.join(__dirname, '..', 'examples', 'mc030-response', 'forms', 'mc030', 'hints.json')],
  ['reference/example-mc030-response/notes.md', path.join(__dirname, '..', 'examples', 'mc030-response', 'notes.md')],
];

function promptText(session) {
  const note = session.userNote
    ? '## What the person said they are filling out\n\n> ' + String(session.userNote).replace(/\n/g, '\n> ') + '\n'
    : '';
  return fs.readFileSync(PROMPT, 'utf8').replace('{{USER_NOTE}}', note);
}

function readme(session) {
  return [
    '# DocHelper prompt package',
    '',
    `Session: ${session.id}`,
    `Forms: ${session.forms.map((f) => f.originalName).join(', ')}`,
    '',
    '## Using it',
    '',
    '1. Give this whole zip to Claude (Claude Code, or a claude.ai chat with the files attached).',
    '2. Say: "Follow PROMPT.md and give me prompt_package_output.zip".',
    '3. In DocHelper, press **Upload response** and choose the zip (or the JSON reply).',
    '',
    'In Claude Code on this machine you can skip the download: say',
    '"process the DocHelper inbox" and DocHelper picks the answer up by itself.',
    '',
  ].join('\n');
}

/** Every file of the package, as [path inside the package, Buffer|string]. */
function packageFiles(session, sessionDir) {
  const files = [
    ['README.md', readme(session)],
    ['PROMPT.md', promptText(session)],
    ['request.json', JSON.stringify({
      sessionId: session.id,
      createdAt: session.createdAt,
      userNote: session.userNote || '',
      forms: session.forms.map((f) => ({
        form: f.base, uploadedAs: f.originalName, pages: f.pageCount, fields: f.fieldCount,
      })),
    }, null, 2)],
  ];
  session.forms.forEach((f) => {
    const dir = path.join(sessionDir, 'forms', f.base);
    files.push([`forms/${f.base}/source.pdf`, fs.readFileSync(path.join(dir, 'plain.pdf'))]);
    files.push([`forms/${f.base}/fields.json`, fs.readFileSync(path.join(dir, 'fields.json'))]);
    files.push([`forms/${f.base}/page-text.txt`, fs.readFileSync(path.join(dir, 'page-text.txt'))]);
    const pagesDir = path.join(dir, 'pages');
    fs.readdirSync(pagesDir).filter((n) => n.endsWith('.png')).sort()
      .forEach((n) => files.push([`forms/${f.base}/pages/${n}`, fs.readFileSync(path.join(pagesDir, n))]));
  });
  REFERENCE.forEach(([inside, from]) => {
    if (fs.existsSync(from)) files.push([inside, fs.readFileSync(from)]);
  });
  return files;
}

async function buildInputZip(session, sessionDir) {
  const zip = new JSZip();
  packageFiles(session, sessionDir).forEach(([p, data]) => zip.file(p, data));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** The package, unzipped, where a local Claude Code session can read it. */
function writeInbox(session, sessionDir, inboxDir, zipBytes) {
  const dir = path.join(inboxDir, session.id);
  fs.rmSync(dir, { recursive: true, force: true });
  packageFiles(session, sessionDir).forEach(([p, data]) => {
    const file = path.join(dir, ...p.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  });
  fs.writeFileSync(path.join(dir, 'prompt_package_input.zip'), zipBytes);
  return dir;
}

/**
 * JSON a model wrote, forgiving what models get wrong most often: a fence
 * around it, and a lone backslash in a field id ("FillText11\.yards").
 */
function parseJsonLoose(text, where) {
  let s = String(text).replace(/^﻿/, '').trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s);
  if (fence) s = fence[1];
  try { return JSON.parse(s); } catch (first) {
    try { return JSON.parse(s.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')); } catch (e) {
      throw new Error(`${where} is not valid JSON: ${first.message}`);
    }
  }
}

/**
 * Read a response - prompt_package_output.zip, or the single-JSON form - into
 * { packet, forms: { base: { fieldConfig, hints } }, notes }.
 */
async function readOutput(bytes, filename) {
  const name = String(filename || '').toLowerCase();
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    const data = parseJsonLoose(bytes.toString('utf8'), name || 'the response');
    if (!data.packet || !data.forms) throw new Error('The JSON response needs "packet" and "forms".');
    return { packet: data.packet, forms: data.forms, notes: data.notes || '' };
  }
  const zip = await JSZip.loadAsync(bytes);
  // Zipped from inside a folder: everything sits under one top-level directory.
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const packetPath = names.find((n) => /(^|\/)packet\.json$/.test(n));
  if (!packetPath) throw new Error('prompt_package_output.zip has no packet.json.');
  const prefix = packetPath.slice(0, packetPath.length - 'packet.json'.length);
  const read = async (p) => parseJsonLoose(await zip.file(p).async('string'), p);
  const packet = await read(packetPath);
  const forms = {};
  for (const n of names) {
    const m = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'forms/([^/]+)/(field-config|hints)\\.json$').exec(n);
    if (!m) continue;
    forms[m[1]] = forms[m[1]] || {};
    forms[m[1]][m[2] === 'hints' ? 'hints' : 'fieldConfig'] = await read(n);
  }
  const notesPath = names.find((n) => n === prefix + 'notes.md');
  const notes = notesPath ? await zip.file(notesPath).async('string') : '';
  return { packet, forms, notes };
}

/** Read an answer a local session left in the outbox folder (unzipped, or as a zip). */
async function readOutbox(outboxDir, sessionId) {
  const dir = path.join(outboxDir, sessionId);
  // READY is written last, so a half-written answer is never read.
  if (!fs.existsSync(path.join(dir, 'READY'))) return null;
  return readFolder(dir);
}

/** A response laid out as files in a folder (or a prompt_package_output.zip inside it). */
async function readFolder(dir) {
  const zipPath = path.join(dir, 'prompt_package_output.zip');
  if (fs.existsSync(zipPath)) return readOutput(fs.readFileSync(zipPath), 'prompt_package_output.zip');
  const packet = parseJsonLoose(fs.readFileSync(path.join(dir, 'packet.json'), 'utf8'), 'packet.json');
  const forms = {};
  const formsDir = path.join(dir, 'forms');
  (fs.existsSync(formsDir) ? fs.readdirSync(formsDir) : []).forEach((base) => {
    const read = (n) => {
      const p = path.join(formsDir, base, n);
      return fs.existsSync(p) ? parseJsonLoose(fs.readFileSync(p, 'utf8'), `forms/${base}/${n}`) : undefined;
    };
    forms[base] = { fieldConfig: read('field-config.json'), hints: read('hints.json') };
  });
  const notesPath = path.join(dir, 'notes.md');
  return { packet, forms, notes: fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf8') : '' };
}

module.exports = { buildInputZip, writeInbox, readOutput, readOutbox, readFolder, promptText, parseJsonLoose, packageFiles };
