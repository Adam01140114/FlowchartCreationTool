const fs = require('fs');
const path = require('path');
const { fetchOpenAiWithRetry } = require('./openai-fetch');
const { extractJsonFromModelResponse } = require('./model-json');
const { enrichFormConfigAutopopulate, isLikelyAutopopulatableField } = require('./form-autopopulate');
const { ensureFormCatalogMetadata } = require('./form-catalog-metadata');
const { applyLinkedFields } = require('./form-linked-fields');
const { saveCurrentData } = require('./auto-form-current-data');

const { buildFormConfigSkeleton } = require('./form-config-skeleton');
const {
  resolvePdfPageImages,
  buildPdfVisionUserContent,
} = require('./pdf-vision-context');
const formQuestionText = require('./form-question-text');
const { buildStructuredFieldMap, enrichFieldConfig } = require('./structured-field-context');
const { inferFieldDomain } = require('./field-domain');
const {
  trustedStructuredContext,
  validateQuestionTextQuality,
  qualityFailuresToReviewIssues,
} = require('./form-config-quality');

const DEFAULT_CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const FORM_CONFIG_MODEL = process.env.FORM_CONFIG_MODEL || DEFAULT_CLAUDE_MODEL;
const FORM_CONFIG_POLISH_MODEL = process.env.FORM_CONFIG_POLISH_MODEL || DEFAULT_CLAUDE_MODEL;
const FORM_CONFIG_REVIEW_MODEL = process.env.FORM_CONFIG_REVIEW_MODEL || DEFAULT_CLAUDE_MODEL;
const FORM_CONFIG_SKIP_REVIEW = /^(1|true|yes)$/i.test(String(process.env.FORM_CONFIG_SKIP_REVIEW || ''));

const POLISH_SECTION_PROMPT = `You improve ONLY the "explanation" field on survey questions for government/legal forms.

Structure is FINAL — do NOT change sectionName, question text, types, nameIds, options, logic, or textboxes.

You receive PDF page images for context. Write clear explanations that state WHOSE information is being collected:
- Agency fields → the contributing agency (not the applicant's personal info)
- Applicant fields → the person applying
- Employer fields → the employer (not the applicant's home address)

Each explanation must be at least one full sentence (minimum 12 words) and disambiguate common confusion (e.g. agency address vs home address).

Return ONLY the section JSON object with updated explanations.`;

const FORM_CONFIG_REVIEW_PROMPT = `You are a strict UX + mapping reviewer for Auto Form Creator.

You receive:
1) field_config (each entry is ONE real PDF widget with newName/label/type)
2) a generated form_config (online questions mapped to those widgets)
3) PDF page images (USE THESE — printed labels often show concepts that are not separate AcroForm widgets)

Your job: find problems a first-time user or engineer would catch. Be specific and actionable.
You are the safety net after the author model. Prefer severity "error" for clear defects
visible on the PDF or broken mapping — do not rubber-stamp incomplete address UX.

HARD CONSTRAINTS (do NOT violate):
- You may NOT invent PDF fields / new nameIds. If field_config has one widget for
  "First name and middle initial", keeping ONE question for that nameId OR splitting into
  UI-only parts that pdfCombineInto that SAME nameId is CORRECT.
- Every field_config.newName must remain covered exactly once.
- Do not recommend dropping required fields.

LOOK FOR (and report as issues):
- Awkward / instruction-like / duplicate / vague question text
- Separate field_config entries wrongly merged into one question (when each has its own newName)
- Address blocks: compare PDF printed labels to the online multipleTextboxes.
  ERROR if the PDF shows State (or "State ZIP") but the online question has no State control.
  Fix: add State textbox with nameId null, pdfCombineInto = family's zip newName,
  combinePart "state", combineOrder 0; ZIP keeps nameId on the zip widget.
  ERROR if State has no nameId AND no pdfCombineInto — that is a dead field that never
  writes to the PDF (no "UI-only" State).
  ERROR if State has a fake nameId not in field_config.
- ERROR if a UI-only pdfCombineInto target is unrelated (e.g. priority → account_id).
  VALID: middle_initial → first_name_and_middle_initial.
  VALID: State → agency_zip_code when PDF prints State but AcroForm only has the zip widget.
- Checkbox groups that should be one question with options, but were split into many questions
- Missing or vague conditional gates; follow-ups that should be gated on a checkbox option
- Presence-optional identity facts shown unconditionally (business/disregarded entity name, DBA,
  spouse/dependent names, aliases) — these MUST sit behind a Yes/No "Do you have…?" gate
- Duplicate section titles (every sectionName must be unique and distinct — never three
  "Applicant Information" steppers)
- Wrong WHO ownership (agency vs applicant vs employer)
- Section titles that are vague ("Additional", "Other") or too long
- Explanations that are empty, fragments, or copy the question
- pdfCombineInto misused for unrelated fields (only allowed when splitting one real PDF widget
  into semantic UI parts that merge back into that same widget)

Return ONLY JSON:
{
  "ok": boolean,
  "summary": "1-2 sentence verdict",
  "issues": [
    {
      "severity": "error" | "warning",
      "category": "wording|grouping|mapping|conditional|section|explanation|other",
      "questionId": number | null,
      "nameId": string | null,
      "message": "what is wrong",
      "suggestion": "how to fix without inventing PDF fields"
    }
  ]
}

If the form is already strong, return ok:true and issues:[]. Prefer warnings for taste; errors for clear defects.`;

const FORM_CONFIG_REVISE_PROMPT = `You are the form_config author receiving peer review feedback.

Revise the form_config to address EVERY error and as many warnings as practical.

HARD RULES:
- Keep EVERY field_config.newName covered exactly once (question.nameId, options[].nameId, or textboxes[].nameId).
- NEVER invent new field_config nameIds.
- When PDF prints State but only a zip widget exists: State textbox must use
  pdfCombineInto on that zip newName (combinePart "state") so it writes to the PDF.
  Never leave State with no nameId and no pdfCombineInto.
- If a single PDF widget combines concepts, split into UI parts that pdfCombineInto that SAME nameId.
- Every pdfCombineInto target must exist in field_config. Never merge two distinct PDF fields.
- Preserve valid multipleTextboxes address blocks and checkbox groups.
- Improve question text clarity; put jargon in explanations.
- Return the FULL revised form_config JSON object (same schema as input), not a patch.
- Include needsExplanation=true and a solid explanation on every question.

You receive the original form_config, field_config, requiredNameIds, and the reviewer's issues list.
Return ONLY the revised form_config JSON.`;

const FORM_CONFIG_PROMPT_PATH = path.join(
  __dirname,
  'public',
  'Auto-Form-Creator',
  'form_config.txt'
);

function loadFormConfigPrompt() {
  return fs.readFileSync(FORM_CONFIG_PROMPT_PATH, 'utf8');
}

function collectNameIdsFromQuestion(question, ids) {
  if (question.nameId) ids.add(question.nameId);
  if (Array.isArray(question.options)) {
    for (const opt of question.options) {
      if (opt && opt.nameId) ids.add(opt.nameId);
    }
  }
  if (Array.isArray(question.textboxes)) {
    for (const tb of question.textboxes) {
      if (tb && tb.nameId) ids.add(tb.nameId);
    }
  }
}

