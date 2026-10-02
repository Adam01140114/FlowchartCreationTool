/**
 * DocHelper's API, mounted on the dev server (dev-server.js) under /api/dochelper.
 *
 * A session is one person's stack of PDFs, kept in DocHelper/sessions/<id>/:
 *
 *   session.json            stage, progress, forms, problems
 *   forms/<form>/original.pdf, plain.pdf, fields.json, page-text.txt, pages/
 *   response/               the field configs and hints that came back
 *   built/<form>/           sanitized.pdf, field-config.json, hints.json,
 *                           flowchart.json, interview.json
 *   interview.json          the packet's interview, what the chat walks
 *   answers.json, filled/   the answers and the filled PDFs
 *
 * Stages: reading -> waiting (for the prompt package response) or designing
 * (Claude API) -> building -> ready -> filled; or error.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const pdfTools = require('./pdf-tools');
const pkg = require('./package');
const ai = require('./ai');
const { buildForm } = require('./build');
const { fillPacket, reached } = require('./fill');
const { checkAnswer } = require('./fit');

const HOME = path.join(__dirname, '..');
const SESSIONS = path.join(HOME, 'sessions');
const INBOX = path.join(HOME, 'inbox');
const OUTBOX = path.join(HOME, 'outbox');
const MAX_FORMS = 25;

const cache = new Map();

function sessionDir(id) { return path.join(SESSIONS, id); }
function validId(id) { return /^dh-[0-9]{8}-[0-9a-f]{6}$/.test(String(id || '')); }

function load(id) {
  if (cache.has(id)) return cache.get(id);
  const file = path.join(sessionDir(id), 'session.json');
  if (!fs.existsSync(file)) return null;
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  cache.set(id, s);
  return s;
}

function save(s) {
  s.updatedAt = new Date().toISOString();
  cache.set(s.id, s);
  fs.mkdirSync(sessionDir(s.id), { recursive: true });
  const file = path.join(sessionDir(s.id), 'session.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(s, null, 2));
  fs.renameSync(file + '.tmp', file);
}

function progress(s, message) {
  s.progress = s.progress || [];
  s.progress.push({ at: new Date().toISOString(), message });
  save(s);
}

function fail(s, err, stage) {
  s.stage = stage || 'error';
  s.error = String((err && err.message) || err);
  progress(s, 'Stopped: ' + s.error);
}

/** "DV-100 (1).pdf" -> "dv100", unique within the session. */
function baseName(original, taken) {
  let base = path.basename(String(original || 'form'), path.extname(String(original || '')))
    .toLowerCase().replace(/\(\d+\)$/, '').replace(/[^a-z0-9]+/g, '').slice(0, 32) || 'form';
  if (/^[0-9]/.test(base)) base = 'form' + base;
  let out = base;
  for (let n = 2; taken.has(out); n++) out = base + '_' + n;
  taken.add(out);
  return out;
}

function newId() {
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return 'dh-' + ymd + '-' + crypto.randomBytes(3).toString('hex');
}

/** What the page is told about a session - never the paths on disk. */
function publicView(s) {
  return {
    id: s.id,
    stage: s.stage,
    mode: s.mode,
    error: s.error || null,
    userNote: s.userNote || '',
    progress: (s.progress || []).map((p) => p.message),
    forms: s.forms.map((f) => ({
      form: f.base, name: f.originalName, title: f.title || null, pages: f.pageCount, fields: f.fieldCount,
      questions: f.questionCount || null, asked: f.askedFields || null,
    })),
    problems: s.problems || [],
    notes: s.notes || '',
    filled: s.filled || null,
    packageReady: !!s.packageReady,
  };
}

/* ------------------------------------------------------------------ */
/* the pipeline                                                        */
/* ------------------------------------------------------------------ */

async function readForms(s) {
  const dir = sessionDir(s.id);
  for (const f of s.forms) {
    progress(s, `Reading ${f.originalName}`);
    const formDir = path.join(dir, 'forms', f.base);
    const original = fs.readFileSync(path.join(formDir, 'original.pdf'));
    const unlocked = await pdfTools.unlock(original);
    fs.writeFileSync(path.join(formDir, 'plain.pdf'), unlocked.bytes);
    const described = await pdfTools.describeForm(unlocked.bytes);
    const fillable = described.fields.filter((x) => x.type !== 'button' && x.type !== 'signature');
    if (!fillable.length) {
      throw new Error(`${f.originalName} has no fillable fields. DocHelper fills PDF forms that have boxes to type in; `
        + 'a scanned or flattened PDF has none.');
    }
    fs.writeFileSync(path.join(formDir, 'fields.json'), JSON.stringify(described.fields, null, 1));
    fs.writeFileSync(path.join(formDir, 'page-text.txt'), described.pages
      .map((p) => `===== page ${p.number} =====\n` + p.lines.join('\n')).join('\n\n'));
    progress(s, `Found ${fillable.length} fields on ${described.pageCount} page${described.pageCount === 1 ? '' : 's'} of ${f.originalName}`);
    await pdfTools.renderPages(unlocked.bytes, path.join(formDir, 'pages'), { fields: described.fields });
    f.pageCount = described.pageCount;
    f.fieldCount = fillable.length;
    save(s);
  }
}

