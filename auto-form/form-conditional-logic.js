/**
 * Conditional gate logic — specific gate questions and checkbox follow-up wiring.
 */

const formQuestionText = require('./form-question-text');

const VAGUE_GATE_PATTERNS = [
  /^does this apply\??$/i,
  /^does this apply to you\??$/i,
  /^does this apply to your submission\??$/i,
];

/**
 * PDF labels marked "(if any)/(optional)/(if applicable)" that can usually stay blankable
 * without a Yes/No gate — EXCEPT presence-assumed identity fields (see isPresenceOptionalField).
 */
function isOptionalApplicabilityField(field) {
  const label = String(field?.label || '');
  return /\((if applicable|if any|optional)\)/i.test(label);
}

/**
 * Fields that assume the user has an extra entity/name/relationship.
 * NEVER show these unconditionally — always ask a Yes/No presence gate first.
 * Example: W-9 "business name / disregarded entity name" must not imply the user has one.
 */
const PRESENCE_OPTIONAL_PATTERNS = [
  /\bbusiness[_\s-]*name\b/i,
  /\bdisregarded[_\s-]*entity\b/i,
  /\bdoing[_\s-]*business[_\s-]*as\b/i,
  /\bdba\b/i,
  /\btrade[_\s-]*name\b/i,
  /\badditional[_\s-]*name\b/i,
  /\bspouse[_\s-]*(name|first|last|ssn|tin)\b/i,
  /\bdependent[_\s-]*(name|first|last)\b/i,
  /\bpartner[_\s-]*name\b/i,
];

function isPresenceOptionalField(field, question = null) {
  const blob = [
    field?.newName,
    field?.label,
    question?.nameId,
    question?.text,
  ].filter(Boolean).join(' ');
  if (!blob) return false;
  if (PRESENCE_OPTIONAL_PATTERNS.some((pattern) => pattern.test(blob))) return true;
  // "if different from above/line 1" secondary name lines are also presence-gated
  if (/business|entity|dba|trade/.test(blob) && /if different|differs from/i.test(blob)) {
    return true;
  }
  return false;
}