function getMissingNameIds(formConfig, fieldConfig) {
  const requiredNewNames = new Set((fieldConfig.fields || []).map((f) => f.newName));
  const covered = new Set();

  for (const section of formConfig.sections || []) {
    for (const question of section.questions || []) {
      collectNameIdsFromQuestion(question, covered);
    }
  }

  for (const hidden of formConfig.hiddenFields || []) {
    if (hidden?.nameId) covered.add(hidden.nameId);
  }

  return [...requiredNewNames].filter((name) => !covered.has(name));
}

function fieldConfigEntriesForNames(fieldConfig, names) {
  const wanted = new Set(names);
  return (fieldConfig?.fields || []).filter((f) => wanted.has(f.newName));
}

function buildMissingFieldsRetryInstruction(missing, fieldConfig, totalCount) {
  const details = fieldConfigEntriesForNames(fieldConfig, missing).map((f) => ({
    newName: f.newName,
    type: f.type,
    label: f.label,
    conditional: f.conditional || null,
  }));

  return [
    `Your previous response omitted ${missing.length} required nameId(s).`,
    `Each MUST appear exactly once (question.nameId, textboxes[].nameId, or options[].nameId).`,
    `Missing field_config entries: ${JSON.stringify(details, null, 2)}`,
    `Return a corrected complete form_config.json covering ALL ${totalCount} fields.`,
    `Do NOT skip small auxiliary text boxes (e.g. LLC tax classification code, "specify other" lines) — they are separate fields even when beside checkbox groups.`,
  ].join('\n');
}

function buildPatchFormConfigInstruction(formConfig, missing, fieldConfig) {
  const details = fieldConfigEntriesForNames(fieldConfig, missing);
  const slimConfig = {
    formTitle: formConfig.formTitle,
    displayMode: formConfig.displayMode,
    sections: formConfig.sections,
    sectionCounter: formConfig.sectionCounter,
    questionCounter: formConfig.questionCounter,
  };

  return [
    `PATCH MODE: Merge missing fields into the existing form_config below.`,
    `Add one question per missing field. Keep all existing questions unchanged except renumber questionId if needed.`,
    `Missing fields to add: ${JSON.stringify(details, null, 2)}`,
    `Existing form_config (extend this — do not replace unrelated content):`,
    JSON.stringify(slimConfig, null, 2),
  ].join('\n\n');
}

const FIELD_ACRONYMS = new Set(['ati', 'oca', 'ori', 'doj', 'fbi', 'ssn', 'zip', 'cdl']);

const VAGUE_LABELS = new Set([
  'number', 'your number', 'code', 'your code', 'id', 'your id',
  'misc number', 'misc. number', 'identifier',
]);

const VAGUE_QUESTION_PATTERNS = [
  /^what is your (a |an )?number\??$/i,
  /^what is the (a |an )?number\??$/i,
  /^what is your (a |an )?code\??$/i,
  /^what is the (a |an )?code\??$/i,
  /^what is your (a |an )?id\??$/i,
  /^what is the (a |an )?id\??$/i,
  /^what is your ori\b/i,
  /^what is your your /i,
];

const CONDITIONAL_NAME_PATTERNS = [
  /original/i,
  /prior_/i,
  /previous_/i,
  /resubmi/i,
  /re_submi/i,
  /replacement/i,
  /^if_/i,
];

const ALIAS_FIELD_PATTERNS = [
  /other_(first|last|middle)_name/i,
  /\balias\b/i,
  /^aka_/i,
  /other_name/i,
];

const GARBAGE_LABEL_PATTERNS = [
  /page\s*\d+\s*of\s*\d+/gi,
  /state\s+of\s+[a-z]+/gi,
  /department\s+of\s+justice/gi,
  /request\s+for\s+live\s+scan/gi,
  /applicant\s+submission/gi,
  /\bpage\s*\d+\b/gi,
];

const AUTO_TODAY_DATE_PATTERNS = [
  /today.?s?.?date/i,
  /current.?date/i,
  /signature.?date/i,
  /date.?signed/i,
  /signing.?date/i,
  /date.?of.?signature/i,
];

function isGarbageText(text) {
  const normalized = String(text || '').trim();
  return !normalized
    || normalized.length > 80
    || /page\s*\d/i.test(normalized)
    || /department\s+of\s+justice/i.test(normalized)
    || /state\s+of\s+/i.test(normalized)
    || /request\s+for\s+/i.test(normalized);
}

function sanitizeFieldLabel(label, newName) {
  let text = String(label || '').trim();
  for (const pattern of GARBAGE_LABEL_PATTERNS) {
    text = text.replace(pattern, ' ');
  }
  text = text.replace(/\s+/g, ' ').trim();

  if (isGarbageText(text)) {
    const fallback = formatFieldNameAsLabel(newName);
    return fallback || text.slice(0, 80);
  }
  return text;
}

function formatFieldNameAsLabel(newName) {
  if (!newName) return '';
  return String(newName)
    .split('_')
    .filter(Boolean)
    .map((word) => (FIELD_ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : titleCaseWord(word)))
    .join(' ');
}

function isVagueLabel(label) {
  const normalized = String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return !normalized || VAGUE_LABELS.has(normalized);
}

function extractLabelFromDocument(field, extractedDocumentContent) {
  const doc = String(extractedDocumentContent || '');
  const fieldId = field?.id;
  if (!doc || !fieldId) return '';

  const marker = `[[${fieldId}]]`;
  const idx = doc.indexOf(marker);
  if (idx < 0) return '';

  const before = doc.slice(Math.max(0, idx - 80), idx);
  const lines = before.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || before.trim();
  const match = lastLine.match(/([A-Za-z][A-Za-z0-9\s.,\-/()]{1,48})$/);
  const raw = match ? match[1].trim().replace(/\s+/g, ' ') : '';
  return sanitizeFieldLabel(raw, field?.newName);
}

function resolveSpecificFieldLabel(field, extractedDocumentContent = '', structuredContext = null) {
  return formQuestionText.resolveSpecificFieldLabel(field, extractedDocumentContent, structuredContext);
}

function buildQuestionTextForField(field, extractedDocumentContent = '', structuredContext = null) {
  return formQuestionText.buildQuestionTextForField(field, extractedDocumentContent, structuredContext);
}

function isVagueQuestionText(text, field, extractedDocumentContent = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return true;
  if (VAGUE_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const specificLabel = resolveSpecificFieldLabel(field, extractedDocumentContent);
  if (!specificLabel || isVagueLabel(specificLabel)) return false;

  const keywords = specificLabel
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !['your', 'the', 'and', 'for'].includes(word));

  if (!keywords.length) return false;
  const textLower = normalized.toLowerCase();
  return !keywords.some((word) => textLower.includes(word));
}

function normalizeVagueQuestionText(formConfig, fieldConfig, extractedDocumentContent = '') {
  if (!formConfig?.sections) return formConfig;

  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));

  for (const section of formConfig.sections) {
    for (const question of section.questions || []) {
      const nameId = question.nameId
        || question.options?.[0]?.nameId
        || question.textboxes?.[0]?.nameId;
      const field = nameId ? fieldMap.get(nameId) : null;
      if (!field || question.type === 'checkbox') continue;

      question.text = String(question.text || '')
        .replace(/\byour\s+your\b/gi, 'your')
        .replace(/\s+/g, ' ')
        .trim();

      const questionTextIsGarbage = isGarbageText(question.text);
      const label = resolveSpecificFieldLabel(field, extractedDocumentContent);
      const labelIsGarbage = isGarbageText(label);

      if (labelIsGarbage || questionTextIsGarbage || isVagueQuestionText(question.text, field, extractedDocumentContent)) {
        question.text = buildQuestionTextForField(field, extractedDocumentContent, null);
      }
    }
  }

  return formConfig;
}

