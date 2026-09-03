const { inferFieldDomain, getDomainWording } = require('./field-domain');
const { fetchOpenAiWithRetry } = require('./openai-fetch');
const {
  resolvePdfPageImages,
  buildPdfVisionUserContent,
} = require('./pdf-vision-context');

const SYSTEM_PROMPT = `You are a helpful legal and government-form assistant embedded in FormStar.

Your job is to help users understand form questions and determine correct answers using ALL of the context provided:
- fieldConfig: official PDF field labels, types, and semantic names (newName) mapped to PDF field ids
- extractedDocumentContent: text extracted from the actual government PDF showing how fields appear on paper
- pdfDocumentSnippets: highlighted excerpts from the PDF layout around the active question's field marker(s)
- formConfig: the full online form structure (sections, questions, options)
- formPosition: where the user is in the online form (section name, question number)
- currentAnswers: values already entered on the form
- activeQuestionFieldMappings: how the active question maps to PDF fields and official labels
- PDF page images: every page of the form PDF is attached to this request — use them for layout and label context

CRITICAL RULES FOR SPECIFIC, NON-GENERIC ANSWERS:
1. ALWAYS use the official label from fieldConfig (and surrounding PDF text in pdfDocumentSnippets) when explaining a field. Never substitute vague terms like "unique identification number" when the PDF says "OCA Number", "ATI Number", "ORI", etc.
2. Read pdfDocumentSnippets and extractedDocumentContent for neighboring labels, instructions, and legal notes that apply to the active question.
3. Explain WHERE on the paper form the field appears and HOW the user can find the value (e.g., on a prior receipt, from the live-scan operator, on a rejection notice).
4. Reference the online form question text AND the official PDF label when they differ (e.g., online "Your Number" vs PDF "OCA Number (Agency Identifying Number)").
5. Use fieldDomain and whoseInformation from activeQuestionFieldMappings to clarify whether the user should enter agency, employer, or personal applicant information.
6. Use other currentAnswers when they inform this question.
7. Ask clarifying questions only when genuinely needed.

Autofill guidelines:
- For checkbox questions with multiple options (each option may have its own nameId), specify which option(s) to check.
- For dropdown questions, use an exact option value from the provided options list when possible.
- For multipleTextboxes questions, return an array of { nameId, value } for each sub-field.
- For date fields, use ISO format YYYY-MM-DD.
- Only suggest autofill when confident. When confident, set suggestAutofill to true and ask: "Would you like me to autofill this answer?"
- When not confident enough, set suggestAutofill to false and autofill to null.

You MUST respond with valid JSON only (no markdown fences) using this exact schema:
{
  "reply": "string — your message to the user",
  "suggestAutofill": boolean,
  "autofill": null | { "nameId": "string", "value": "string" } | { "nameId": "string", "checked": boolean } | [ { "nameId": "string", "value": "string" } | { "nameId": "string", "checked": boolean }, ... ]
}

Autofill nameId values MUST match the question's nameId, checkbox option nameId, or textbox nameId from the form config.`;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFieldConfigByName(fieldConfig) {
  const map = new Map();
  for (const field of fieldConfig?.fields || []) {
    if (field?.newName) map.set(field.newName, field);
  }
  return map;
}

function collectQuestionNameIds(question) {
  const ids = [];
  if (question?.nameId) ids.push(question.nameId);
  for (const opt of question?.options || []) {
    if (opt?.nameId) ids.push(opt.nameId);
  }
  for (const tb of question?.textboxes || []) {
    if (tb?.nameId) ids.push(tb.nameId);
  }
  return [...new Set(ids)];
}

function resolveQuestionFieldMappings(question, fieldConfig) {
  const byName = buildFieldConfigByName(fieldConfig);
  return collectQuestionNameIds(question).map((nameId) => {
    const field = byName.get(nameId);
    const domain = field ? inferFieldDomain(field) : null;
    const wording = domain ? getDomainWording(domain) : null;
    return {
      nameId,
      newName: field?.newName || nameId,
      label: field?.label || null,
      type: field?.type || question?.type || 'text',
      pdfFieldId: field?.id || null,
      fieldDomain: domain,
      whoseInformation: wording?.subject || null,
      pdfSection: wording?.pdfSection || null,
    };
  });
}

function locateQuestionInForm(question, formConfig) {
  const sections = formConfig?.sections || [];
  let globalQuestionNumber = 0;
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    const questions = section?.questions || [];
    for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
      globalQuestionNumber += 1;
      if (questions[questionIndex]?.questionId === question?.questionId) {
        return {
          sectionIndex: sectionIndex + 1,
          sectionName: section?.sectionName || `Section ${sectionIndex + 1}`,
          questionIndexInSection: questionIndex + 1,
          totalQuestionsInSection: questions.length,
          globalQuestionNumber,
          totalSections: sections.length,
        };
      }
    }
  }
  return null;
}

