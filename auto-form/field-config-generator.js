const fs = require('fs');
const path = require('path');
const { fetchOpenAiWithRetry } = require('./openai-fetch');
const { saveCurrentData } = require('./auto-form-current-data');
const {
  resolvePdfPageImages,
  buildPdfVisionUserContent,
} = require('./pdf-vision-context');

const FIELD_CONFIG_PROMPT_PATH = path.join(
  __dirname,
  'public',
  'Auto-Form-Creator',
  'field_config.txt'
);

function loadFieldConfigPrompt() {
  return fs.readFileSync(FIELD_CONFIG_PROMPT_PATH, 'utf8');
}

function extractJsonFromModelResponse(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function dedupeFieldsByName(fields) {
  const seen = new Set();
  const out = [];
  for (const field of fields || []) {
    const name = typeof field === 'string' ? field : field?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(typeof field === 'string' ? field : field);
  }
  return out;
}

function dedupeStructuredFieldsById(fields) {
  const seen = new Set();
  const out = [];
  for (const field of fields || []) {
    const id = field?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(field);
  }
  return out;
}

function validateFieldConfig(config, inputFieldIds) {
  if (!config || typeof config !== 'object') {
    throw new Error('Model response is not a JSON object');
  }
  if (!Array.isArray(config.fields)) {
    throw new Error('field_config.json must contain a "fields" array');
  }

  const seenNewNames = new Map(); // newName -> id
  const mappedIds = new Map(); // id -> newName
  const normalizedFields = [];

  for (const field of config.fields) {
    if (!field || typeof field !== 'object') {
      throw new Error('Each field entry must be an object');
    }
    if (!field.id || !field.newName || !field.type || !field.label) {
      throw new Error('Each field must include id, newName, type, and label');
    }
    if (!['text', 'checkbox', 'dropdown'].includes(field.type)) {
      throw new Error(`Invalid field type for ${field.id}: ${field.type}`);
    }

    // Same AcroForm name can appear on the PDF multiple times (shared fill value).
    // Keep the first mapping; reject only when the same id is remapped differently.
    if (mappedIds.has(field.id)) {
      if (mappedIds.get(field.id) !== field.newName) {
        throw new Error(
          `Conflicting mappings for field id "${field.id}": ` +
          `"${mappedIds.get(field.id)}" vs "${field.newName}"`
        );
      }
      continue;
    }

    // Different PDF fields must not collapse onto the same newName.
    if (seenNewNames.has(field.newName) && seenNewNames.get(field.newName) !== field.id) {
      throw new Error(
        `Duplicate newName "${field.newName}" used by "${seenNewNames.get(field.newName)}" and "${field.id}"`
      );
    }

    seenNewNames.set(field.newName, field.id);
    mappedIds.set(field.id, field.newName);
    normalizedFields.push(field);
  }

  const uniqueInputIds = [...new Set(inputFieldIds.filter(Boolean))];
  const missing = uniqueInputIds.filter((id) => !mappedIds.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.length} field(s) in model output, e.g. ${missing[0]}`);
  }

  return {
    ...config,
    fields: normalizedFields,
  };
}

async function callOpenAiForFieldConfig(openAiApiKey, extractionPayload, pageImages = []) {
  const systemPrompt = loadFieldConfigPrompt();
  const userContent = buildPdfVisionUserContent(
    JSON.stringify(extractionPayload, null, 2),
    pageImages
  );

  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
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

  return extractJsonFromModelResponse(content);
}

async function generateFieldConfig(extractionPayload, openAiApiKey) {
  // Widgets that share an AcroForm name are the same fill target — ask the model once.
  const textFields = dedupeFieldsByName(extractionPayload.textFields || []);
  const checkboxFields = dedupeFieldsByName(extractionPayload.checkboxFields || []);
  const structuredFields = dedupeStructuredFieldsById(extractionPayload.structuredFields || []);

  const textFieldIds = textFields.map((f) => (typeof f === 'string' ? f : f.name));
  const checkboxFieldIds = checkboxFields.map((f) => (typeof f === 'string' ? f : f.name));
  const inputFieldIds = [...textFieldIds, ...checkboxFieldIds];

  if (!inputFieldIds.length) {
    throw new Error('No text or checkbox fields provided for field config generation');
  }

  const promptPayload = {
    extractedDocumentContent: extractionPayload.extractedDocumentContent || '',
    textFields,
    checkboxFields,
    structuredFields: structuredFields.map((sf) => ({
      id: sf.id,
      type: sf.type,
      page: sf.page,
    })),
    requiredFieldCount: inputFieldIds.length,
    requiredTextFieldCount: textFieldIds.length,
    requiredCheckboxFieldCount: checkboxFieldIds.length,
    note:
      'If the PDF shows the same AcroForm field name more than once, include it only once. ' +
      'All widgets with that name are filled with the same value.',
  };

  const pageImages = await resolvePdfPageImages(
    {
      pdfToken: extractionPayload.pdfToken,
      pdfBase64: extractionPayload.pdfBase64,
    },
    { required: true, logPrefix: '[generate-field-config]' }
  );

  const config = await callOpenAiForFieldConfig(openAiApiKey, promptPayload, pageImages);
  return validateFieldConfig(config, inputFieldIds);
}

function createHandleGenerateFieldConfig(openAiApiKey) {
  return async function handleGenerateFieldConfig(req, res) {
    try {
      const {
        extractedDocumentContent = '',
        textFields = [],
        checkboxFields = [],
        structuredFields = [],
        pdfToken = '',
        pdfBase64 = '',
      } = req.body || {};

      const config = await generateFieldConfig(
        {
          extractedDocumentContent,
          textFields,
          checkboxFields,
          structuredFields,
          pdfToken,
          pdfBase64,
        },
        openAiApiKey
      );

      res.json({
        success: true,
        fieldConfig: config,
        fieldCount: config.fields.length,
      });

      try {
        saveCurrentData({
          label: 'step-4-field-config',
          fieldConfig: config,
          extractedDocumentContent,
          textFields,
          checkboxFields,
          structuredFields,
        });
      } catch (dumpErr) {
        console.warn('[generate-field-config] Current data dump failed:', dumpErr.message);
      }
    } catch (error) {
      console.error('[generate-field-config] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate field config',
      });
    }
  };
}

module.exports = {
  generateFieldConfig,
  createHandleGenerateFieldConfig,
  validateFieldConfig,
};
