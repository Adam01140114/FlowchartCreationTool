/**
 * Form config quality — validators + address helpers only.
 * Does NOT rewrite AI/reviewer output. Defects are reported so the AI revise loop can fix them.
 */

const formQuestionText = require('./form-question-text');
const { validateGateQuestionClarity } = require('./form-conditional-logic');
const { inferFieldDomain } = require('./field-domain');
const { buildStructuredFieldMap } = require('./structured-field-context');

const GARBAGE_RE = /page\s*\d+\s*of\s*\d+|department\s+of\s+justice|state\s+of\s+|bcia\s*\d+|request\s+for\s+live\s+scan\s+service/i;

const AWKWARD_QUESTION_PATTERNS = [
  { pattern: /^what is your name of /i, reason: 'awkward "name of" phrasing' },
  { pattern: /^what is your your /i, reason: 'duplicate "your"' },
  { pattern: /^what is your box for /i, reason: 'unclear "box for" wording' },
  { pattern: /^what is your list account /i, reason: 'unclear list/account wording' },
  { pattern: /^what name and number to give/i, reason: 'instruction text used as question' },
  { pattern: /^what is your employer's employer /i, reason: 'duplicate employer phrasing' },
  { pattern: /agency's agency /i, reason: 'duplicate agency phrasing' },
  { pattern: /\bori code\b/, reason: 'ORI acronym not capitalized' },
  { pattern: /^what is your number\b/i, reason: 'vague number without OCA/billing context' },
  { pattern: /applicant number/i, reason: 'vague applicant number — prefer OCA when label is Your Number/OCA' },
  { pattern: /^what is your .+\/.+\?$/i, reason: 'raw PDF slash label in question' },
  { pattern: /^(enter|list|provide|write)\b/i, reason: 'instruction used instead of a natural question' },
  { pattern: /^[a-z0-9 .:-]*\benter .+ details\b/i, reason: 'vague "enter details" instruction — ask a concrete question' },
  { pattern: /\bdocument details\b/i, reason: 'vague "document details" — say which document and what to enter' },
  { pattern: /^if\b/i, reason: 'conditional prefix belongs in logic, not question text' },
];

function collectQuestions(formConfig) {
  const out = [];
  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      out.push({ question, section });
    }
  }
  return out;
}

function getQuestionNameId(question) {
  return question.nameId
    || question.options?.[0]?.nameId
    || question.textboxes?.[0]?.nameId
    || null;
}

function trustedStructuredContext(field, ctx) {
  if (!ctx?.nearestLabel || !field) return null;
  const sanitized = formQuestionText.sanitizeFieldLabel(ctx.nearestLabel, field.newName);
  if (formQuestionText.isSectionHeaderLabel(sanitized)) return null;
  if (formQuestionText.isGarbageText(sanitized) || formQuestionText.isVagueLabel(sanitized)) return null;
  if (!formQuestionText.labelAlignsWithField(field, sanitized)) return null;
  return { ...ctx, nearestLabel: sanitized, sanitizedLabel: sanitized };
}

function validateQuestionClarity(formConfig) {
  const failures = [];
  const warnings = [];

  for (const { question } of collectQuestions(formConfig)) {
    const text = String(question.text || '').trim();
    if (!text) continue;

    for (const { pattern, reason } of AWKWARD_QUESTION_PATTERNS) {
      if (!pattern.test(text)) continue;
      if (reason.includes('vague number') && /oca|billing|your_number|applicant_number|tracking|submission/i.test(
        `${question.nameId || ''} ${question.explanation || ''} ${question.placeholder || ''}`
      )) {
        continue;
      }
      // Follow-ups gated by Yes/No or prior option often start with "If…" — that is correct UX.
      if (reason.includes('conditional prefix') && question.logic?.enabled) {
        continue;
      }
      failures.push(`Q${question.questionId}: ${reason} — "${text.slice(0, 70)}"`);
      break;
    }

    // Wall of fields under a non-question title is hard to answer.
    if (question.type === 'multipleTextboxes' && (question.textboxes?.length || 0) >= 6) {
      if (!/\?/.test(text)) {
        failures.push(
          `Q${question.questionId}: large field group needs a clear question (not an instruction dump) — "${text.slice(0, 70)}"`
        );
      }
    }

    if (question.type === 'checkbox' && (question.options?.length || 0) > 1) {
      if (/^(male|female|doj|fbi)\??$/i.test(text)) {
        failures.push(`Q${question.questionId}: bare checkbox group title "${text}"`);
      }
      if (text.length < 12) {
        warnings.push(`Q${question.questionId}: checkbox group title may be too short ("${text}")`);
      }
    }

    const expl = String(question.explanation || '').trim();
    if (question.needsExplanation && expl) {
      if (/^enter your name of entity/i.test(expl)) {
        warnings.push(`Q${question.questionId}: explanation echoes raw PDF label`);
      }
      if (expl.split(/\s+/).length < 8 && question.type !== 'checkbox') {
        warnings.push(`Q${question.questionId}: explanation too short (${expl.split(/\s+/).length} words)`);
      }
    }

    if (question.logic?.enabled) {
      const prevId = question.logic.prevQuestion;
      const allQuestions = collectQuestions(formConfig).map((entry) => entry.question);
      const gate = allQuestions.find((q) => String(q.questionId) === String(prevId));
      if (!gate) {
        failures.push(`Q${question.questionId}: logic references missing gate Q${prevId}`);
      }
    }
  }

  return { failures, warnings };
}