function extractPdfSnippetsForFieldIds(extractedDocumentContent, fieldIds, contextRadius = 450) {
  const content = String(extractedDocumentContent || '');
  if (!content || !fieldIds?.length) return [];

  const snippets = [];
  const seen = new Set();

  for (const fieldId of fieldIds) {
    if (!fieldId) continue;
    const markerPattern = new RegExp(
      `(?:\\[\\[${escapeRegExp(fieldId)}\\]\\]|\\{\\{${escapeRegExp(fieldId)}\\}\\})`,
      'g'
    );
    let match;
    while ((match = markerPattern.exec(content)) !== null) {
      const start = Math.max(0, match.index - contextRadius);
      const end = Math.min(content.length, match.index + match[0].length + contextRadius);
      const snippet = content.slice(start, end).trim();
      const key = `${fieldId}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push({
        pdfFieldId: fieldId,
        marker: match[0],
        snippet,
        positionInDocument: match.index,
      });
    }
  }

  snippets.sort((a, b) => a.positionInDocument - b.positionInDocument);
  return snippets;
}

function buildUserContextPayload(body) {
  const {
    question,
    formConfig,
    fieldConfig,
    extractedDocumentContent,
    currentAnswers,
    chatHistory,
    userMessage,
    pdfPageImages,
  } = body || {};

  const fieldMappings = resolveQuestionFieldMappings(question, fieldConfig);
  const pdfFieldIds = fieldMappings.map((m) => m.pdfFieldId).filter(Boolean);
  const pdfDocumentSnippets = extractPdfSnippetsForFieldIds(extractedDocumentContent, pdfFieldIds);
  const formPosition = locateQuestionInForm(question, formConfig);

  return {
    activeQuestion: question || null,
    activeQuestionFieldMappings: fieldMappings,
    formPosition,
    formTitle: formConfig?.formTitle || fieldConfig?.formTitle || '',
    displayMode: formConfig?.displayMode || 'all_at_once',
    sections: formConfig?.sections || [],
    fieldConfig: fieldConfig || null,
    extractedDocumentContent: extractedDocumentContent || '',
    pdfDocumentSnippets,
    currentAnswers: currentAnswers || {},
    conversationHistory: Array.isArray(chatHistory) ? chatHistory : [],
    userMessage: userMessage || '',
    pdfPageImagesIncluded: Array.isArray(pdfPageImages) ? pdfPageImages.length : 0,
  };
}

function parseModelJson(content) {
  const trimmed = String(content || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function normalizeAutofill(autofill) {
  if (autofill == null) return null;
  if (Array.isArray(autofill)) {
    const items = autofill.filter((item) => item && item.nameId);
    return items.length ? items : null;
  }
  if (typeof autofill === 'object' && autofill.nameId) return autofill;
  return null;
}

function buildUserMessageContent(contextPayload, pdfPageImages) {
  return buildPdfVisionUserContent(
    `Form context and conversation:\n${JSON.stringify(contextPayload, null, 2)}`,
    pdfPageImages
  );
}

function createHandleHelpAnswer(openAiApiKey) {
  return async function handleHelpAnswer(req, res) {
    try {
      const {
        question,
        formConfig,
        fieldConfig,
        extractedDocumentContent,
        pdfToken,
        userMessage,
      } = req.body || {};

      if (!question || question.questionId == null) {
        return res.status(400).json({ success: false, error: 'question with questionId is required' });
      }
      if (!formConfig || !Array.isArray(formConfig.sections)) {
        return res.status(400).json({ success: false, error: 'formConfig with sections is required' });
      }
      if (!userMessage || !String(userMessage).trim()) {
        return res.status(400).json({ success: false, error: 'userMessage is required' });
      }

      const pdfPageImages = await resolvePdfPageImages(
        { pdfToken },
        { required: true, logPrefix: '[help-answer]' }
      );
      const contextPayload = buildUserContextPayload({
        ...req.body,
        pdfPageImages,
      });
      const userContent = buildUserMessageContent(contextPayload, pdfPageImages);

      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ];

      const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.3,
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

      let parsed;
      try {
        parsed = parseModelJson(content);
      } catch (parseErr) {
        console.warn('[help-answer] JSON parse failed, using raw text:', parseErr.message);
        parsed = { reply: content, suggestAutofill: false, autofill: null };
      }

      const reply = String(parsed.reply || parsed.message || '').trim() || 'I am sorry, I could not generate a response. Please try again.';
      const suggestAutofill = Boolean(parsed.suggestAutofill);
      const autofill = suggestAutofill ? normalizeAutofill(parsed.autofill) : null;

      res.json({
        success: true,
        reply,
        suggestAutofill: suggestAutofill && autofill != null,
        autofill,
      });
    } catch (error) {
      console.error('[help-answer] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get help answer',
      });
    }
  };
}

module.exports = {
  createHandleHelpAnswer,
  buildUserContextPayload,
  resolveQuestionFieldMappings,
  extractPdfSnippetsForFieldIds,
};
