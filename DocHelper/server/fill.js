/**
 * Answers in, filled PDFs out.
 *
 * The payload for each form is what the generated FormWiz form would post:
 * keys are the sanitized PDF's field names (the field config's newNames), a
 * text box gets its text, a PDF checkbox gets "Yes" when it should be ticked.
 * Then the sanitized PDF and that payload go to the dev server's own
 * POST /edit_pdf - the same fill the published forms use, with its
 * shrink-to-fit, ruled-line layout and continuation lines - so DocHelper does
 * not keep a second, weaker copy of the filler.
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { walk } = require('../interview-walk');

function today() {
  const d = new Date();
  return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear();
}

/** A date input's 2026-10-02 as the court forms print it, 10/02/2026. */
function formatValue(type, value) {
  if (value == null) return '';
  const s = String(value);
  if (type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return m[2] + '/' + m[3] + '/' + m[1];
  }
  return s;
}

function repeatFieldName(block, field, n) {
  return block + '_' + String(field).split('{n}').join(String(n));
}

/**
 * Every value one form's answers put on paper.
 * `onPath` is the set of question ids the walk reached; nothing else counts.
 */
function payloadFor(interview, answers, onPath) {
  const out = {};
  const set = (name, value) => { if (name) out[name] = value; };

  function question(q) {
    if (!onPath.has(q.id)) return;
    const a = answers[q.id];
    if (q.type === 'choice' || q.type === 'multi') {
      const chosen = new Set(q.type === 'multi' ? (Array.isArray(a) ? a : []) : (a ? [a] : []));
      (q.options || []).forEach((o) => {
        // An option named after a PDF checkbox ticks it; the others are
        // answers no box holds (a gate's yes/no), and the PDF has no such name.
        set(o.value, chosen.has(o.value) ? 'Yes' : 'Off');
        (o.follow || []).forEach(question);
      });
      if (q.field) {
        // A question asked for one field: a lone checkbox asked as Yes/No ticks
        // that field; a PDF dropdown or radio takes the chosen option's words.
        const opt = (q.options || []).find((o) => o.value === a);
        const pdfType = String(q.field.pdfType || '');
        const value = pdfType === 'checkbox'
          ? (opt && /^yes$/i.test(opt.label) ? 'Yes' : 'Off')
          : (opt ? opt.label : '');
        q.field.targets.forEach((t) => set(t, value));
      }
      return;
    }
    if (q.type === 'boxes') {
      const values = (a && typeof a === 'object') ? a : {};
      (q.boxes || []).forEach((b) => {
        if (b.type === 'choice') {
          (b.options || []).forEach((o) => set(o.value, values[b.key] === o.value ? 'Yes' : 'Off'));
        } else {
          set(b.key, formatValue(b.type, values[b.key]));
        }
      });
      return;
    }
    if (q.type === 'repeat') {
      const entries = (a && Array.isArray(a.entries)) ? a.entries : [];
      const r = q.repeat;
      entries.forEach((entry, i) => {
        const n = i + 1;
        (r.fields || []).forEach((f) => {
          if (f.type === 'choice') {
            (f.options || []).forEach((o) => set(repeatFieldName(q.id, o.value, n), entry[f.key] === o.value ? 'Yes' : 'Off'));
          } else if (f.nameId) {
            set(repeatFieldName(q.id, f.nameId, n), formatValue(f.type, entry[f.key]));
          }
        });
      });
      if (r.joinInto && r.joinInto.field) {
        const only = Array.isArray(r.joinInto.fields) ? r.joinInto.fields : (r.fields || []).map((f) => f.nameId).filter(Boolean);
        const sep = r.joinInto.separator == null ? ', ' : r.joinInto.separator;
        const parts = [];
        entries.forEach((entry) => only.forEach((t) => { if (entry[t]) parts.push(formatValue('text', entry[t])); }));
        set(r.joinInto.field, parts.join(sep));
      }
      return;
    }
    // A value question.
    const value = formatValue(q.type, a);
    const targets = q.field ? q.field.targets : [q.id];
    targets.forEach((t) => set(t, value));
  }

  interview.questions.forEach(question);

  // Joins the compiler wired as linked logic: a split field put back together,
  // or a field the form fills for itself (a signature date from current_date).
  const known = Object.assign({ current_date: today() }, out);
  (interview.joins || []).forEach((j) => {
    const parts = j.parts.map((p) => known[p]).filter((v) => v && v !== 'Off');
    set(j.target, parts.join(j.join));
  });

  // Computed boxes (compile-form.js "computed"): a box other answers tick, and
  // the rest of a whole.
  (interview.computed || []).forEach((c) => {
    if (c.tickWhen) {
      const ticked = (n) => out[n] === 'Yes';
      const all = (c.tickWhen.all || []).every(ticked);
      const none = !(c.tickWhen.none || []).some(ticked);
      set(c.nameId, all && none ? 'Yes' : 'Off');
    } else if (c.remainderOf) {
      const part = Number(out[c.remainderOf.field]);
      const total = Number(c.remainderOf.total);
      if (Number.isFinite(part) && part >= 0 && part <= total) set(c.nameId, String(total - part));
    }
  });
  return out;
}

/** Which questions the answers reached, across the whole packet. */
function reached(forms, answers) {
  const result = walk(forms, answers);
  return { onPath: new Set(result.path.map((p) => p.question.id)), activeForms: result.activeForms, done: result.done };
}

/**
 * Fill every form the answers brought in.
 *   forms: [{ form, title, includeWhen, interview, sanitizedPdf }]
 * Writes <outDir>/<form>-filled.pdf and returns what was written.
 */
async function fillPacket({ forms, answers, outDir, serverUrl, cacheTag }) {
  const { onPath, activeForms, done } = reached(forms, answers);
  if (!done) throw new Error('The interview is not finished yet.');
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const entry of forms) {
    if (!activeForms.includes(entry.form)) continue;
    const payload = payloadFor(entry.interview, answers, onPath);
    const bytes = fs.readFileSync(entry.sanitizedPdf);
    // Only the names this PDF has: everything else is the interview's own
    // working values, and /edit_pdf would log each one as unmatched.
    const names = new Set((await PDFDocument.load(bytes, { ignoreEncryption: true })).getForm().getFields().map((f) => f.getName()));
    const body = new FormData();
    // /edit_pdf caches each PDF's ruled lines by the uploaded file's name, so the
    // name must be unique to this PDF: two sessions' "form.pdf" are different forms.
    body.append('pdf', new Blob([bytes], { type: 'application/pdf' }), (cacheTag ? cacheTag + '-' : '') + entry.form + '.pdf');
    let sent = 0;
    Object.keys(payload).forEach((k) => {
      if (!names.has(k)) return;
      body.append(k, payload[k]);
      sent += 1;
    });
    const res = await fetch(serverUrl + '/edit_pdf', { method: 'POST', body });
    if (!res.ok) throw new Error(entry.title + ': the PDF could not be filled (' + res.status + ' ' + (await res.text()).slice(0, 200) + ')');
    const filled = Buffer.from(await res.arrayBuffer());
    const file = path.join(outDir, entry.form + '-filled.pdf');
    fs.writeFileSync(file, filled);
    const list = (h) => decodeURIComponent(res.headers.get(h) || '').split(',').filter(Boolean);
    results.push({
      form: entry.form,
      title: entry.title,
      file: path.basename(file),
      valuesSent: sent,
      shrunk: list('x-fill-shrunk'),
      didNotFit: list('x-fill-unfitted'),
    });
  }
  return results;
}

module.exports = { fillPacket, payloadFor, reached, formatValue };