function validateUniqueSectionNames(formConfig) {
  const failures = [];
  const seen = new Map();
  for (const section of formConfig?.sections || []) {
    const name = String(section.sectionName || '').trim().toLowerCase();
    if (!name) {
      failures.push(`Section ${section.sectionId} has an empty sectionName`);
      continue;
    }
    if (seen.has(name)) {
      failures.push(
        `Duplicate section name "${section.sectionName}" (sections ${seen.get(name)} and ${section.sectionId}) — every sectionName must be unique`
      );
    } else {
      seen.set(name, section.sectionId);
    }
  }
  return { failures, warnings: [] };
}

function addressPartRole(nameId, label = '') {
  const name = String(nameId || '').toLowerCase();
  const labelText = String(label || '').toLowerCase();
  const blob = `${name} ${labelText}`.trim();
  if (!blob) return null;

  if (/requester/.test(blob) || /name and address|name & address/.test(labelText)) {
    return null;
  }

  if (/city_state_zip|city_state_and_zip/.test(name) || /city,\s*state,\s*and\s*zip/.test(labelText)) {
    return 'cityStateZip';
  }

  if (/\btax|amount|income|credit|deduction|withholding|exemption/.test(blob)) {
    // not an address part
  } else if (/\bzip\b|_zip(_|$)/.test(blob)) {
    return 'zip';
  } else if (/\bstate\b|_state(_|$)/.test(blob) && !/\bzip\b/.test(blob)) {
    return 'state';
  } else if (/\bcity\b|_city(_|$)/.test(blob)) {
    return 'city';
  }

  if (
    /^(address|street|street_address|home_address|mailing_address)$/.test(name)
    || /street_?address|home_address|mailing_address|_address$/.test(name)
    || /^(address|street|p\.?o\.?\s*box)\b/.test(labelText)
  ) {
    return 'street';
  }
  return null;
}

function addressFamilyKey(nameId, field = null) {
  const n = String(nameId || '').toLowerCase();
  if (/city_state_zip|city_state_and_zip|^address$|^street$|^street_address$/.test(n)) {
    return `addr:${inferFieldDomain(field || { newName: nameId })}`;
  }
  return n
    .replace(/_(street_?address|street_or_po|home_address|mailing_address|address|city_state_zip|city|state|zip_?code|zip)$/i, '')
    .replace(/_+$/, '') || n;
}

/**
 * Structural pdfCombineInto rules only — semantic fitness is AI/reviewer-owned.
 */
function isValidPdfCombine(node, fieldMap) {
  if (!node?.pdfCombineInto) return true;
  const target = String(node.pdfCombineInto);
  if (!fieldMap.has(target)) return false;
  if (node.nameId && node.nameId === target) return true;
  if (node.nameId && fieldMap.has(node.nameId) && node.nameId !== target) return false;
  return true;
}

function validatePdfCombineRules(formConfig, fieldConfig) {
  const failures = [];
  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));

  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      const check = (node, where) => {
        if (!node?.pdfCombineInto) return;
        if (isValidPdfCombine(node, fieldMap)) return;
        const target = String(node.pdfCombineInto);
        if (!fieldMap.has(target)) {
          failures.push(`${where}: pdfCombineInto "${target}" is not a real field_config newName`);
          return;
        }
        failures.push(
          `${where}: cannot merge two distinct PDF fields via pdfCombineInto ("${node.nameId}" → "${target}")`
        );
      };

      check(question, `Q${question.questionId}`);
      for (const tb of question.textboxes || []) {
        check(tb, `Q${question.questionId} textbox "${tb.label || tb.nameId || tb.placeholder || '?'}"`);
      }
    }
  }

  return { failures, warnings: [] };
}

