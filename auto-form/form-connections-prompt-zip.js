/**
 * Packages what a chat session needs to write form_connections.json by hand.
 *
 * Unlike the field-config bundle this carries no page images: connections are
 * inferred from field names, labels and conditionals, which are all text. The
 * per-form field lists are split into their own files so a session can be
 * pointed at one form at a time when the combined prompt runs long.
 */

const JSZip = require('jszip');
const { buildManualPrompt, summarizePayload } = require('./form-connections-generator');

function safeFileName(name) {
  return String(name || 'form')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'form';
}

function buildReadme(summaries) {
  const roster = summaries
    .map((p, i) => `${i + 1}. ${p.name} (${p.pdfFileName}) - ${p.fields.length} fields`)
    .join('\n');

  return [
    '# form_connections.json - manual run',
    '',
    `Forms in this packet: ${summaries.length}`,
    '',
    roster,
    '',
    '## What is in here',
    '',
    '- `PROMPT.md` - the exact prompt the automatic run would send. Paste it in full.',
    '- `payloads.json` - every form and its fields, exactly as the prompt embeds them.',
    '- `forms/` - the same field lists split one file per form, for reference.',
    '',
    '## How to run it',
    '',
    '1. Start a new chat session.',
    '2. Paste the whole contents of `PROMPT.md` as your message.',
    '3. The reply should be one JSON object and nothing else.',
    '4. Paste that JSON into the demo under **Paste AI response**, then Save.',
    '',
    '## What the answer has to get right',
    '',
    'Every `field` value must be copied verbatim from the payloads - these are the',
    'newName strings the packet wiring looks up later, so an approximation is worse',
    'than an honest `openQuestions` entry. Conditions the model inferred rather than',
    'read off a label belong in `when` with `"assumed": true`.',
    '',
    '## If the save is rejected',
    '',
    'The demo parses the reply as JSON before accepting it. A rejection almost always',
    'means the reply was truncated or wrapped in prose - ask the session to resend the',
    'object on its own. Stray backslashes in field names are repaired automatically.',
    '',
  ].join('\n');
}

async function buildFormConnectionsPromptZip(payloads) {
  if (!Array.isArray(payloads) || payloads.length < 2) {
    throw new Error('At least two payloads are required to build a form connections bundle.');
  }

  const summaries = payloads.map(summarizePayload);
  const zip = new JSZip();

  zip.file('README.md', buildReadme(summaries));
  zip.file('PROMPT.md', buildManualPrompt(payloads));
  zip.file('payloads.json', JSON.stringify(summaries, null, 2));

  const formsFolder = zip.folder('forms');
  summaries.forEach((summary, index) => {
    const name = `${String(index + 1).padStart(2, '0')}-${safeFileName(summary.name)}.json`;
    formsFolder.file(name, JSON.stringify(summary, null, 2));
  });

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { buffer, formCount: summaries.length };
}

// Builds a bundle only. Nothing here contacts an API, so it needs no approval
// and costs nothing.
function createHandleFormConnectionsPromptZip() {
  return async function handleFormConnectionsPromptZip(req, res) {
    try {
      const { buffer, formCount } = await buildFormConnectionsPromptZip(req.body && req.body.payloads);

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="form-connections-prompt.zip"',
        'X-Form-Count': String(formCount),
      });
      return res.send(buffer);
    } catch (error) {
      console.error('[form-connections-prompt-zip]', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to build the form connections bundle',
      });
    }
  };
}

module.exports = { buildFormConnectionsPromptZip, createHandleFormConnectionsPromptZip };
