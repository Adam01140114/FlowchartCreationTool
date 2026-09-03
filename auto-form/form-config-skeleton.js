/**
 * Deterministic form_config skeleton from field_config + structured extraction.
 * AI polishes question text afterward; structure is built in code.
 */

const { isLikelyAutopopulatableField } = require('./form-autopopulate');
const {
  buildQuestionTextForField,
  buildExplanationForQuestion,
  buildAddressQuestionText,
  resolveSpecificFieldLabel,
} = require('./form-question-text');
const {
  buildStructuredFieldMap,
  inferConditionalFromField,
} = require('./structured-field-context');
const { planFormSections, inferFieldDomain } = require('./field-domain');

const ADDRESS_STREET_RE = /street|address|p\.?o\.?\s*box|addr/i;
const ADDRESS_CITY_RE = /\bcity\b/i;
const ADDRESS_ZIP_RE = /\bzip\b/i;
const ADDRESS_STATE_RE = /\bstate\b/i;

function isAddressStreetField(field) {
  const { addressPartRole } = require('./form-config-quality');
  return addressPartRole(field.newName, field.label) === 'street';
}

function isAddressCityField(field) {
  const { addressPartRole } = require('./form-config-quality');
  const role = addressPartRole(field.newName, field.label);
  return role === 'city' || role === 'cityStateZip';
}

function isAddressZipField(field) {
  const { addressPartRole } = require('./form-config-quality');
  return addressPartRole(field.newName, field.label) === 'zip';
}

function isAddressStateField(field) {
  const { addressPartRole } = require('./form-config-quality');
  return addressPartRole(field.newName, field.label) === 'state';
}

const CHECKBOX_GROUP_SUFFIXES = [
  '_male', '_female', '_nonbinary', '_nonbinary_unspecified', '_doj', '_fbi', '_yes', '_no',
  '_s_corporation', '_trust_estate', '_other_checkbox', '_sole_proprietor',
];

const AUTO_TODAY_DATE_PATTERNS = [
  /today.?s?.?date/i,
  /current.?date/i,
  /signature.?date/i,
  /date.?signed/i,
  /signing.?date/i,
  /date.?of.?signature/i,
];

function checkboxGroupPrefix(nameId) {
  if (!nameId) return '';
  const id = String(nameId).toLowerCase();
  for (const suffix of CHECKBOX_GROUP_SUFFIXES) {
    if (id.endsWith(suffix)) return id.slice(0, -suffix.length);
  }
  const semantic = id.match(/^(tax_classification|level_of_service|applicant_sex|sex)(?:_|$)/);
  if (semantic) return semantic[1];
  const parts = id.split('_');
  if (parts.length > 1) return parts.slice(0, -1).join('_');
  return id;
}

function inferQuestionType(field) {
  if (field.type === 'checkbox') return 'checkbox';
  const hint = `${field.newName} ${field.label || ''}`;
  if (/date|dob|birth/i.test(hint)) return 'date';
  if (/phone|telephone/i.test(hint)) return 'phone';
  if (/amount|billing|money|fee/i.test(hint)) return 'money';
  return 'text';
}

function isAutoTodayDateField(field) {
  const blob = `${field?.newName || ''} ${field?.label || ''}`;
  return AUTO_TODAY_DATE_PATTERNS.some((pattern) => pattern.test(blob));
}

function isAliasField(field) {
  const blob = `${field?.newName || ''} ${field?.label || ''}`;
  return /other_(first|last|middle)_name|other_name|aka_/i.test(blob);
}

function isConditionalField(field) {
  return Boolean(field?.conditional) || /original.*ati|resubmi|replacement|prior_|previous_/i.test(`${field?.newName} ${field?.label}`);
}

let nextTempQuestionId = -1;