function inferConditionalGateQuestion(field) {
  const { inferSpecificGateQuestion } = require('./form-conditional-logic');
  return inferSpecificGateQuestion(field).replace(/\?$/, '');
}

function isAliasField(field, question) {
  const blob = `${field?.newName || ''} ${field?.label || ''} ${question?.text || ''}`;
  return ALIAS_FIELD_PATTERNS.some((pattern) => pattern.test(blob));
}

function isConditionalField(field, question) {
  const { isOptionalApplicabilityField, isPresenceOptionalField } = require('./form-conditional-logic');
  // Never assume the user has a business/entity/spouse/etc. — always gate these.
  if (isPresenceOptionalField(field, question)) return true;
  // Blankable "(if any)/(optional)" codes can stay ungated unless they are presence fields.
  if (isOptionalApplicabilityField(field)) return false;

  if (field?.conditional) return true;

  const label = String(field?.label || question?.text || '').trim();
  const name = String(field?.newName || '').trim();
  const blob = `${label} ${name}`;

  if (/^if\s+/i.test(label) || /^if\s+/i.test(String(question?.text || ''))) return true;
  if (/if different|differs from above/i.test(blob)) return true;
  return CONDITIONAL_NAME_PATTERNS.some((pattern) => pattern.test(blob));
}

let nextTempGateId = -1;

function createGateQuestion(gateText) {
  const questionId = nextTempGateId;
  nextTempGateId -= 1;
  return {
    questionId,
    text: gateText.endsWith('?') ? gateText : `${gateText}?`,
    needsExplanation: true,
    explanation: 'Answer Yes if the following question applies to you. Answer No to skip it.',
    type: 'dropdown',
    logic: { enabled: false, prevQuestion: '', prevAnswer: '' },
    jump: { enabled: false, option: '', to: '' },
    options: [
      { label: 'Yes', value: 'Yes' },
      { label: 'No', value: 'No' },
    ],
    labels: [],
    placeholder: '',
    autopopulate: { enabled: false },
  };
}

function renumberQuestions(formConfig) {
  if (!formConfig?.sections) return formConfig;

  const idMap = new Map();
  let nextId = 1;

  for (const section of formConfig.sections) {
    for (const question of section.questions || []) {
      idMap.set(question.questionId, nextId);
      question.questionId = nextId;
      nextId += 1;
    }
  }

  const remapId = (value) => {
    const parsed = parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed)) return value;
    return idMap.has(parsed) ? String(idMap.get(parsed)) : value;
  };

  for (const section of formConfig.sections) {
    for (const question of section.questions || []) {
      if (question.logic?.enabled && question.logic.prevQuestion) {
        question.logic.prevQuestion = remapId(question.logic.prevQuestion);
      }
      if (question.jump?.enabled && question.jump.to) {
        question.jump.to = remapId(question.jump.to);
      }
    }
  }

  if (Array.isArray(formConfig.linkedFieldGroups)) {
    for (const group of formConfig.linkedFieldGroups) {
      if (group.primaryQuestionId != null) {
        group.primaryQuestionId = idMap.get(group.primaryQuestionId) || group.primaryQuestionId;
      }
    }
  }

  formConfig.questionCounter = nextId;
  return formConfig;
}

function gateAlreadyPresent(questions, index) {
  if (index < 1) return false;
  const prev = questions[index - 1];
  return Boolean(prev && prev.type === 'dropdown' && !prev.nameId);
}

function findExistingGateQuestion(questions, pattern) {
  return (questions || []).find(
    (q) => q.type === 'dropdown' && !q.nameId && pattern.test(String(q.text || ''))
  );
}

function ensureConditionalGateQuestions(formConfig, fieldConfig) {
  if (!formConfig?.sections) return formConfig;

  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));
  let inserted = false;

  for (const section of formConfig.sections) {
    const questions = section.questions || [];
    let aliasGateQuestion = findExistingGateQuestion(questions, /alias/i);

    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i];
      if (!question.nameId || question.linkedFieldRole === 'mirror') continue;
      if (gateAlreadyPresent(questions, i)) {
        const prevGate = questions[i - 1];
        // Keep/repair wiring to the gate immediately before this question.
        if (!question.logic?.enabled || String(question.logic.prevQuestion) !== String(prevGate.questionId)) {
          question.logic = {
            enabled: true,
            prevQuestion: String(prevGate.questionId),
            prevAnswer: 'Yes',
          };
          inserted = true;
        }
        continue;
      }

      const field = fieldMap.get(question.nameId);

      if (isAliasField(field, question)) {
        const existingAliasGate = aliasGateQuestion || findExistingGateQuestion(questions, /alias/i);
        if (existingAliasGate) {
          aliasGateQuestion = existingAliasGate;
          if (!question.logic?.enabled) {
            question.logic = {
              enabled: true,
              prevQuestion: String(existingAliasGate.questionId),
              prevAnswer: 'Yes',
            };
          }
          continue;
        }

        question.text = buildQuestionTextForField(field);
        question.text = String(question.text || '')
          .replace(/^if\s+.+?,\s*(?:list|enter|provide)\s+/i, '')
          .replace(/^if\s+.+?,\s*/i, '')
          .trim()
          .replace(/^([a-z])/, (ch) => ch.toUpperCase());
        if (question.text && !question.text.endsWith('?')) {
          question.text = `${question.text}?`;
        }

        if (aliasGateQuestion) {
          question.logic = {
            enabled: true,
            prevQuestion: String(aliasGateQuestion.questionId),
            prevAnswer: 'Yes',
          };
          continue;
        }

        const gateQuestion = createGateQuestion('Do you have an alias?');
        questions.splice(i, 0, gateQuestion);
        aliasGateQuestion = gateQuestion;
        question.logic = {
          enabled: true,
          prevQuestion: String(gateQuestion.questionId),
          prevAnswer: 'Yes',
        };
        inserted = true;
        i += 1;
        continue;
      }

      if (!isConditionalField(field, question)) continue;
      if (question.logic?.enabled && findExistingGateQuestion(questions, /resubmi|applicable|replacement/i)) continue;

      if (field) {
        question.text = buildQuestionTextForField(field);
      }
      question.text = String(question.text || '')
        .replace(/^if\s+.+?,\s*(?:list|enter|provide)\s+/i, '')
        .replace(/^if\s+.+?,\s*/i, '')
        .trim()
        .replace(/^([a-z])/, (ch) => ch.toUpperCase());
      if (question.text && !question.text.endsWith('?')) {
        question.text = `${question.text}?`;
      }

      const gateText = inferConditionalGateQuestion(field || { label: question.text, newName: question.nameId });
      if (gateAlreadyPresent(questions, i)) {
        const prevGate = questions[i - 1];
        question.logic = {
          enabled: true,
          prevQuestion: String(prevGate.questionId),
          prevAnswer: 'Yes',
        };
        continue;
      }
      const gateQuestion = createGateQuestion(gateText);
      questions.splice(i, 0, gateQuestion);
      question.logic = {
        enabled: true,
        prevQuestion: String(gateQuestion.questionId),
        prevAnswer: 'Yes',
      };
      inserted = true;
      i += 1;
    }
    section.questions = questions;
  }

  return inserted ? renumberQuestions(formConfig) : formConfig;
}