function isVagueGateText(text) {
  const normalized = String(text || '').trim();
  return VAGUE_GATE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function stripOptionalSuffix(label) {
  return String(label || '')
    .replace(/\s*\((if applicable|if any|optional)\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferSpecificGateQuestion(field, followUpQuestion = null) {
  if (field?.conditional?.gateQuestion && !isVagueGateText(field.conditional.gateQuestion)) {
    return field.conditional.gateQuestion.endsWith('?')
      ? field.conditional.gateQuestion
      : `${field.conditional.gateQuestion}?`;
  }

  const label = stripOptionalSuffix(field?.label || followUpQuestion?.text || '');
  const name = String(field?.newName || '').toLowerCase();
  const blob = `${name} ${label}`.toLowerCase();

  if (/alias|aka|other_(first|last|middle)_name|other_name/.test(blob)) {
    return 'Do you have an alias or other name?';
  }
  if (/original.*ati|resubmi|re-submi/.test(blob)) {
    return 'Is this a resubmission?';
  }
  if (/replacement/.test(blob)) {
    return 'Are you requesting a replacement?';
  }
  if (/foreign partner/.test(blob)) {
    return 'Do you have foreign partners, owners, or beneficiaries?';
  }
  if (/other.*tax.*classif|tax.*classif.*other|_other$/.test(blob) && /classif|tax|type/.test(blob)) {
    return 'Did you select "Other" for your federal tax classification?';
  }
  if (/llc|limited liability/.test(blob) && /classif|code|box/.test(blob)) {
    return 'Did you select "LLC" for your federal tax classification?';
  }
  if (/other.*tin|tin.*other/.test(blob)) {
    return 'Are you providing a TIN that is different from your primary taxpayer identification number?';
  }
  if (/business.?name|disregarded.?entity/.test(blob)) {
    return 'Do you have a business name or disregarded entity name?';
  }
  if (/additional.*name|dba|doing business as|trade.?name/.test(blob)) {
    return 'Do you have a different business name or DBA to list?';
  }
  if (/spouse/.test(blob)) {
    return 'Do you need to provide spouse information?';
  }
  if (/dependent/.test(blob)) {
    return 'Do you need to provide dependent information?';
  }

  const ifMatch = String(field?.label || '').match(/^if\s+(.+?)(?:,|:|\s+list|\s+enter)/i);
  if (ifMatch) {
    const condition = ifMatch[1].trim();
    return condition.endsWith('?') ? condition : `Is this for ${condition}?`;
  }

  if (label) {
    const topic = label.charAt(0).toLowerCase() + label.slice(1);
    if (/\((if any|if applicable)\)/i.test(field?.label || '')) {
      return `Do you need to provide ${topic}?`;
    }
    return `Do you need to enter ${topic}?`;
  }

  return 'Does this apply to you?';
}

function findCheckboxGroupWithOption(questions, preferBeforeIndex, optionPattern) {
  const tryIndex = (i) => {
    const q = questions[i];
    if (q.type !== 'checkbox' || !(q.options?.length > 1)) return null;
    const match = q.options.find((opt) => optionPattern.test(String(opt.label || opt.value || opt.nameId || '')));
    if (match) return { gateQuestion: q, option: match, index: i };
    return null;
  };

  for (let i = preferBeforeIndex - 1; i >= 0; i -= 1) {
    const found = tryIndex(i);
    if (found) return found;
  }
  for (let i = 0; i < questions.length; i += 1) {
    if (i === preferBeforeIndex) continue;
    const found = tryIndex(i);
    if (found) return found;
  }
  return null;
}

function removeGateQuestion(questions, gateIndex) {
  const removedId = String(questions[gateIndex]?.questionId || '');
  questions.splice(gateIndex, 1);
  for (const q of questions) {
    if (q.logic?.enabled && String(q.logic.prevQuestion) === removedId) {
      q.logic.enabled = false;
      q.logic.prevQuestion = '';
      q.logic.prevAnswer = '';
    }
  }
}

function wireCheckboxFollowUpLogic(formConfig, fieldConfig) {
  if (!formConfig?.sections) return formConfig;

  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));
  let changed = false;

  // Build a flat list so follow-ups can find checkbox groups in other sections
  // (section padding often splits classification checkboxes away from LLC/Other text fields).
  const flat = [];
  for (let sIdx = 0; sIdx < formConfig.sections.length; sIdx += 1) {
    const section = formConfig.sections[sIdx];
    for (let qIdx = 0; qIdx < (section.questions || []).length; qIdx += 1) {
      flat.push({ sIdx, qIdx, question: section.questions[qIdx] });
    }
  }

  for (let flatIdx = 0; flatIdx < flat.length; flatIdx += 1) {
    const { question, sIdx } = flat[flatIdx];
    if (!question.nameId || question.linkedFieldRole === 'mirror') continue;

    const field = fieldMap.get(question.nameId);
    if (!field) continue;

    const blob = `${field.newName} ${field.label || ''}`.toLowerCase();
    let optionPattern = null;
    if (/tax_classification_other$|other.*classif|classif.*other/.test(blob) && !/checkbox/.test(blob)) {
      optionPattern = /other/i;
    } else if (/llc.*classif|classif.*code|tax_classification_code/.test(blob)) {
      optionPattern = /llc/i;
    }
    if (!optionPattern) continue;

    const allQuestions = flat.map((entry) => entry.question);
    const parent = findCheckboxGroupWithOption(allQuestions, flatIdx, optionPattern);
    if (!parent) continue;

    const parentFlat = flat[parent.index];

    // Move follow-up into the checkbox group's section, immediately after the group.
    if (parentFlat.sIdx !== sIdx) {
      const fromSection = formConfig.sections[sIdx];
      const toSection = formConfig.sections[parentFlat.sIdx];
      const fromIdx = fromSection.questions.indexOf(question);
      if (fromIdx >= 0) fromSection.questions.splice(fromIdx, 1);
      const insertAt = toSection.questions.indexOf(parent.gateQuestion) + 1;
      toSection.questions.splice(insertAt, 0, question);
      changed = true;
      // Rebuild flat after structural change
      return wireCheckboxFollowUpLogic(
        renumberGateFormConfig(formConfig),
        fieldConfig
      );
    }

    // Keep the controlling checkbox group before its follow-up within the section.
    const sectionQuestions = formConfig.sections[sIdx].questions;
    const questionIdx = sectionQuestions.indexOf(question);
    const groupIdx = sectionQuestions.indexOf(parent.gateQuestion);
    if (groupIdx > questionIdx && questionIdx >= 0) {
      const [groupQuestion] = sectionQuestions.splice(groupIdx, 1);
      sectionQuestions.splice(questionIdx, 0, groupQuestion);
      changed = true;
      return wireCheckboxFollowUpLogic(
        renumberGateFormConfig(formConfig),
        fieldConfig
      );
    }

    const prevGate = sectionQuestions.find(
      (q, idx) => idx < questionIdx
        && q.type === 'dropdown'
        && !q.nameId
        && String(question.logic?.prevQuestion) === String(q.questionId)
    );

    if (prevGate && (isVagueGateText(prevGate.text) || /^do you need to/i.test(prevGate.text || '') || /tax classification/i.test(prevGate.text || ''))) {
      const gateIdx = sectionQuestions.indexOf(prevGate);
      if (gateIdx >= 0) {
        removeGateQuestion(sectionQuestions, gateIdx);
        changed = true;
      }
    }

    question.logic = {
      enabled: true,
      prevQuestion: String(parent.gateQuestion.questionId),
      prevAnswer: String(parent.option.value || parent.option.label || 'Other'),
    };
    changed = true;
  }

  return changed ? renumberGateFormConfig(formConfig) : formConfig;
}

function normalizeVagueGateQuestions(formConfig, fieldConfig) {
  if (!formConfig?.sections) return formConfig;

  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));

  for (const section of formConfig.sections) {
    for (let i = 0; i < (section.questions || []).length; i += 1) {
      const question = section.questions[i];
      if (question.type !== 'dropdown' || question.nameId) continue;
      if (!isVagueGateText(question.text)) continue;

      const nextQuestion = section.questions[i + 1];
      const field = nextQuestion?.nameId ? fieldMap.get(nextQuestion.nameId) : null;
      const gateText = inferSpecificGateQuestion(field, nextQuestion);

      question.text = gateText.endsWith('?') ? gateText : `${gateText}?`;
      question.needsExplanation = true;
      question.explanation = field
        ? `Answer Yes if you need to complete "${stripOptionalSuffix(field.label || nextQuestion.text)}". Answer No to skip this question.`
        : 'Answer Yes if the following question applies to you. Answer No to skip it.';
    }
  }

  return formConfig;
}