async function preparePackage(s) {
  const zip = await pkg.buildInputZip(s, sessionDir(s.id));
  fs.writeFileSync(path.join(sessionDir(s.id), 'prompt_package_input.zip'), zip);
  pkg.writeInbox(s, sessionDir(s.id), INBOX, zip);
  s.packageReady = true;
  save(s);
}

/** Turn a response (from the API, an upload or the outbox) into a ready interview. */
async function build(s, response) {
  s.stage = 'building';
  s.error = null;
  s.problems = [];
  // A new design replaces the last one; so does its log.
  if (s.readSteps) s.progress = s.progress.slice(0, s.readSteps);
  progress(s, 'Building the interview and wiring the PDFs');
  const dir = sessionDir(s.id);
  const respDir = path.join(dir, 'response');
  fs.rmSync(respDir, { recursive: true, force: true });
  fs.mkdirSync(respDir, { recursive: true });
  fs.writeFileSync(path.join(respDir, 'packet.json'), JSON.stringify(response.packet, null, 2));
  if (response.notes) fs.writeFileSync(path.join(respDir, 'notes.md'), response.notes);

  const known = new Map(s.forms.map((f) => [f.base, f]));
  const missing = s.forms.filter((f) => !response.forms[f.base] || !response.forms[f.base].fieldConfig);
  if (missing.length) {
    throw new Error('The response has no field config for ' + missing.map((f) => `${f.base} (${f.originalName})`).join(', ')
      + '. Every form in request.json needs forms/<form>/field-config.json and hints.json.');
  }
  // Packet order and activations; any uploaded form the packet forgot is always filled, last.
  const entries = [];
  (Array.isArray(response.packet.forms) ? response.packet.forms : []).forEach((e) => {
    if (!e || !known.has(e.form)) { s.problems.push(`packet.json names "${e && e.form}", which was not uploaded; ignored`); return; }
    if (entries.some((x) => x.form === e.form)) return;
    entries.push(e);
  });
  s.forms.forEach((f) => {
    if (!entries.some((e) => e.form === f.base)) {
      s.problems.push(`packet.json left out ${f.base}; it is always filled`);
      entries.push({ form: f.base });
    }
  });

  const packetForms = [];
  for (const e of entries) {
    const f = known.get(e.form);
    const r = response.forms[e.form];
    fs.mkdirSync(path.join(respDir, 'forms', e.form), { recursive: true });
    fs.writeFileSync(path.join(respDir, 'forms', e.form, 'field-config.json'), JSON.stringify(r.fieldConfig, null, 2));
    fs.writeFileSync(path.join(respDir, 'forms', e.form, 'hints.json'), JSON.stringify(r.hints || {}, null, 2));
    const title = e.title || (r.fieldConfig && r.fieldConfig.formTitle) || f.originalName;
    progress(s, `Compiling ${title}`);
    const built = await buildForm({
      base: e.form,
      title,
      plainPdf: path.join(dir, 'forms', e.form, 'plain.pdf'),
      fieldConfig: r.fieldConfig,
      hints: r.hints || {},
      formDir: path.join(dir, 'built', e.form),
    });
    built.problems.forEach((p) => s.problems.push(`${e.form}: ${p}`));
    f.title = title;
    f.questionCount = built.questionCount;
    f.askedFields = built.askedFields;
    packetForms.push({ form: e.form, title, includeWhen: e.includeWhen || null, interview: built.interview });
  }
  const interview = { title: response.packet.title || s.userNote || 'Your forms', forms: packetForms };
  fs.writeFileSync(path.join(dir, 'interview.json'), JSON.stringify(interview, null, 2));
  s.notes = response.notes || '';
  s.stage = 'ready';
  progress(s, 'Ready');
}