function inferQuestionType(field) {
  if (field.type === 'checkbox') return 'checkbox';
  const hint = `${field.newName} ${field.label || ''}`;
  if (/date|dob|birth/i.test(hint)) return 'date';
  if (/phone|telephone/i.test(hint)) return 'phone';
  if (/amount|billing|money|fee/i.test(hint)) return 'money';
  return 'text';
}

function injectMissingFieldQuestions(formConfig, fieldConfig, missingNames) {
  if (!missingNames.length) return formConfig;

  const fieldMap = new Map((fieldConfig.fields || []).map((f) => [f.newName, f]));
  let maxQuestionId = 0;
  let maxSectionId = 0;

  for (const section of formConfig.sections || []) {
    maxSectionId = Math.max(maxSectionId, section.sectionId || 0);
    for (const question of section.questions || []) {
      maxQuestionId = Math.max(maxQuestionId, question.questionId || 0);
    }
  }

  let targetSection = (formConfig.sections || [])[formConfig.sections.length - 1];
  if (!targetSection) {
    targetSection = {
      sectionId: maxSectionId + 1 || 1,
      sectionName: 'Other',
      questions: [],
    };
    formConfig.sections = formConfig.sections || [];
    formConfig.sections.push(targetSection);
  }
  if (!Array.isArray(targetSection.questions)) {
    targetSection.questions = [];
  }

  for (const nameId of missingNames) {
    const field = fieldMap.get(nameId);
    if (!field) continue;

    maxQuestionId += 1;
    const questionType = inferQuestionType(field);
    const label = resolveSpecificFieldLabel(field);

    const question = {
      questionId: maxQuestionId,
      text: questionType === 'checkbox' ? label : buildQuestionTextForField(field),
      type: questionType,
      logic: { enabled: false, prevQuestion: '', prevAnswer: '' },
      jump: { enabled: false, option: '', to: '' },
      options: [],
      labels: [],
      placeholder: label,
      autopopulate: {
        enabled: isLikelyAutopopulatableField(field),
        profileKey: field.newName,
        profileDescription: label,
      },
    };

    if (field.type === 'checkbox') {
      question.type = 'checkbox';
      question.options = [{ label, nameId, value: label }];
    } else {
      question.nameId = nameId;
    }

    targetSection.questions.push(question);
  }

  formConfig.sectionCounter = Math.max(formConfig.sectionCounter || 0, maxSectionId + 1);
  formConfig.questionCounter = maxQuestionId + 1;
  return formConfig;
}

const SECTION_NAME_ALIASES = {
  'applicant information': 'Applicant',
  'applicant info': 'Applicant',
  'contributing agency information': 'Contributing Agency',
  'contributing agency': 'Contributing Agency',
  'agency information': 'Contributing Agency',
  'employer information': 'Employer',
  'service level': 'Level of Service',
  'level of service': 'Level of Service',
  'applicant sex': 'Applicant',
  'signature block': 'Signature and Privacy',
  'declarations': 'Signature and Privacy',
  'additional fields': 'Additional Info',
  'additional information': 'Additional Info',
};

const SECTION_NAME_STOP_WORDS = new Set([
  'information', 'info', 'details', 'section', 'data', 'the', 'and', 'of', 'for', 'your', 'please', 'enter',
]);

function titleCaseWord(word) {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function shortenSectionName(name, maxWords = 3) {
  const raw = String(name || 'Section').trim();
  if (!raw) return 'Section';

  if (raw.includes(' & ')) {
    const parts = raw.split(' & ').map((part) => shortenSectionName(part, 1));
    const unique = [];
    for (const part of parts) {
      if (part && !unique.includes(part)) unique.push(part);
    }
    return unique.slice(0, maxWords).join(' & ') || 'Info';
  }

  const lower = raw.toLowerCase().replace(/\s+/g, ' ');
  if (SECTION_NAME_ALIASES[lower]) return SECTION_NAME_ALIASES[lower];

  const words = lower.replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => !SECTION_NAME_STOP_WORDS.has(word));
  const picked = (meaningful.length ? meaningful : words).slice(0, maxWords);
  if (!picked.length) return 'Section';
  return picked.map(titleCaseWord).join(' ');
}

function mergeSectionNames(leftName, rightName) {
  const left = shortenSectionName(leftName, 1);
  const right = shortenSectionName(rightName, 1);
  if (left === right) return left;
  return `${left} & ${right}`;
}

function shortenSectionNames(formConfig) {
  if (!formConfig?.sections) return formConfig;
  for (const section of formConfig.sections) {
    section.sectionName = shortenSectionName(section.sectionName, 3);
  }
  return formConfig;
}

function ensureMinimumSections(formConfig, minCount = 2) {
  if (!formConfig?.sections || formConfig.sections.length >= minCount) return formConfig;

  // Flatten ALL sections — never drop later sections (e.g. a 1-field Employer bucket).
  const questions = formConfig.sections.flatMap((section) => section.questions || []);
  if (questions.length < minCount) return formConfig;

  const count = Math.min(minCount, questions.length);
  const splitAt = Math.ceil(questions.length / count);
  const chunks = [];
  for (let i = 0; i < questions.length; i += splitAt) {
    chunks.push(questions.slice(i, i + splitAt));
  }

  formConfig.sections = chunks.map((chunk, idx) => ({
    sectionId: idx + 1,
    sectionName: `Section ${idx + 1}`,
    questions: chunk,
  }));

  return renumberQuestions(formConfig);
}

function countFormQuestions(formConfig) {
  let total = 0;
  for (const section of formConfig?.sections || []) {
    total += (section.questions || []).length;
  }
  return total;
}

function ensureAdequateSectionLayout(formConfig, fieldConfig) {
  if (!formConfig?.sections?.length) return formConfig;

  const fieldCount = (fieldConfig?.fields || []).length;
  const sectionCount = formConfig.sections.length;
  const questionCount = countFormQuestions(formConfig);
  const minSections = fieldCount >= 12 || questionCount >= 12 ? 3 : 2;

  if (sectionCount >= minSections) return formConfig;

  console.warn(
    `[generate-form-config] Only ${sectionCount} section(s) for ${fieldCount} fields / ${questionCount} questions — forcing ${minSections} sections`
  );
  return ensureMinimumSections(formConfig, minSections);
}

function consolidateSections(formConfig, targetCount = 3, hardMax = 4, minCount = 2) {
  if (!formConfig || !Array.isArray(formConfig.sections)) return formConfig;

  let sections = formConfig.sections.map((section) => ({
    sectionId: section.sectionId,
    sectionName: section.sectionName || 'Section',
    questions: [...(section.questions || [])],
  }));

  if (sections.length <= targetCount) {
    formConfig.sections = sections;
    formConfig.sectionCounter = sections.length + 1;
    return ensureMinimumSections(formConfig, minCount);
  }

  while (sections.length > hardMax) {
    let bestIdx = 0;
    let bestSize = Infinity;
    for (let i = 0; i < sections.length - 1; i += 1) {
      const size = sections[i].questions.length + sections[i + 1].questions.length;
      if (size < bestSize) {
        bestSize = size;
        bestIdx = i;
      }
    }
    const left = sections[bestIdx];
    const right = sections[bestIdx + 1];
    const mergedName = mergeSectionNames(left.sectionName, right.sectionName);
    sections.splice(bestIdx, 2, {
      sectionId: left.sectionId,
      sectionName: mergedName,
      questions: [...left.questions, ...right.questions],
    });
  }

  while (sections.length > targetCount) {
    let bestIdx = 0;
    let bestSize = Infinity;
    for (let i = 0; i < sections.length - 1; i += 1) {
      const size = sections[i].questions.length + sections[i + 1].questions.length;
      if (size < bestSize) {
        bestSize = size;
        bestIdx = i;
      }
    }
    const left = sections[bestIdx];
    const right = sections[bestIdx + 1];
    const mergedName = mergeSectionNames(left.sectionName, right.sectionName);
    sections.splice(bestIdx, 2, {
      sectionId: left.sectionId,
      sectionName: mergedName,
      questions: [...left.questions, ...right.questions],
    });
  }

  sections.forEach((section, idx) => {
    section.sectionId = idx + 1;
  });
  formConfig.sections = sections;
  formConfig.sectionCounter = sections.length + 1;
  return ensureMinimumSections(formConfig, minCount);
}