function removeUnnecessaryOptionalGates(formConfig, fieldConfig) {
  if (!formConfig?.sections) return formConfig;

  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));
  let changed = false;

  for (const section of formConfig.sections) {
    const questions = section.questions || [];

    for (let i = questions.length - 1; i >= 0; i -= 1) {
      const question = questions[i];
      if (question.type !== 'dropdown' || question.nameId) continue;

      const nextQuestion = questions[i + 1];
      const controlsNext = nextQuestion?.logic?.enabled
        && String(nextQuestion.logic.prevQuestion) === String(question.questionId);

      // A one-option checkbox already records the affirmative fact. Asking Yes/No
      // immediately before it adds a redundant click without collecting information.
      if (controlsNext && nextQuestion.type === 'checkbox' && (nextQuestion.options?.length || 0) === 1) {
        nextQuestion.logic = { enabled: false, prevQuestion: '', prevAnswer: '' };
        questions.splice(i, 1);
        changed = true;
        continue;
      }

      if (!isVagueGateText(question.text) && !/^do you need to/i.test(question.text || '')) continue;

      const field = nextQuestion?.nameId ? fieldMap.get(nextQuestion.nameId) : null;
      if (!field || !isOptionalApplicabilityField(field)) continue;
      // Never strip gates for presence-assumed fields (business/entity/spouse/etc.).
      if (isPresenceOptionalField(field, nextQuestion)) continue;
      if (controlsNext) {
        nextQuestion.logic = { enabled: false, prevQuestion: '', prevAnswer: '' };
      }
      questions.splice(i, 1);
      changed = true;
    }

    section.questions = questions;
  }

  return changed ? renumberGateFormConfig(formConfig) : formConfig;
}

