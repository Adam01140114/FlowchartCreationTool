#!/usr/bin/env node
/**
 * Check a DocHelper response before handing it back - the same build the server
 * runs, into a scratch folder, so problems show up while they can still be fixed.
 *
 * Usage:
 *   node DocHelper/check-output.js <session-id>          checks DocHelper/outbox/<id>/
 *   node DocHelper/check-output.js <session-id> <dir|zip|json>
 *
 * Prints, per form: fields kept, how many are asked, the question count, every
 * problem (wording rules, unknown field ids, questions never asked), and the
 * interview as the filer meets it on the widest path. Exit code 1 on an error
 * that stops the build; warnings alone exit 0.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const pkg = require('./server/package');
const { buildForm } = require('./server/build');

async function main() {
  const [id, from] = process.argv.slice(2);
  if (!id) { console.error('usage: node DocHelper/check-output.js <session-id> [dir|zip|json]'); process.exit(2); }
  const sessionDir = path.join(__dirname, 'sessions', id);
  const session = JSON.parse(fs.readFileSync(path.join(sessionDir, 'session.json'), 'utf8'));

  let response;
  const source = from || path.join(__dirname, 'outbox', id);
  if (fs.statSync(source).isDirectory()) {
    response = await pkg.readFolder(source);
  } else {
    response = await pkg.readOutput(fs.readFileSync(source), path.basename(source));
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dochelper-check-'));
  let failed = false;
  const packetForms = (response.packet && response.packet.forms) || [];
  for (const f of session.forms) {
    const r = response.forms[f.base];
    console.log(`\n=== ${f.base} (${f.originalName}) ===`);
    if (!r || !r.fieldConfig) { console.log('  ERROR: no field-config.json'); failed = true; continue; }
    if (!r.hints) console.log('  warning: no hints.json - every field becomes its own question');
    if (!packetForms.some((e) => e.form === f.base)) console.log('  warning: not in packet.json - it will always be filled');
    try {
      const built = await buildForm({
        base: f.base, title: (packetForms.find((e) => e.form === f.base) || {}).title || f.originalName,
        plainPdf: path.join(sessionDir, 'forms', f.base, 'plain.pdf'),
        fieldConfig: r.fieldConfig, hints: r.hints || {}, formDir: path.join(scratch, f.base),
      });
      console.log(`  ${built.fieldCount} fields kept, ${built.askedFields} asked, ${built.questionCount} questions`);
      built.problems.forEach((p) => console.log('  problem: ' + p));
      const print = (q, depth) => {
        console.log('  ' + '  '.repeat(depth) + `[${q.type}${q.optional ? ', optional' : ''}] ${q.text}`
          + (q.section && depth === 0 ? `   (${q.section})` : ''));
        (q.options || []).forEach((o) => {
          if (q.type === 'choice' || q.type === 'multi') console.log('  ' + '  '.repeat(depth + 1) + '- ' + o.label + `  (${o.value})`);
          (o.follow || []).forEach((x) => print(x, depth + 2));
        });
        (q.boxes || []).forEach((b) => console.log('  ' + '  '.repeat(depth + 1) + `* ${b.label} -> ${b.key}`));
      };
      console.log('  --- interview ---');
      built.interview.questions.forEach((q) => print(q, 0));
    } catch (err) {
      console.log('  ERROR: ' + err.message);
      failed = true;
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  console.log(failed ? '\nNOT READY - fix the errors above.' : '\nBuilds cleanly. Read the interview above, then touch READY.');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