function createGateQuestion(gateText) {
  return {
    questionId: nextTempQuestionId--,
    text: gateText.endsWith('?') ? gateText : `${gateText}?`,
    needsExplanation: true,
    explanation: 'Choose Yes or No to determine whether the following question applies to you.',
    type: 'dropdown',
    logic: { enabled: false, prevQuestion: '', prevAnswer: '' },
    jump: { enabled: false, option: '', to: '' },
    options: [
      { label: 'Yes', value: 'Yes' },
      { label: 'No', value: 'No' },
    ],
    labels: [],
    placeholder: '',
    nameId: null,
    linkedToNameId: null,
    linkedFieldRole: 'primary',
    autopopulate: { enabled: false },
  };
}

function createBaseQuestion(field, structuredContext, extractedDocumentContent) {
  const questionType = inferQuestionType(field);
  const label = resolveSpecificFieldLabel(field, extractedDocumentContent, structuredContext);
  const autopopulateEnabled = isLikelyAutopopulatableField(field);

  const question = {
    questionId: 0,
    text: questionType === 'checkbox' ? label : buildQuestionTextForField(field, extractedDocumentContent, structuredContext),
    needsExplanation: true,
    explanation: '',
    type: questionType,
    logic: { enabled: false, prevQuestion: '', prevAnswer: '' },
    jump: { enabled: false, option: '', to: '' },
    options: [],
    labels: [],
    placeholder: label,
    nameId: field.type === 'checkbox' ? undefined : field.newName,
    linkedToNameId: null,
    linkedFieldRole: 'primary',
    autoTodayDate: false,
    autopopulate: {
      enabled: autopopulateEnabled,
      profileKey: autopopulateEnabled ? field.newName : '',
      profileDescription: autopopulateEnabled ? label : '',
    },
  };

  if (field.type === 'checkbox') {
    question.options = [{
      label,
      nameId: field.newName,
      value: label,
      autopopulate: question.autopopulate,
    }];
  }

  if (isAutoTodayDateField(field)) {
    question.autoTodayDate = true;
    question.type = 'date';
  }

  question.explanation = buildExplanationForQuestion(question, field, extractedDocumentContent, structuredContext);
  return question;
}

function inferCheckboxGroupQuestionText(prefix, options) {
  const blob = `${prefix} ${options.map((o) => o.label).join(' ')}`.toLowerCase();
  if (/male|female|nonbinary|sex|gender|morf/.test(blob)) return 'Please select your sex';
  if (/doj|fbi|level.?of.?service/.test(blob)) return 'Please select your level of service';
  if (/tax_classification|corporation|partnership|llc|trust\/estate|sole proprietor/.test(blob)) {
    return 'Please select your federal tax classification';
  }
  if (options.length > 1) return 'Please select all that apply';
  return `Please confirm: ${options[0]?.label || 'this option'}`;
}

function orderFields(fieldConfig, structuredFields) {
  const fields = [...(fieldConfig?.fields || [])];
  const contextMap = buildStructuredFieldMap(structuredFields);
  const orderIndex = new Map();

  structuredFields.forEach((entry, idx) => {
    if (entry?.id) orderIndex.set(entry.id, idx);
    if (entry?.name) orderIndex.set(entry.name, idx);
  });

  fields.sort((a, b) => {
    const ai = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bi = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return 0;
  });

  return fields.map((field) => ({
    field,
    context: contextMap.get(field.id) || null,
  }));
}

