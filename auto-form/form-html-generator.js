const fs = require('fs');
const path = require('path');
const { fetchOpenAiWithRetry } = require('./openai-fetch');
const { saveCurrentData } = require('./auto-form-current-data');
const {
  resolvePdfPageImages,
  buildPdfVisionUserContent,
} = require('./pdf-vision-context');

const FORM_HTML_PROMPT_PATH = path.join(
  __dirname,
  'public',
  'Auto-Form-Creator',
  'form_html.txt'
);

function loadFormHtmlPrompt() {
  return fs.readFileSync(FORM_HTML_PROMPT_PATH, 'utf8');
}

function extractJsonFromModelResponse(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function extractHtmlFromModelResponse(text) {
  const trimmed = String(text || '').trim();
  try {
    const parsed = extractJsonFromModelResponse(trimmed);
    if (parsed?.html) return String(parsed.html);
  } catch (_) {
    // fall through
  }

  const htmlFence = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (htmlFence) return htmlFence[1].trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) return trimmed;
  throw new Error('Model did not return HTML');
}

async function callOpenAiForFormHtml(openAiApiKey, payload, pageImages = []) {
  const systemPrompt = loadFormHtmlPrompt();
  const userContent = buildPdfVisionUserContent(
    JSON.stringify(payload, null, 2),
    pageImages
  );

  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API request failed (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return extractHtmlFromModelResponse(content);
}

async function generateFormHtml(payload, openAiApiKey) {
  const {
    formConfig,
    fieldConfig = null,
    extractedDocumentContent = '',
    userProfile = {},
    pdfToken = '',
    pdfBase64 = '',
    htmlMode = 'normal',
    firebaseConfig = null,
  } = payload;

  if (!formConfig?.sections?.length) {
    throw new Error('formConfig.sections is required');
  }

  const pageImages = await resolvePdfPageImages(
    { pdfToken, pdfBase64 },
    { required: true, logPrefix: '[generate-form-html]' }
  );

  const promptPayload = {
    formConfig,
    fieldConfig,
    extractedDocumentContent,
    userProfile,
    htmlMode,
    pdfToken,
    firebaseConfig: firebaseConfig
      ? { projectId: firebaseConfig.projectId, apiKey: firebaseConfig.apiKey ? '[provided]' : undefined }
      : null,
  };

  return callOpenAiForFormHtml(openAiApiKey, promptPayload, pageImages);
}

function createHandleGenerateFormHtml(openAiApiKey) {
  return async function handleGenerateFormHtml(req, res) {
    try {
      const {
        formConfig,
        fieldConfig = null,
        extractedDocumentContent = '',
        userProfile = {},
        pdfToken = '',
        pdfBase64 = '',
        htmlMode = 'normal',
        firebaseConfig = null,
      } = req.body || {};

      const html = await generateFormHtml(
        {
          formConfig,
          fieldConfig,
          extractedDocumentContent,
          userProfile,
          pdfToken,
          pdfBase64,
          htmlMode,
          firebaseConfig,
        },
        openAiApiKey
      );

      res.json({ success: true, html });

      try {
        saveCurrentData({
          label: 'step-8-generated-html',
          formConfig,
          fieldConfig,
          formHtml: html,
        });
      } catch (dumpErr) {
        console.warn('[generate-form-html] Current data dump failed:', dumpErr.message);
      }
    } catch (error) {
      console.error('[generate-form-html] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate form HTML',
      });
    }
  };
}

module.exports = {
  generateFormHtml,
  createHandleGenerateFormHtml,
  extractHtmlFromModelResponse,
};