async function startAnalysis(s) {
  try {
    await readForms(s);
    await preparePackage(s);
    s.readSteps = s.progress.length;
    if (s.mode === 'api') {
      s.stage = 'designing';
      progress(s, 'Designing the interview');
      const response = await ai.designPacket({ session: s, sessionDir: sessionDir(s.id), onProgress: (m) => progress(s, m) });
      await build(s, response);
    } else {
      s.stage = 'waiting';
      progress(s, 'Waiting for the interview design');
    }
  } catch (err) {
    fail(s, err);
  }
}

/** A local Claude Code session may have answered in the outbox. */
async function checkOutbox(s) {
  if (s.stage !== 'waiting' || s._outboxBusy) return;
  let response = null;
  try { response = await pkg.readOutbox(OUTBOX, s.id); } catch (err) {
    s.error = 'The answer in the outbox could not be read: ' + err.message;
    save(s);
    return;
  }
  if (!response) return;
  s._outboxBusy = true;
  try {
    progress(s, 'Picked up the interview design from Claude Code');
    await build(s, response);
  } catch (err) {
    fail(s, err, 'waiting');
  } finally {
    delete s._outboxBusy;
    save(s);
  }
}

/* ------------------------------------------------------------------ */
/* routes                                                              */
/* ------------------------------------------------------------------ */