function tryConsumeAddressBlock(items, startIndex, extractedDocumentContent) {
  const slice = items.slice(startIndex);
  if (!slice.length || !isAddressStreetField(slice[0].field)) return null;

  const { addressFamilyKey, addressPartRole } = require('./form-config-quality');
  const family = addressFamilyKey(slice[0].field.newName, slice[0].field);
  const block = [slice[0]];
  const relativeConsumed = new Set([0]);

  // Look ahead past interleaved non-address fields (contact name, phone, requester, etc.)
  for (let i = 1; i < Math.min(slice.length, 8); i += 1) {
    const { field } = slice[i];
    const role = addressPartRole(field.newName, field.label);
    if (!role || role === 'street') continue;
    if (addressFamilyKey(field.newName, field) !== family) continue;
    if (block.some((entry) => addressPartRole(entry.field.newName, entry.field.label) === role)) continue;
    block.push(slice[i]);
    relativeConsumed.add(i);
  }
  if (block.length < 2) return null;

  const textboxes = block.map(({ field, context }) => ({
    label: resolveSpecificFieldLabel(field, extractedDocumentContent, context),
    nameId: field.newName,
    placeholder: resolveSpecificFieldLabel(field, extractedDocumentContent, context),
    autopopulate: {
      enabled: isLikelyAutopopulatableField(field),
      profileKey: field.newName,
      profileDescription: resolveSpecificFieldLabel(field, extractedDocumentContent, context),
    },
  }));

  const primaryField = block[0].field;
  const primaryContext = block[0].context;
  const addressDomain = inferFieldDomain(primaryField);
  const questionText = buildAddressQuestionText(addressDomain, primaryField);

  const question = {
    questionId: 0,
    text: questionText,
    needsExplanation: true,
    explanation: buildExplanationForQuestion({ type: 'multipleTextboxes', text: questionText, _addressDomain: addressDomain }, primaryField, extractedDocumentContent, primaryContext),
    type: 'multipleTextboxes',
    logic: { enabled: false, prevQuestion: '', prevAnswer: '' },
    jump: { enabled: false, option: '', to: '' },
    options: [],
    labels: textboxes.map((tb) => tb.label),
    textboxes,
    placeholder: '',
    linkedToNameId: null,
    linkedFieldRole: 'primary',
    autopopulate: { enabled: false },
  };

  return { question, consumed: 1, skipNameIds: new Set(block.slice(1).map((entry) => entry.field.newName)) };
}

function tryConsumeCheckboxGroup(items, startIndex, extractedDocumentContent) {
  const first = items[startIndex];
  if (!first || first.field.type !== 'checkbox') return null;

  const prefix = checkboxGroupPrefix(first.field.newName);
  const group = [first];
  let i = startIndex + 1;
  while (i < items.length) {
    const next = items[i];
    if (next.field.type !== 'checkbox') break;
    const nextPrefix = checkboxGroupPrefix(next.field.newName);
    if (prefix && nextPrefix === prefix) {
      group.push(next);
      i += 1;
    } else {
      break;
    }
  }
  if (group.length < 2) return null;

  const options = group.map(({ field, context }) => ({
    label: resolveSpecificFieldLabel(field, extractedDocumentContent, context),
    nameId: field.newName,
    value: resolveSpecificFieldLabel(field, extractedDocumentContent, context),
    autopopulate: {
      enabled: isLikelyAutopopulatableField(field),
      profileKey: field.newName,
      profileDescription: resolveSpecificFieldLabel(field, extractedDocumentContent, context),
    },
  }));

  const questionText = inferCheckboxGroupQuestionText(prefix, options);
  const primaryField = group[0].field;
  const primaryContext = group[0].context;

  const question = {
    questionId: 0,
    text: questionText,
    needsExplanation: true,
    explanation: buildExplanationForQuestion({ type: 'checkbox', text: questionText }, primaryField, extractedDocumentContent, primaryContext),
    type: 'checkbox',
    logic: { enabled: false, prevQuestion: '', prevAnswer: '' },
    jump: { enabled: false, option: '', to: '' },
    options,
    labels: [],
    placeholder: '',
    linkedToNameId: null,
    linkedFieldRole: 'primary',
    autopopulate: { enabled: false },
  };

  return { question, consumed: group.length };
}