function checkboxGroupPrefix(nameId) {
  if (!nameId) return '';
  const id = String(nameId).toLowerCase();
  const knownSuffixes = [
    '_male', '_female', '_nonbinary', '_nonbinary_unspecified', '_doj', '_fbi',
    '_yes', '_no', '_s_corporation', '_trust_estate', '_other_checkbox', '_sole_proprietor',
  ];
  for (const suffix of knownSuffixes) {
    if (id.endsWith(suffix)) return id.slice(0, -suffix.length);
  }
  const semantic = id.match(/^(tax_classification|level_of_service|applicant_sex|sex)(?:_|$)/);
  if (semantic) return semantic[1];
  const parts = id.split('_');
  if (parts.length > 1) return parts.slice(0, -1).join('_');
  return id;
}

function isBareCheckboxOptionText(text, options = []) {
  const normalized = String(text || '').trim().replace(/\?+$/, '').toLowerCase();
  if (!normalized) return true;
  if (options.some((opt) => String(opt.label || '').trim().toLowerCase() === normalized)) return true;
  if (normalized.length <= 24 && /^(male|female|nonbinary|doj|fbi|yes|no)$/i.test(normalized)) return true;
  return false;
}

function inferCheckboxGroupQuestionText(group) {
  const optionLabels = group.flatMap((q) => (q.options || []).map((opt) => opt.label)).filter(Boolean);
  const nameIds = group.flatMap((q) => (q.options || []).map((opt) => opt.nameId)).filter(Boolean);
  const blob = [...optionLabels, ...nameIds, ...group.map((q) => q.text)].join(' ').toLowerCase();

  if (/male|female|nonbinary|sex|gender|morf/.test(blob)) {
    return 'Please select your sex';
  }
  if (/doj|fbi|level.?of.?service|service.?level/.test(blob)) {
    return 'Please select your level of service';
  }
  if (/tax_classification|corporation|partnership|llc|trust\/estate|sole proprietor/.test(blob)) {
    return 'Please select your federal tax classification';
  }
  if (optionLabels.length > 1) {
    return 'Please select all that apply';
  }
  const label = optionLabels[0] || group[0]?.text || 'this option';
  return `Please confirm: ${String(label).replace(/\?+$/, '')}`;
}

function mergeFragmentedCheckboxGroups(formConfig) {
  if (!formConfig?.sections) return formConfig;

  for (const section of formConfig.sections) {
    const questions = section.questions || [];
    let i = 0;
    while (i < questions.length) {
      const q = questions[i];
      const opts = q.options || [];
      if (q.type === 'checkbox' && opts.length === 1) {
        const prefix = checkboxGroupPrefix(opts[0].nameId || q.nameId);
        const group = [q];
        let j = i + 1;
        while (j < questions.length) {
          const next = questions[j];
          const nextOpts = next.options || [];
          if (next.type !== 'checkbox' || nextOpts.length !== 1) break;
          const nextPrefix = checkboxGroupPrefix(nextOpts[0].nameId || next.nameId);
          if (prefix && nextPrefix && prefix === nextPrefix) {
            group.push(next);
            j += 1;
          } else {
            break;
          }
        }
        if (group.length > 1) {
          const merged = {
            ...group[0],
            questionId: group[0].questionId,
            text: inferCheckboxGroupQuestionText(group),
            type: 'checkbox',
            nameId: undefined,
            options: group.flatMap((item) => item.options || []),
            needsExplanation: group.some((item) => item.needsExplanation),
            explanation: group.find((item) => item.explanation)?.explanation || '',
          };
          questions.splice(i, group.length, merged);
          continue;
        }
      }
      i += 1;
    }
    section.questions = questions;
  }
  return formConfig;
}

/**
 * Absorb same-prefix checkbox options that were split by interleaved text fields
 * (e.g. LLC checkbox, then "other classification" text, then Other checkbox).
 */
function mergeScatteredCheckboxPrefixes(formConfig) {
  if (!formConfig?.sections) return formConfig;

  for (const section of formConfig.sections) {
    const questions = section.questions || [];

    for (let i = 0; i < questions.length; i += 1) {
      const groupQuestion = questions[i];
      if (groupQuestion.type !== 'checkbox' || !(groupQuestion.options?.length > 1)) continue;

      const prefix = checkboxGroupPrefix(groupQuestion.options[0]?.nameId);
      if (!prefix) continue;

      const absorbIdx = [];
      for (let j = 0; j < questions.length; j += 1) {
        if (j === i) continue;
        const other = questions[j];
        if (other.type !== 'checkbox' || (other.options?.length || 0) !== 1) continue;
        const otherPrefix = checkboxGroupPrefix(other.options[0]?.nameId || other.nameId);
        if (otherPrefix === prefix) absorbIdx.push(j);
      }
      if (!absorbIdx.length) continue;

      for (const j of absorbIdx.sort((a, b) => b - a)) {
        const other = questions[j];
        groupQuestion.options.push(...(other.options || []));
        questions.splice(j, 1);
        if (j < i) i -= 1;
      }

      groupQuestion.text = inferCheckboxGroupQuestionText([groupQuestion]);
      groupQuestion.nameId = undefined;
    }

    section.questions = questions;
  }

  return formConfig;
}

function normalizeCheckboxGroupQuestions(formConfig) {
  const merged = mergeScatteredCheckboxPrefixes(mergeFragmentedCheckboxGroups(formConfig));
  if (!merged?.sections) return merged;

  for (const section of merged.sections) {
    for (const question of section.questions || []) {
      if (question.type !== 'checkbox') continue;
      const options = question.options || [];
      if (isBareCheckboxOptionText(question.text, options)) {
        question.text = inferCheckboxGroupQuestionText([question]);
      }
    }
  }

  return merged;
}

function toExplanationPhrase(detail) {
  const cleaned = String(detail || '').trim().replace(/[.!?]+$/, '');
  if (!cleaned) return '';
  if (/^this\b/i.test(cleaned)) {
    return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  }
  if (/^(a|an|the)\b/i.test(cleaned)) return `This is ${cleaned}.`;
  return `This is ${cleaned}.`;
}

function stripInlineQuestionDetails(formConfig) {
  if (!formConfig?.sections) return formConfig;

  for (const section of formConfig.sections) {
    for (const question of section.questions || []) {
      let text = String(question.text || '').trim();
      if (!text) continue;

      const extracted = [];
      const cleaned = text
        .replace(/\s*\(([^)]+)\)/g, (_, inner) => {
          const detail = String(inner || '').trim();
          if (detail) extracted.push(detail);
          return ' ';
        })
        .replace(/\s+/g, ' ')
        .replace(/\s+\?/g, '?')
        .trim();

      if (!extracted.length) continue;

      let shortText = cleaned;
      if (!shortText.endsWith('?')) {
        shortText = shortText.replace(/[.!]+$/, '').trim();
        shortText = shortText.endsWith('?') ? shortText : `${shortText}?`;
      }

      question.text = shortText;
      const movedBlurbs = extracted.map(toExplanationPhrase).filter(Boolean).join(' ');
      const existing = String(question.explanation || '').trim();
      question.explanation = existing
        ? `${existing} ${movedBlurbs}`.trim()
        : movedBlurbs;
      question.needsExplanation = Boolean(question.explanation);
    }
  }

  return formConfig;
}