/** State on address blocks must write to PDF (nameId or pdfCombineInto), never dead UI-only. */
function validateAddressStateMapping(formConfig, fieldConfig) {
  const failures = [];
  const stateNameIds = new Set(
    (fieldConfig?.fields || [])
      .filter((f) => addressPartRole(f.newName, f.label) === 'state')
      .map((f) => f.newName)
  );
  const zipNameIds = new Set(
    (fieldConfig?.fields || [])
      .filter((f) => addressPartRole(f.newName, f.label) === 'zip')
      .map((f) => f.newName)
  );

  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      if (question.type !== 'multipleTextboxes' || !Array.isArray(question.textboxes)) continue;
      const hasZip = question.textboxes.some((tb) => tb?.nameId && zipNameIds.has(tb.nameId));
      if (!hasZip) continue;
      const hasRealStateWidget = question.textboxes.some((tb) => tb?.nameId && stateNameIds.has(tb.nameId));
      if (hasRealStateWidget) continue;

      for (const tb of question.textboxes) {
        const isState = /\bstate\b/i.test(`${tb?.label || ''} ${tb?.placeholder || ''} ${tb?.combinePart || ''}`);
        if (!isState) continue;
        if (tb.nameId && stateNameIds.has(tb.nameId)) continue;
        if (tb.pdfCombineInto && zipNameIds.has(tb.pdfCombineInto)) continue;
        failures.push(
          `Q${question.questionId}: State must pdfCombineInto the zip widget — dead UI-only State is not allowed`
        );
      }
    }
  }

  return { failures, warnings: [] };
}

function validateQuestionTextQuality(formConfig, fieldConfig, payload = {}) {
  const { extractedDocumentContent = '', structuredFields = [] } = payload;
  const fieldMap = new Map((fieldConfig?.fields || []).map((field) => [field.newName, field]));
  const contextMap = buildStructuredFieldMap(structuredFields);
  const failures = [];
  const warnings = [];
  const textToFields = new Map();

  for (const { question } of collectQuestions(formConfig)) {
    const nameId = getQuestionNameId(question);
    const field = nameId ? fieldMap.get(nameId) : null;
    const text = String(question.text || '').trim();

    if (!text) {
      failures.push(`Q${question.questionId}: empty question text (${nameId || 'no nameId'})`);
      continue;
    }
    if (GARBAGE_RE.test(text)) {
      failures.push(`Q${question.questionId}: garbage question text "${text.slice(0, 60)}…"`);
    }
    if (field && question.type !== 'checkbox' && question.type !== 'multipleTextboxes') {
      const ctx = trustedStructuredContext(field, contextMap.get(field.id));
      const label = formQuestionText.resolveSpecificFieldLabel(field, extractedDocumentContent, ctx);
      if (!formQuestionText.questionTextMatchesField(text, field, label)) {
        warnings.push(`Q${question.questionId} ("${nameId}") text may not match field label "${label}"`);
      }
    }

    const key = text.toLowerCase();
    if (!textToFields.has(key)) textToFields.set(key, []);
    textToFields.get(key).push({ questionId: question.questionId, nameId });
  }

  for (const [text, entries] of textToFields.entries()) {
    if (entries.length > 1) {
      const ids = entries.map((e) => `Q${e.questionId}(${e.nameId || '?'})`).join(', ');
      failures.push(`Duplicate question text (${entries.length}x): "${text.slice(0, 55)}${text.length > 55 ? '…' : ''}" — ${ids}`);
    }
  }

  const gateAudit = validateGateQuestionClarity(formConfig);
  failures.push(...gateAudit.failures);
  warnings.push(...gateAudit.warnings);

  const clarityAudit = validateQuestionClarity(formConfig);
  failures.push(...clarityAudit.failures);
  warnings.push(...clarityAudit.warnings);

  const sectionAudit = validateUniqueSectionNames(formConfig);
  failures.push(...sectionAudit.failures);

  const combineAudit = validatePdfCombineRules(formConfig, fieldConfig);
  failures.push(...combineAudit.failures);

  const addressState = validateAddressStateMapping(formConfig, fieldConfig);
  failures.push(...addressState.failures);

  return { failures, warnings, ok: failures.length === 0 };
}

/** Convert validator failures into AI review issues (errors the reviser must fix). */
function qualityFailuresToReviewIssues(failures = []) {
  return failures.map((message) => {
    const match = String(message).match(/Q(\d+)/);
    return {
      severity: 'error',
      category: 'other',
      questionId: match ? Number(match[1]) : null,
      nameId: null,
      message: String(message),
      suggestion: 'Fix this using PDF context and field_config. Do not invent new field_config nameIds.',
    };
  });
}

module.exports = {
  collectQuestions,
  getQuestionNameId,
  trustedStructuredContext,
  validateQuestionTextQuality,
  validateQuestionClarity,
  validatePdfCombineRules,
  validateAddressStateMapping,
  validateUniqueSectionNames,
  qualityFailuresToReviewIssues,
  addressPartRole,
  addressFamilyKey,
  GARBAGE_RE,
};
