/**
 * Structured per-field PDF context — label sanitization, conditionals, enrichment.
 */

const {
  sanitizeFieldLabel,
  isVagueLabel,
  isGarbageText,
  formatFieldNameAsLabel,
  labelAlignsWithField,
  isSectionHeaderLabel,
} = require('./form-question-text');
const { inferCanonicalNewName, isOperatorField } = require('./field-name-canonicalizer');

const BOILERPLATE_PATTERNS = [
  /page\s*\d+\s*of\s*\d+/gi,
  /state\s+of\s+\w+/gi,
  /department\s+of\s+justice/gi,
  /request\s+for\s+live\s+scan\s+service/gi,
  /bcia\s*\d+/gi,
  /\(rev\.\s*[\d/]+\)/gi,
  /applicant\s+submission/gi,
];

const SECTION_HEADER_PATTERNS = [
  /^contributing\s+agency/i,
  /^applicant\s+submission/i,
  /^applicant\s+information/i,
  /^employer\b/i,
  /^live\s+scan\s+transaction\s+completed/i,
  /^agency\b/i,
  /^signature\b/i,
  /^service\s+level/i,
  /^authorized\s+agency/i,
];

const ALIAS_FIELD_PATTERNS = [
  /other_(first|last|middle)_name/i,
  /\baka\b/i,
  /^aka_/i,
  /other_name/i,
];

const CONDITIONAL_FIELD_PATTERNS = [
  /original.*ati/i,
  /prior_/i,
  /previous_/i,
  /resubmi/i,
  /re_submi/i,
  /replacement/i,
  /^if_/i,
];

function sanitizeNearestLabel(raw, newName = '') {
  let text = String(raw || '').trim();
  for (const pattern of BOILERPLATE_PATTERNS) {
    text = text.replace(pattern, ' ');
  }
  text = text
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || isGarbageText(text)) {
    return formatFieldNameAsLabel(newName);
  }

  text = text.replace(/[:;,.]+$/, '').trim();
  if (text.length > 60) {
    const words = text.split(/\s+/);
    text = words.slice(-6).join(' ');
  }
  return sanitizeFieldLabel(text, newName);
}

function normalizeSectionHint(raw) {
  const text = String(raw || '').trim().replace(/:+$/, '');
  if (!text) return 'General';
  if (/contributing\s+agency|agency\s+authorized|applicant\s+submission/i.test(text)) return 'Agency';
  if (/applicant\s+information/i.test(text)) return 'Applicant';
  if (/employer/i.test(text)) return 'Employer';
  if (/live\s+scan\s+transaction\s+completed|operator|transmitting\s+agency|lsid|amount\s+collected/i.test(text)) return 'Operator';
  if (/service\s+level|level\s+of\s+service/i.test(text)) return 'Service';
  if (/signature|privacy/i.test(text)) return 'Legal';
  const short = text.split(/\s+/).slice(0, 3).join(' ');
  if (/^transaction$/i.test(short)) return 'General';
  return short || 'General';
}

function isSectionHeaderLine(text) {
  const line = String(text || '').trim();
  if (!line || line.length > 80) return false;
  if (/:$/.test(line) && line.length < 60) return true;
  return SECTION_HEADER_PATTERNS.some((re) => re.test(line));
}

function inferSectionHintFromField(field, structuredContext = null) {
  const id = String(field?.id || '').toLowerCase();
  const name = String(field?.newName || '').toLowerCase();

  if (isOperatorField(field)) return 'Operator';
  if (/\.ori\[0\]|authorizedapptype|typeof\[0\]|agencyauthorized|mailcode\[0\]|streetaddress|contactname|city\[0\]|zip\[0\]|phonenum\[0\]/.test(id)) return 'Agency';
  if (/emplname|address\[0\]|phonenum\[1\]|city\[2\]|zip\[2\]|mailcode\[1\]/.test(id)) return 'Employer';
  if (/\.doj\[0\]|\.fbi\[0\]/.test(id)) return 'Service';
  if (/firstname|lastname|suffix|dob|dlnumber|height|weight|eye|hair|billing|pob|ssn|misc|streetorpo|city\[1\]|zip\[1\]|datetimefield1|yournumber|origati|morf/.test(id)) return 'Applicant';

  if (/^agency_|^mail_code$|ori_code|contact_/.test(name)) return 'Agency';
  if (/^employer_/.test(name)) return 'Employer';
  if (/level_of_service/.test(name)) return 'Service';
  if (/^applicant_|^other_name|date_of_birth|drivers_license|home_/.test(name)) return 'Applicant';

  const stale = String(structuredContext?.sectionHint || '');
  if (stale && stale !== 'Transaction' && stale !== 'General') {
    return normalizeSectionHint(stale);
  }
  return 'General';
}

function buildStructuredFieldMap(structuredFields) {
  const map = new Map();
  if (!Array.isArray(structuredFields)) return map;
  for (const entry of structuredFields) {
    if (entry?.id) map.set(entry.id, entry);
    if (entry?.name && !map.has(entry.name)) map.set(entry.name, entry);
  }
  return map;
}

function inferConditionalFromField(field, structuredContext = null) {
  if (field?.conditional) return field.conditional;

  const blob = `${field?.newName || ''} ${field?.label || ''} ${structuredContext?.nearestLabel || ''} ${structuredContext?.sectionHint || ''}`.toLowerCase();

  if (ALIAS_FIELD_PATTERNS.some((re) => re.test(blob))) {
    return { onlyWhen: 'has_alias', gateQuestion: 'Do you have an alias?' };
  }
  if (/original.*ati|origati|resubmi|re-submi/i.test(blob)) {
    return { onlyWhen: 'resubmission', gateQuestion: 'Is this a resubmission?' };
  }
  if (/replacement/i.test(blob)) {
    return { onlyWhen: 'replacement', gateQuestion: 'Are you requesting a replacement?' };
  }
  if (CONDITIONAL_FIELD_PATTERNS.some((re) => re.test(blob))) {
    return { onlyWhen: 'applicable', gateQuestion: null };
  }
  if (/^if\s+/i.test(field?.label || '')) {
    return { onlyWhen: 'applicable', gateQuestion: null };
  }
  return null;
}