function stripQuestionTextForExplanation(text) {
  return String(text || '')
    .replace(/^\s*\d+[\.\)\:\-]\s*/, '')
    .replace(/^what is your /i, '')
    .replace(/^please (enter|provide|select) /i, '')
    .replace(/\?+$/, '')
    .trim();
}

function isFragmentExplanation(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  const words = t.split(/\s+/).length;
  if (words < 6) return true;
  if (/^this is\b/i.test(t) && words < 9) return true;
  if (/^this is (aka|an alias)\b/i.test(t)) return true;
  if (/this is aka or alias/i.test(t)) return true;
  return false;
}

function buildExplanationForQuestion(question, field, extractedDocumentContent = '') {
  const label = resolveSpecificFieldLabel(field, extractedDocumentContent)
    || stripQuestionTextForExplanation(question.text)
    || formatFieldNameAsLabel(field?.newName);
  const nameBlob = `${field?.newName || ''} ${label}`.toLowerCase();

  if (/alias|aka|other_(first|last|middle)_name/.test(nameBlob)) {
    if (/last/i.test(nameBlob)) {
      return 'Please enter the last name you use as an alias, if different from your legal name.';
    }
    if (/first/i.test(nameBlob)) {
      return 'Please enter the first name you use as an alias, if different from your legal name.';
    }
    if (/middle/i.test(nameBlob)) {
      return 'Please enter the middle name you use as an alias, if different from your legal name.';
    }
    return 'Please enter any name you use as an alias, if different from your legal name.';
  }
  if (/mail.?code/i.test(nameBlob)) {
    return 'This is the five-digit mail code assigned to your agency by the Department of Justice.';
  }
  if (/\bori\b/i.test(nameBlob)) {
    return 'This is your agency\'s Originating Agency Identifier code assigned by the DOJ.';
  }
  if (/\boca\b/i.test(nameBlob)) {
    return 'This is your Operator Control Agency number used to track live scan submissions.';
  }
  if (/\bati\b/i.test(nameBlob)) {
    return 'This is your Applicant Tracking Identifier number from your live scan submission.';
  }
  if (/resubmi|original.*ati/i.test(nameBlob)) {
    return 'Enter the ATI number from your original submission if you are resubmitting a live scan.';
  }
  if (question.autoTodayDate) {
    return 'This date is automatically set to today\'s date for your convenience.';
  }
  if (question.type === 'date') {
    return `Enter the date for ${label.toLowerCase()} as shown on your records. Use the calendar picker or type MM/DD/YYYY.`;
  }
  if (question.type === 'phone') {
    return `Enter a phone number where you can be reached regarding ${label.toLowerCase()}.`;
  }
  if (question.type === 'checkbox') {
    return 'Select the option or options that best apply to your situation.';
  }
  if (question.type === 'dropdown' && !question.nameId) {
    return 'Choose Yes or No to determine whether the following question applies to you.';
  }
  return `Please provide your ${label.toLowerCase()} exactly as it should appear on the completed form.`;
}

function isAutoTodayDateField(field, question) {
  const blob = `${field?.newName || ''} ${field?.label || ''} ${question?.text || ''}`;
  return AUTO_TODAY_DATE_PATTERNS.some((pattern) => pattern.test(blob));
}

function markAutoTodayDateFields(formConfig, fieldConfig) {
  if (!formConfig?.sections) return formConfig;

  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));

  for (const section of formConfig.sections) {
    for (const question of section.questions || []) {
      if (question.linkedFieldRole === 'mirror') continue;
      const nameId = question.nameId
        || question.options?.[0]?.nameId
        || question.textboxes?.[0]?.nameId;
      const field = nameId ? fieldMap.get(nameId) : null;
      if (!isAutoTodayDateField(field, question)) continue;

      question.autoTodayDate = true;
      if (question.type === 'text' || !question.type) {
        question.type = 'date';
      }
    }
  }

  return formConfig;
}

function normalizeQuestionExplanations(formConfig, fieldConfig, extractedDocumentContent = '') {
  if (!formConfig?.sections) return formConfig;

  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));

  for (const section of formConfig.sections) {
    for (const question of section.questions || []) {
      question.needsExplanation = true;

      const nameId = question.nameId
        || question.options?.[0]?.nameId
        || question.textboxes?.[0]?.nameId;
      const field = nameId ? fieldMap.get(nameId) : null;

      question.explanation = String(question.explanation || '').trim();
      if (isFragmentExplanation(question.explanation)) {
        question.explanation = buildExplanationForQuestion(question, field, extractedDocumentContent);
      }
      if (!question.explanation) {
        question.explanation = buildExplanationForQuestion(question, field, extractedDocumentContent);
      }
    }
  }
  return formConfig;
}

function validateFormConfig(formConfig, fieldConfig) {
  if (!formConfig || typeof formConfig !== 'object') {
    throw new Error('Model response is not a JSON object');
  }
  if (!Array.isArray(formConfig.sections)) {
    throw new Error('form_config.json must contain a "sections" array');
  }

  const missing = getMissingNameIds(formConfig, fieldConfig);
  if (missing.length > 0) {
    throw new Error(`form_config missing nameId for: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`);
  }

  return formConfig;
}

async function callOpenAiForFormConfig(openAiApiKey, payload, extraInstruction, pageImages = []) {
  const systemPrompt = loadFormConfigPrompt();
  const textPayload = extraInstruction
    ? `${JSON.stringify(payload, null, 2)}\n\nIMPORTANT: ${extraInstruction}`
    : JSON.stringify(payload, null, 2);
  const userContent = buildPdfVisionUserContent(textPayload, pageImages);

  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: FORM_CONFIG_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
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

  return extractJsonFromModelResponse(content);
}

function applyDeterministicQuestionWording(formConfig, fieldConfig, payload = {}) {
  const { extractedDocumentContent = '', structuredFields = [] } = payload;
  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));
  const contextMap = buildStructuredFieldMap(structuredFields);

  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      if (question.type === 'multipleTextboxes' && question.textboxes?.length) {
        const primary = fieldMap.get(question.textboxes[0].nameId);
        if (primary) {
          const domain = inferFieldDomain(primary);
          question.text = formQuestionText.buildAddressQuestionText(domain, primary);
        }
        continue;
      }

      if (question.type === 'checkbox' && (question.options?.length || 0) > 1) {
        continue;
      }

      if (!question.nameId || !fieldMap.has(question.nameId)) continue;

      const field = fieldMap.get(question.nameId);
      const ctx = trustedStructuredContext(field, contextMap.get(field.id));
      const resolvedLabel = formQuestionText.resolveSpecificFieldLabel(field, extractedDocumentContent, ctx);
      const needsRewrite = formQuestionText.isGarbageText(question.text)
        || isVagueQuestionText(question.text, field, extractedDocumentContent)
        || !formQuestionText.questionTextMatchesField(question.text, field, resolvedLabel);

      if (needsRewrite) {
        question.text = formQuestionText.buildQuestionTextForField(field, extractedDocumentContent, ctx);
      }
      question.placeholder = resolvedLabel;
      question.needsExplanation = true;
    }
  }

  return formConfig;
}

