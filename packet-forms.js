/**
 * Which forms are in the packet.
 *
 * Every script that walks the packet needs this list, and every one of them
 * used to keep its own: pipeline-fill.js had three of five written out,
 * pipeline-connect.js five of six, pipeline-sanitize.js three of six, and
 * pipeline-capacity.js matched filenames against /^dv\d+\.pdf$/ - which is not
 * a list at all until a form is called CLETS-001, and then it is a list of
 * everything except that one.
 *
 * Each of those went stale silently. A form joined the packet and was simply
 * not filled, or not measured, or not reconciled with the others, and nothing
 * said so - the run looked exactly like a clean one with fewer pages.
 *
 * So it is answered once, here, from the file that actually decides it.
 */
const fs = require('fs');
const path = require('path');

const SPEC = 'dv-packet.spec.json';
const CONFIG_DIR = 'dv-field-configs';

/** The PDF basename a spec entry refers to: "CLETS-001" -> "clets001". */
function baseOf(entry) {
  return String((entry && (entry.pdf || entry.name)) || '')
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.withConfig]  only forms that have a field config
 * @param {string}  [opts.spec]        a spec file other than the packet's
 * @returns {string[]} PDF basenames, in the order the packet lists them
 */
function packetForms(opts) {
  const options = opts || {};
  try {
    const spec = JSON.parse(fs.readFileSync(options.spec || SPEC, 'utf8'));
    const bases = (spec.forms || []).map(baseOf).filter(Boolean)
      .filter((b) => !options.withConfig
        || fs.existsSync(path.join(CONFIG_DIR, b + '-field-config.json')));
    if (bases.length) return bases;
  } catch (err) { /* no spec here - fall back to what is on disk */ }

  // No spec to read: every form that has a field config is the best guess
  // available, and a better one than a pattern over filenames.
  try {
    return fs.readdirSync(CONFIG_DIR)
      .filter((f) => /-field-config\.json$/.test(f))
      .map((f) => f.replace(/-field-config\.json$/, ''))
      .sort();
  } catch (err) { return []; }
}

module.exports = { packetForms, baseOf };