function registerDocHelperRoutes(app, { port }) {
  const serverUrl = 'http://127.0.0.1:' + port;
  fs.mkdirSync(SESSIONS, { recursive: true });

  // The repo root is served statically; people's PDFs and answers are not.
  // Judged on the decoded path: express.static decodes "%73essions" to
  // "sessions", and a check on the raw path let that through.
  app.use((req, res, next) => {
    let p;
    try { p = decodeURIComponent(req.path); } catch (e) { return res.status(400).send('Bad path'); }
    p = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').toLowerCase();
    if (/^\/dochelper\/(sessions|inbox|outbox)(\/|$)/.test(p)) return res.status(404).send('Not found');
    next();
  });
  app.get(['/dochelper', '/DocHelper', '/DocHelper/'], (req, res) => res.redirect('/DocHelper/index.html'));

  const withSession = (handler) => async (req, res) => {
    const id = req.params.id;
    if (!validId(id)) return res.status(404).json({ error: 'No such session.' });
    const s = load(id);
    if (!s) return res.status(404).json({ error: 'No such session.' });
    try { await handler(req, res, s); } catch (err) {
      console.error('[dochelper]', err);
      if (!res.headersSent) res.status(500).json({ error: String(err.message || err) });
    }
  };

  app.get('/api/dochelper/status', (req, res) => {
    res.json({
      mode: ai.apiAvailable() ? 'api' : 'manual',
      model: ai.apiAvailable() ? ai.modelName() : null,
      qpdf: !!pdfTools.qpdfCommand(),
    });
  });

  app.post('/api/dochelper/sessions', (req, res) => {
    const raw = req.files && (req.files.pdfs || req.files['pdfs[]']);
    const files = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
    if (!files.length) return res.status(400).json({ error: 'Add at least one PDF.' });
    if (files.length > MAX_FORMS) return res.status(400).json({ error: `At most ${MAX_FORMS} PDFs at a time.` });
    const notPdf = files.filter((f) => !(f.data && f.data.slice(0, 5).toString('latin1') === '%PDF-'));
    if (notPdf.length) {
      return res.status(400).json({ error: 'Only PDF files can be added: ' + notPdf.map((f) => f.name).join(', ') });
    }
    const s = {
      id: newId(),
      createdAt: new Date().toISOString(),
      stage: 'reading',
      mode: ai.apiAvailable() ? 'api' : 'manual',
      userNote: String((req.body && req.body.note) || '').slice(0, 2000),
      forms: [],
      progress: [],
    };
    const taken = new Set();
    files.forEach((f, i) => {
      const base = baseName(f.name, taken);
      const dir = path.join(sessionDir(s.id), 'forms', base);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'original.pdf'), f.data);
      s.forms.push({ base, originalName: path.basename(f.name), order: i + 1 });
    });
    save(s);
    startAnalysis(s);
    res.json(publicView(s));
  });

  app.get('/api/dochelper/sessions/:id', withSession(async (req, res, s) => {
    await checkOutbox(s);
    res.json(publicView(s));
  }));

  app.get('/api/dochelper/sessions/:id/package', withSession(async (req, res, s) => {
    const file = path.join(sessionDir(s.id), 'prompt_package_input.zip');
    if (!fs.existsSync(file)) return res.status(409).json({ error: 'The package is still being made.' });
    res.download(file, 'prompt_package_input.zip');
  }));

  app.post('/api/dochelper/sessions/:id/response', withSession(async (req, res, s) => {
    const up = req.files && req.files.response;
    if (!up) return res.status(400).json({ error: 'Choose prompt_package_output.zip (or the JSON reply).' });
    if (['reading', 'building', 'designing'].includes(s.stage)) {
      return res.status(409).json({ error: 'DocHelper is busy with this session; try again in a moment.' });
    }
    let response;
    try { response = await pkg.readOutput(up.data, up.name); } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      await build(s, response);
    } catch (err) {
      fail(s, err, 'waiting');
      return res.status(400).json(publicView(s));
    }
    res.json(publicView(s));
  }));

  app.get('/api/dochelper/sessions/:id/interview', withSession(async (req, res, s) => {
    const file = path.join(sessionDir(s.id), 'interview.json');
    if (!fs.existsSync(file)) return res.status(409).json({ error: 'The interview is not ready yet.' });
    res.type('json').send(fs.readFileSync(file, 'utf8'));
  }));

  app.post('/api/dochelper/sessions/:id/fill', withSession(async (req, res, s) => {
    const answers = (req.body && req.body.answers) || {};
    const dir = sessionDir(s.id);
    const interview = JSON.parse(fs.readFileSync(path.join(dir, 'interview.json'), 'utf8'));
    const forms = interview.forms.map((f) => Object.assign({}, f, {
      sanitizedPdf: path.join(dir, 'built', f.form, 'sanitized.pdf'),
    }));
    if (!reached(forms, answers).done) return res.status(400).json({ error: 'Some questions are still unanswered.' });
    fs.writeFileSync(path.join(dir, 'answers.json'), JSON.stringify(answers, null, 2));
    const outDir = path.join(dir, 'filled');
    fs.rmSync(outDir, { recursive: true, force: true });
    const results = await fillPacket({ forms, answers, outDir, serverUrl, cacheTag: s.id });
    s.stage = 'filled';
    s.filled = results;
    save(s);
    res.json(publicView(s));
  }));

  // Does this answer fit the boxes it goes in? If not: the limit, and a version that fits.
  app.post('/api/dochelper/sessions/:id/check', withSession(async (req, res, s) => {
    const { questionId, answer } = req.body || {};
    const answers = (req.body && req.body.answers) || {};
    const dir = sessionDir(s.id);
    const interview = JSON.parse(fs.readFileSync(path.join(dir, 'interview.json'), 'utf8'));
    const forms = interview.forms.map((f) => Object.assign({}, f, {
      sanitizedPdf: path.join(dir, 'built', f.form, 'sanitized.pdf'),
    }));
    let q = null;
    const find = (list) => list.forEach((x) => { if (x.id === questionId) q = q || x; (x.options || []).forEach((o) => find(o.follow || [])); });
    forms.forEach((f) => find(f.interview.questions));
    if (!q) return res.status(400).json({ error: 'No such question.' });
    const result = await checkAnswer({
      forms, answers, serverUrl, sessionId: s.id,
      rewrite: ai.apiAvailable() ? ai.shortenText : null,
    }, q, answer);
    res.json(result);
  }));

  app.get('/api/dochelper/sessions/:id/files/:name', withSession(async (req, res, s) => {
    const name = path.basename(String(req.params.name));
    const file = path.join(sessionDir(s.id), 'filled', name);
    if (!/\.pdf$/i.test(name) || !fs.existsSync(file)) return res.status(404).json({ error: 'No such file.' });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${name}"`);
    res.send(fs.readFileSync(file));
  }));

  app.get('/api/dochelper/sessions/:id/download-all', withSession(async (req, res, s) => {
    const dir = path.join(sessionDir(s.id), 'filled');
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Nothing has been filled yet.' });
    const zip = new JSZip();
    fs.readdirSync(dir).filter((n) => n.endsWith('.pdf')).forEach((n) => zip.file(n, fs.readFileSync(path.join(dir, n))));
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename="filled-forms.zip"');
    res.send(bytes);
  }));

  // Sessions left mid-read by a restart cannot resume; say so instead of spinning.
  try {
    fs.readdirSync(SESSIONS).filter(validId).forEach((id) => {
      const s = load(id);
      if (s && ['reading', 'designing', 'building'].includes(s.stage)) {
        fail(s, new Error('The server restarted while this was in progress. Start again with the same PDFs.'));
      }
    });
  } catch (e) { /* no sessions yet */ }

  return { mode: ai.apiAvailable() ? 'api' : 'manual' };
}

module.exports = { registerDocHelperRoutes, build, load, save, sessionDir, SESSIONS, INBOX, OUTBOX };