function applyDeterministicExplanations(formConfig, fieldConfig, payload = {}) {
  const { extractedDocumentContent = '', structuredFields = [] } = payload;
  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));
  const contextMap = buildStructuredFieldMap(structuredFields);

  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      if (question.type === 'multipleTextboxes' && question.textboxes?.length) {
        const primary = fieldMap.get(question.textboxes[0].nameId);
        if (primary) {
          const ctx = trustedStructuredContext(primary, contextMap.get(primary.id));
          const domain = inferFieldDomain(primary);
          question.explanation = formQuestionText.buildExplanationForQuestion(
            { ...question, _addressDomain: domain },
            primary,
            extractedDocumentContent,
            ctx
          );
        }
        continue;
      }

      if (question.type === 'checkbox' && (question.options?.length || 0) > 1) {
        const primary = fieldMap.get(question.options[0]?.nameId);
        if (primary) {
          question.explanation = formQuestionText.buildExplanationForQuestion(
            question,
            primary,
            extractedDocumentContent,
            trustedStructuredContext(primary, contextMap.get(primary.id))
          );
        }
        continue;
      }

      if (!question.nameId || !fieldMap.has(question.nameId)) continue;

      const field = fieldMap.get(question.nameId);
      const ctx = trustedStructuredContext(field, contextMap.get(field.id));
      question.explanation = formQuestionText.buildExplanationForQuestion(
        question,
        field,
        extractedDocumentContent,
        ctx
      );
      question.needsExplanation = true;
    }
  }

  return formConfig;
}

/**
 * Light structural enrich only — does NOT rewrite AI wording, sections, addresses, or gates.
 * Missing-field inject is a last-resort safety net after AI retries; prefer AI coverage.
 */
function postProcessFormConfig(formConfig, fieldConfig, payload = {}) {
  const {
    displayMode = 'all_at_once',
    userProfile = {},
  } = payload;

  let config = formConfig;
  let missing = getMissingNameIds(config, fieldConfig);
  if (missing.length > 0) {
    console.warn(
      `[generate-form-config] Injecting ${missing.length} missing field question(s) (AI should have covered these)`
    );
    config = injectMissingFieldQuestions(config, fieldConfig, missing);
  }

  config = validateFormConfig(config, fieldConfig);
  config = normalizeCheckboxGroupQuestions(config);
  config = markAutoTodayDateFields(config, fieldConfig);
  config = applyLinkedFields(config, fieldConfig);
  config = enrichFormConfigAutopopulate(config, userProfile, displayMode, fieldConfig);

  const { validateFullQuality } = require('./pipeline-quality');
  const quality = validateFullQuality(config, fieldConfig, payload);
  if (quality.failures.length) {
    console.warn('[generate-form-config] Quality failures (for AI revise):', quality.failures.slice(0, 8));
  }
  if (quality.warnings.length) {
    console.warn('[generate-form-config] Quality warnings:', quality.warnings.slice(0, 5));
  }

  return ensureFormCatalogMetadata(config, fieldConfig);
}

async function polishSectionWithAI(section, openAiApiKey, fieldConfig, pageImages = []) {
  if (!openAiApiKey || !section?.questions?.length) return section;

  try {
    const userContent = buildPdfVisionUserContent(
      JSON.stringify({
        sectionName: section.sectionName,
        sectionId: section.sectionId,
        questions: section.questions,
        formTitle: fieldConfig?.formTitle,
      }, null, 2),
      pageImages
    );

    const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: FORM_CONFIG_POLISH_MODEL,
        messages: [
          { role: 'system', content: POLISH_SECTION_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return section;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return section;

    const polished = extractJsonFromModelResponse(content);
    if (!polished?.questions?.length) return section;

    const byId = new Map(polished.questions.map((q) => [q.questionId, q]));
    const mergedQuestions = section.questions.map((original) => {
      const update = byId.get(original.questionId);
      if (!update) return original;
      return {
        ...original,
        explanation: String(update.explanation || original.explanation || '').trim() || original.explanation,
        needsExplanation: true,
      };
    });

    return {
      ...section,
      questions: mergedQuestions,
    };
  } catch (err) {
    console.warn(`[generate-form-config] Section polish failed (${section.sectionName}):`, err.message);
    return section;
  }
}

async function polishFormConfigWithAI(formConfig, fieldConfig, openAiApiKey, pageImages = []) {
  if (!openAiApiKey || !formConfig?.sections?.length) return formConfig;

  const polishedSections = [];
  for (const section of formConfig.sections) {
    polishedSections.push(await polishSectionWithAI(section, openAiApiKey, fieldConfig, pageImages));
  }

  return { ...formConfig, sections: polishedSections };
}

function summarizeFormConfigForReview(formConfig) {
  const questions = [];
  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      questions.push({
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        questionId: question.questionId,
        text: question.text,
        type: question.type,
        nameId: question.nameId || null,
        options: (question.options || []).map((opt) => ({
          label: opt.label,
          nameId: opt.nameId || null,
        })),
        textboxes: (question.textboxes || []).map((tb) => ({
          label: tb.label || tb.placeholder || null,
          nameId: tb.nameId || null,
          pdfCombineInto: tb.pdfCombineInto || null,
        })),
        logic: question.logic || null,
        explanation: question.explanation || '',
      });
    }
  }
  return {
    formTitle: formConfig.formTitle || null,
    displayMode: formConfig.displayMode || null,
    sections: (formConfig.sections || []).map((section) => ({
      sectionId: section.sectionId,
      sectionName: section.sectionName,
      questionCount: (section.questions || []).length,
    })),
    questions,
  };
}

