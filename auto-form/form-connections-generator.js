const fs = require('fs');
const path = require('path');
const { fetchOpenAiWithRetry } = require('./openai-fetch');

const PROMPT_PATH = path.join(__dirname, 'public', 'Auto-Form-Creator', 'form_connections.txt');
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || process.env.FORM_CONNECTIONS_MODEL || 'claude-sonnet-4-6';

function loadSystemPrompt() {
  try {
    return fs.readFileSync(PROMPT_PATH, 'utf8');
  } catch (err) {
    throw new Error(`Missing form_connections prompt at ${PROMPT_PATH}: ${err.message}`);
  }
}

function summarizePayload(entry = {}) {
  const fields = Array.isArray(entry.fields)
    ? entry.fields
    : (Array.isArray(entry.fieldConfig?.fields) ? entry.fieldConfig.fields : []);

  return {
    name: entry.name || 'unnamed',
    pdfFileName: entry.pdfFileName || `${entry.name || 'form'}.pdf`,
    formTitle: entry.formTitle || entry.fieldConfig?.formTitle || entry.name || 'Untitled form',
    fields: fields.map((field) => ({
      id: field.id || null,
      newName: field.newName || null,
      type: field.type || null,
      label: field.label || null,
      conditional: field.conditional || undefined,
    })),
  };
}

function buildManualPrompt(payloads = []) {
  const system = loadSystemPrompt();
  const summarized = payloads.map(summarizePayload);
  return `${system.trim()}

================================================================================
PAYLOADS TO CONNECT
================================================================================

${JSON.stringify(summarized, null, 2)}

================================================================================
YOUR RESPONSE
================================================================================

Return ONLY the form_connections.txt plain-text contents now.`;
}

function stripFence(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/^```(?:\w+)?\s*([\s\S]*?)```$/);
  return (fenced ? fenced[1] : raw).trim();
}

async function generateFormConnectionsText(payloads, apiKey) {
  if (!Array.isArray(payloads) || payloads.length < 2) {
    throw new Error('At least two payloads are required to generate form connections.');
  }

  const systemPrompt = loadSystemPrompt();
  const summarized = payloads.map(summarizePayload);
  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create form_connections.txt for these payloads:\n\n${JSON.stringify(summarized, null, 2)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Form connections AI request failed (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI returned an empty form_connections response');
  return stripFence(content);
}

function createHandleGenerateFormConnections(apiKey) {
  return async function handleGenerateFormConnections(req, res) {
    try {
      const payloads = req.body?.payloads;
      if (!Array.isArray(payloads) || payloads.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'payloads must be an array with at least two entries',
        });
      }

      const text = await generateFormConnectionsText(payloads, apiKey);
      return res.json({
        success: true,
        formConnectionsText: text,
        fileName: 'form_connections.txt',
      });
    } catch (error) {
      console.error('[generate-form-connections]', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate form connections',
      });
    }
  };
}

function createHandleFormConnectionsPrompt() {
  return function handleFormConnectionsPrompt(req, res) {
    try {
      const payloads = req.body?.payloads;
      if (!Array.isArray(payloads) || payloads.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'payloads must be an array with at least two entries',
        });
      }
      return res.json({
        success: true,
        prompt: buildManualPrompt(payloads),
        fileName: 'form_connections.txt',
      });
    } catch (error) {
      console.error('[form-connections-prompt]', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to build form connections prompt',
      });
    }
  };
}

module.exports = {
  createHandleGenerateFormConnections,
  createHandleFormConnectionsPrompt,
  buildManualPrompt,
  generateFormConnectionsText,
};