function buildSectionQuestions(sectionItems, extractedDocumentContent) {
  const questions = [];
  let aliasGateQuestion = null;
  let i = 0;
  const skipNameIds = new Set();

  while (i < sectionItems.length) {
    const currentName = sectionItems[i]?.field?.newName;
    if (currentName && skipNameIds.has(currentName)) {
      i += 1;
      continue;
    }

    const addressBlock = tryConsumeAddressBlock(sectionItems, i, extractedDocumentContent);
    if (addressBlock) {
      questions.push(addressBlock.question);
      for (const nameId of addressBlock.skipNameIds || []) skipNameIds.add(nameId);
      i += addressBlock.consumed;
      continue;
    }

    const checkboxGroup = tryConsumeCheckboxGroup(sectionItems, i, extractedDocumentContent);
    if (checkboxGroup) {
      questions.push(checkboxGroup.question);
      i += checkboxGroup.consumed;
      continue;
    }

    const { field, context } = sectionItems[i];

    if (isAliasField(field)) {
      if (!aliasGateQuestion) {
        aliasGateQuestion = createGateQuestion('Do you have an alias?');
        questions.push(aliasGateQuestion);
      }
      const question = createBaseQuestion(field, context, extractedDocumentContent);
      question.logic = {
        enabled: true,
        prevQuestion: String(aliasGateQuestion.questionId),
        prevAnswer: 'Yes',
      };
      questions.push(question);
      i += 1;
      continue;
    }

    if (isConditionalField(field)) {
      const conditional = field.conditional || inferConditionalFromField(field, context);
      const gateText = conditional?.gateQuestion || 'Does this apply to you?';
      const gateQuestion = createGateQuestion(gateText);
      questions.push(gateQuestion);
      const question = createBaseQuestion(field, context, extractedDocumentContent);
      question.logic = {
        enabled: true,
        prevQuestion: String(gateQuestion.questionId),
        prevAnswer: 'Yes',
      };
      questions.push(question);
      i += 1;
      continue;
    }

    questions.push(createBaseQuestion(field, context, extractedDocumentContent));
    i += 1;
  }

  return questions;
}

function renumberFormConfig(formConfig) {
  let questionId = 1;
  let sectionId = 1;
  const idMap = new Map();

  for (const section of formConfig.sections || []) {
    section.sectionId = sectionId;
    sectionId += 1;
    for (const question of section.questions || []) {
      idMap.set(question.questionId, questionId);
      question.questionId = questionId;
      questionId += 1;
    }
  }

  const remap = (value) => {
    const parsed = parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed)) return value;
    return idMap.has(parsed) ? String(idMap.get(parsed)) : value;
  };

  for (const section of formConfig.sections || []) {
    for (const question of section.questions || []) {
      if (question.logic?.enabled && question.logic.prevQuestion) {
        question.logic.prevQuestion = remap(question.logic.prevQuestion);
      }
    }
  }

  for (const section of formConfig.sections || []) {
    const qs = section.questions || [];
    for (let i = 0; i < qs.length; i += 1) {
      const question = qs[i];
      if (question.logic?.enabled && i > 0) {
        const prev = qs[i - 1];
        if (prev?.type === 'dropdown' && !prev.nameId) {
          question.logic.prevQuestion = String(prev.questionId);
        }
      }
    }
  }

  formConfig.sectionCounter = formConfig.sections.length + 1;
  formConfig.questionCounter = questionId;
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

  return renumberFormConfig(formConfig);
}

function buildFormConfigSkeleton(fieldConfig, options = {}) {
  const {
    structuredFields = [],
    extractedDocumentContent = '',
    displayMode = 'all_at_once',
  } = options;

  const ordered = orderFields(fieldConfig, structuredFields);
  const sectionMap = planFormSections(ordered);

  const sections = [];
  for (const [sectionName, items] of sectionMap.entries()) {
    sections.push({
      sectionId: sections.length + 1,
      sectionName,
      questions: buildSectionQuestions(items, extractedDocumentContent),
    });
  }

  const formConfig = {
    formTitle: fieldConfig.formTitle || 'Generated Form',
    displayMode,
    sections,
    hiddenFields: [],
    linkedFieldGroups: [],
    sectionCounter: sections.length + 1,
    questionCounter: 1,
  };

  return ensureMinimumSections(renumberFormConfig(formConfig), fieldConfig?.fields?.length >= 12 ? 3 : 2);
}

module.exports = {
  buildFormConfigSkeleton,
  checkboxGroupPrefix,
  inferQuestionType,
  createGateQuestion,
  createBaseQuestion,
};