function disambiguateVagueLabel(field, structuredContext = null) {
  const section = String(inferSectionHintFromField(field, structuredContext) || '').toLowerCase();
  const nearest = String(structuredContext?.nearestLabel || '').toLowerCase();
  const newName = String(field?.newName || '').toLowerCase();
  const blob = `${section} ${nearest} ${newName}`;

  if (isVagueLabel(field?.label) || isGarbageText(field?.label)) {
    if (/\boca\b|your\s+number/i.test(nearest) || /yournumber|oca_number/.test(newName)) {
      return 'OCA Number';
    }
    if (/\bori\b/i.test(nearest) || /ori_code/.test(newName)) {
      return 'ORI Code';
    }
    if (/mail\s*code/i.test(nearest) || /mail_code/.test(newName)) {
      return 'Mail Code';
    }
    if (/billing/i.test(nearest) || /billing_number/.test(newName)) {
      return 'Billing Number';
    }
    if (/city/.test(field?.label) || /city/.test(newName)) {
      if (/employer/.test(blob) || /employer_city/.test(newName)) return 'Employer City';
      if (/home|applicant_home/.test(blob) || /home_city|applicant_home/.test(newName)) return 'Home City';
      if (/agency/.test(blob) || /agency_city/.test(newName)) return 'Agency City';
      return formatFieldNameAsLabel(field.newName);
    }
    if (/zip/.test(field?.label) || /zip/.test(newName)) {
      if (/employer/.test(blob) || /employer_zip/.test(newName)) return 'Employer ZIP Code';
      if (/home|applicant_home/.test(blob) || /home_zip|applicant_home/.test(newName)) return 'Home ZIP Code';
      if (/agency/.test(blob) || /agency_zip/.test(newName)) return 'Agency ZIP Code';
      return 'ZIP Code';
    }
    return formatFieldNameAsLabel(field.newName);
  }
  return sanitizeFieldLabel(field.label, field.newName);
}

function fixSemanticNewName(field, structuredContext = null) {
  const nearest = String(structuredContext?.nearestLabel || '').toLowerCase();
  const newName = String(field?.newName || '');

  if (newName === 'your_number') {
    if (/\boca\b/i.test(nearest) || /\boca\b/i.test(field?.label || '') || /your\s+number/i.test(field?.label || '')) {
      return 'oca_number';
    }
  }
  return newName;
}

function trustedNearestLabel(field, rawNearestLabel) {
  const sanitized = sanitizeNearestLabel(rawNearestLabel, field?.newName);
  if (!sanitized || isGarbageText(sanitized) || isVagueLabel(sanitized) || isSectionHeaderLabel(sanitized)) {
    return null;
  }
  if (!labelAlignsWithField(field, sanitized)) {
    return null;
  }
  return sanitized;
}

function enrichFieldConfig(fieldConfig, structuredFields = [], extractedDocumentContent = '') {
  if (!fieldConfig?.fields) return fieldConfig;

  const contextMap = buildStructuredFieldMap(structuredFields);
  const seenNewNames = new Set();

  for (const field of fieldConfig.fields) {
    const ctx = contextMap.get(field.id) || contextMap.get(field.id?.replace(/\[\d+\]$/, '[0]'));
    field.newName = inferCanonicalNewName(field, ctx);
    field.label = disambiguateVagueLabel(field, ctx);
    field.newName = fixSemanticNewName(field, ctx);

    if (seenNewNames.has(field.newName)) {
      const suffix = String(field.id || '').match(/(\w+)\[\d+\]$/)?.[1]?.toLowerCase();
      if (suffix && !field.newName.includes(suffix)) {
        field.newName = `${field.newName}_${suffix}`;
      }
    }
    seenNewNames.add(field.newName);

    const conditional = inferConditionalFromField(field, ctx);
    if (conditional) {
      field.conditional = conditional;
    }

    if (ctx) {
      const trustedLabel = trustedNearestLabel(field, ctx.nearestLabel);
      field.context = {
        page: ctx.page,
        sectionHint: inferSectionHintFromField(field, ctx),
        nearestLabel: trustedLabel,
      };
    }
  }

  return fieldConfig;
}

function buildCompactFieldContextForPrompt(structuredFields, fieldConfig) {
  const contextMap = buildStructuredFieldMap(structuredFields);
  const fields = (fieldConfig?.fields || []).map((field) => {
    const ctx = contextMap.get(field.id);
    return {
      id: field.id,
      newName: field.newName,
      type: field.type,
      label: field.label,
      conditional: field.conditional || null,
      page: ctx?.page ?? null,
      sectionHint: ctx?.sectionHint ?? null,
      nearestLabel: ctx?.nearestLabel ? trustedNearestLabel(field, ctx.nearestLabel) : null,
    };
  });
  return fields;
}

module.exports = {
  sanitizeNearestLabel,
  normalizeSectionHint,
  isSectionHeaderLine,
  buildStructuredFieldMap,
  inferConditionalFromField,
  disambiguateVagueLabel,
  inferSectionHintFromField,
  enrichFieldConfig,
  buildCompactFieldContextForPrompt,
};