async function reviewFormConfigWithAI(formConfig, fieldConfig, openAiApiKey, pageImages = []) {
  if (!openAiApiKey || !formConfig?.sections?.length) {
    return { ok: true, summary: 'Review skipped', issues: [] };
  }

  const payload = {
    fieldConfig: {
      formTitle: fieldConfig?.formTitle,
      fields: (fieldConfig?.fields || []).map((field) => ({
        newName: field.newName,
        type: field.type,
        label: field.label,
        conditional: field.conditional || null,
      })),
    },
    formConfigSummary: summarizeFormConfigForReview(formConfig),
  };

  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: FORM_CONFIG_REVIEW_MODEL,
      messages: [
        { role: 'system', content: FORM_CONFIG_REVIEW_PROMPT },
        { role: 'user', content: buildPdfVisionUserContent(JSON.stringify(payload, null, 2), pageImages) },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Review API failed (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { ok: true, summary: 'Empty review response', issues: [] };

  const review = extractJsonFromModelResponse(content);
  const issues = Array.isArray(review?.issues) ? review.issues : [];
  return {
    ok: review?.ok !== false && issues.filter((issue) => issue?.severity === 'error').length === 0,
    summary: String(review?.summary || '').trim() || (issues.length ? 'Issues found' : 'Looks good'),
    issues,
  };
}

async function reviseFormConfigWithAI(formConfig, fieldConfig, review, openAiApiKey, pageImages = []) {
  if (!openAiApiKey || !formConfig?.sections?.length) return formConfig;
  if (!review?.issues?.length) return formConfig;

  const requiredNameIds = (fieldConfig?.fields || []).map((field) => field.newName);
  const payload = {
    fieldConfig,
    requiredNameIds,
    requiredFieldCount: requiredNameIds.length,
    reviewSummary: review.summary || '',
    issues: review.issues,
    formConfig,
  };

  const response = await fetchOpenAiWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: FORM_CONFIG_MODEL,
      messages: [
        { role: 'system', content: FORM_CONFIG_REVISE_PROMPT },
        { role: 'user', content: buildPdfVisionUserContent(JSON.stringify(payload, null, 2), pageImages) },
      ],
      temperature: 0.1,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Revise API failed (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return formConfig;

  const revised = extractJsonFromModelResponse(content);
  if (!revised?.sections?.length) return formConfig;

  const missing = getMissingNameIds(revised, fieldConfig);
  if (missing.length) {
    console.warn(
      `[generate-form-config] Review revision missing ${missing.length} nameId(s); keeping pre-review config`
    );
    return formConfig;
  }

  validateFormConfig(revised, fieldConfig);
  return revised;
}

async function reviewAndReviseFormConfig(formConfig, fieldConfig, openAiApiKey, pageImages = [], payload = {}) {
  if (FORM_CONFIG_SKIP_REVIEW || !openAiApiKey) return formConfig;

  try {
    const { validateFullQuality } = require('./pipeline-quality');
    const quality = validateFullQuality(formConfig, fieldConfig, payload);
    const validatorIssues = qualityFailuresToReviewIssues(quality.failures);

    console.log('[generate-form-config] Secondary AI review…');
    const review = await reviewFormConfigWithAI(formConfig, fieldConfig, openAiApiKey, pageImages);

    // Merge validator failures into the review so the reviser must address them.
    const seen = new Set((review.issues || []).map((i) => String(i?.message || '')));
    const mergedIssues = [...(review.issues || [])];
    for (const issue of validatorIssues) {
      if (seen.has(issue.message)) continue;
      mergedIssues.push(issue);
      seen.add(issue.message);
    }
    const mergedReview = {
      ...review,
      ok: mergedIssues.filter((i) => i?.severity === 'error').length === 0,
      issues: mergedIssues,
      summary: validatorIssues.length
        ? `${review.summary || 'Reviewed'} (+${validatorIssues.length} validator error(s))`
        : review.summary,
    };

    const errors = mergedReview.issues.filter((issue) => issue?.severity === 'error');
    const warnings = mergedReview.issues.filter((issue) => issue?.severity !== 'error');
    console.log(
      `[generate-form-config] Review: ${mergedReview.summary} (${errors.length} error(s), ${warnings.length} warning(s))`
    );
    for (const issue of mergedReview.issues.slice(0, 10)) {
      console.log(
        `  - [${issue.severity || 'warning'}] ${issue.category || 'other'}: ${issue.message || ''}`
      );
    }

    if (!mergedReview.issues.length) return formConfig;

    console.log('[generate-form-config] Revising form_config from review + validator feedback…');
    const revised = await reviseFormConfigWithAI(
      formConfig,
      fieldConfig,
      mergedReview,
      openAiApiKey,
      pageImages
    );
    return revised;
  } catch (err) {
    console.warn('[generate-form-config] Review/revise skipped due to error:', err.message);
    return formConfig;
  }
}

async function generateFormConfig(payload, openAiApiKey) {
  const {
    fieldConfig,
    extractedDocumentContent = '',
    structuredFields = [],
    displayMode = 'all_at_once',
    userProfile = {},
    pdfToken = '',
    pdfBase64 = '',
  } = payload;

  if (!fieldConfig?.fields?.length) {
    throw new Error('fieldConfig.fields is required');
  }

  const pageImages = await resolvePdfPageImages(
    { pdfToken, pdfBase64 },
    { required: true, logPrefix: '[generate-form-config]' }
  );

  const requiredNameIds = (fieldConfig.fields || []).map((f) => f.newName);
  const promptPayload = {
    fieldConfig,
    extractedDocumentContent,
    displayMode,
    userProfile,
    requiredFieldCount: fieldConfig.fields.length,
    requiredNameIds,
  };

  let config;
  let missing = [];
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let extraInstruction = null;
    if (missing.length > 0) {
      extraInstruction = attempt < maxAttempts
        ? buildMissingFieldsRetryInstruction(missing, fieldConfig, requiredNameIds.length)
        : buildPatchFormConfigInstruction(config, missing, fieldConfig);
    }

    config = await callOpenAiForFormConfig(openAiApiKey, promptPayload, extraInstruction, pageImages);
    missing = getMissingNameIds(config, fieldConfig);
    if (missing.length === 0) {
      validateFormConfig(config, fieldConfig);
      config.displayMode = displayMode;
      config.htmlMode = payload.htmlMode || config.htmlMode || 'normal';
      // Post-process first so the second reviewer sees the same UX users get
      // (not a pre-strip draft that code later rewrites).
      config = postProcessFormConfig(config, fieldConfig, {
        extractedDocumentContent,
        structuredFields,
        displayMode,
        userProfile,
      });
      config = await reviewAndReviseFormConfig(config, fieldConfig, openAiApiKey, pageImages, {
        extractedDocumentContent,
        structuredFields,
      });
      // Soft enrich after AI revise (linked/autopopulate only — no wording rewrite)
      config = postProcessFormConfig(config, fieldConfig, {
        extractedDocumentContent,
        structuredFields,
        displayMode,
        userProfile,
      });
      validateFormConfig(config, fieldConfig);
      return ensureFormCatalogMetadata(config, fieldConfig);
    }
    console.warn(
      `[generate-form-config] Attempt ${attempt}/${maxAttempts}: missing ${missing.length} nameId(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`
    );
  }

  throw new Error(
    `form_config missing nameId for: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''} (${missing.length} total after ${maxAttempts} attempts)`
  );
}

function createHandleGenerateFormConfig(openAiApiKey) {
  return async function handleGenerateFormConfig(req, res) {
    try {
      const {
        fieldConfig,
        extractedDocumentContent = '',
        structuredFields = [],
        displayMode = 'all_at_once',
        userProfile = {},
        pdfToken = '',
        pdfBase64 = '',
      } = req.body || {};

      const formConfig = await generateFormConfig(
        {
          fieldConfig,
          extractedDocumentContent,
          structuredFields,
          displayMode,
          userProfile,
          pdfToken,
          pdfBase64,
        },
        openAiApiKey
      );

      res.json({
        success: true,
        formConfig,
        sectionCount: formConfig.sections?.length || 0,
        autopopulateCount: formConfig.autopopulateFields?.length || 0,
      });

      try {
        saveCurrentData({
          label: 'step-6-form-config',
          fieldConfig,
          formConfig,
          extractedDocumentContent,
        });
      } catch (dumpErr) {
        console.warn('[generate-form-config] Current data dump failed:', dumpErr.message);
      }
    } catch (error) {
      console.error('[generate-form-config] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate form config',
      });
    }
  };
}

module.exports = {
  generateFormConfig,
  createHandleGenerateFormConfig,
  postProcessFormConfig,
  reviewFormConfigWithAI,
  reviseFormConfigWithAI,
  reviewAndReviseFormConfig,
  applyDeterministicExplanations,
  validateFormConfig,
  injectMissingFieldQuestions,
  getMissingNameIds,
  normalizeCheckboxGroupQuestions,
  normalizeVagueQuestionText,
  ensureConditionalGateQuestions,
  renumberQuestions,
  resolveSpecificFieldLabel,
  buildQuestionTextForField,
  sanitizeFieldLabel,
  markAutoTodayDateFields,
};