function renumberGateFormConfig(formConfig) {
  const idMap = new Map();
  let nextId = 1;

  for (const section of formConfig.sections || []) {
    for (const question of section.questions || []) {
      idMap.set(question.questionId, nextId);
      question.questionId = nextId;
      nextId += 1;
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
      if (question.jump?.enabled && question.jump.to) {
        question.jump.to = remap(question.jump.to);
      }
    }
  }

  return formConfig;
}

function validateGateQuestionClarity(formConfig) {
  const failures = [];
  const warnings = [];

  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      if (question.type === 'dropdown' && !question.nameId) {
        if (isVagueGateText(question.text)) {
          failures.push(`Vague conditional gate Q${question.questionId}: "${question.text}"`);
        }
        if (question.needsExplanation !== true) {
          warnings.push(`Gate Q${question.questionId} missing needsExplanation`);
        }
        const expl = String(question.explanation || '').trim();
        if (!expl || expl.split(/\s+/).length < 8) {
          warnings.push(`Gate Q${question.questionId} needs a clearer explanation`);
        }
      }

      if (question.logic?.enabled && !question.logic.prevQuestion) {
        failures.push(`Q${question.questionId} has logic enabled but no prevQuestion`);
      }
    }
  }

  return { failures, warnings };
}

function findQuestionById(formConfig, questionId) {
  const target = String(questionId || '');
  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      if (String(question.questionId) === target) return question;
    }
  }
  return null;
}

/**
 * Presence-optional PDF fields (business/entity names, spouse, etc.) must sit behind a Yes/No gate.
 * Never assume the user has that information.
 */
function validatePresenceOptionalGates(formConfig, fieldConfig) {
  const failures = [];
  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));

  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      if (!question.nameId || question.linkedFieldRole === 'mirror') continue;
      const field = fieldMap.get(question.nameId);
      if (!isPresenceOptionalField(field, question)) continue;

      if (!question.logic?.enabled || !question.logic.prevQuestion) {
        failures.push(
          `Presence-optional field "${question.nameId}" (Q${question.questionId}) must be gated — never assume the user has this info`
        );
        continue;
      }

      const gate = findQuestionById(formConfig, question.logic.prevQuestion);
      if (!gate || gate.type !== 'dropdown' || gate.nameId) {
        failures.push(
          `Presence-optional field "${question.nameId}" (Q${question.questionId}) must reference a Yes/No gate dropdown`
        );
        continue;
      }
      if (!/yes/i.test(String(question.logic.prevAnswer || ''))) {
        failures.push(
          `Presence-optional field "${question.nameId}" (Q${question.questionId}) should show when gate answer is Yes`
        );
      }
    }
  }

  return { failures, warnings: [] };
}

module.exports = {
  isOptionalApplicabilityField,
  isPresenceOptionalField,
  isVagueGateText,
  inferSpecificGateQuestion,
  wireCheckboxFollowUpLogic,
  normalizeVagueGateQuestions,
  removeUnnecessaryOptionalGates,
  validateGateQuestionClarity,
  validatePresenceOptionalGates,
  PRESENCE_OPTIONAL_PATTERNS,
  VAGUE_GATE_PATTERNS,
};
