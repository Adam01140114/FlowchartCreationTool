/**
 * Shared question text, label resolution, and explanation helpers
 * for field_config and form_config generation.
 */

const { inferFieldDomain, getDomainWording } = require('./field-domain');

const FIELD_ACRONYMS = new Set(['ati', 'oca', 'ori', 'doj', 'fbi', 'ssn', 'zip', 'cdl']);

const VAGUE_LABELS = new Set([
  'number', 'your number', 'code', 'your code', 'id', 'your id',
  'misc number', 'misc. number', 'identifier', 'city', 'zip code', 'zip', 'state',
]);

const GENERIC_LABEL_WORDS = new Set([
  'applicant', 'agency', 'employer', 'information', 'number', 'code', 'type',
  'address', 'street', 'city', 'state', 'zip', 'telephone', 'phone', 'contact',
  'name', 'date', 'field', 'other', 'the', 'and', 'for', 'your', 'section',
]);

const SECTION_HEADER_LABEL_PATTERNS = [
  /^applicant\s+information$/i,
  /^contributing\s+agency\s+information$/i,
  /^employer\s+information$/i,
  /^applicant\s+submission$/i,
  /^service\s+level$/i,
  /^level\s+of\s+service$/i,
  /^signature\s+and\s+privacy$/i,
  /^live\s+scan\s+transaction\s+completed$/i,
];

const GARBAGE_LABEL_PATTERNS = [
  /page\s*\d+\s*of\s*\d+/gi,
  /state\s+of\s+[a-z]+/gi,
  /department\s+of\s+justice/gi,
  /request\s+for\s+live\s+scan/gi,
  /applicant\s+submission/gi,
  /\bpage\s*\d+\b/gi,
  /\(rev\.\s*\d+\/\d+\)/gi,
  /bcia\s*\d+/gi,
];

function titleCaseWord(word) {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatFieldNameAsLabel(newName) {
  if (!newName) return '';
  return String(newName)
    .split('_')
    .filter(Boolean)
    .map((word) => (FIELD_ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : titleCaseWord(word)))
    .join(' ');
}

function isGarbageText(text) {
  const normalized = String(text || '').trim();
  return !normalized
    || normalized.length > 80
    || /page\s*\d/i.test(normalized)
    || /department\s+of\s+justice/i.test(normalized)
    || /state\s+of\s+/i.test(normalized)
    || /request\s+for\s+/i.test(normalized)
    || /bcia\s*\d/i.test(normalized);
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

function isVagueLabel(label) {
  const normalized = String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return !normalized || VAGUE_LABELS.has(normalized);
}

function isSectionHeaderLabel(label) {
  const normalized = String(label || '').trim();
  if (!normalized) return false;
  return SECTION_HEADER_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function significantTokensFromField(field) {
  const fromName = String(field?.newName || '')
    .split('_')
    .map((part) => part.toLowerCase())
    .filter(Boolean);
  const idMatches = String(field?.id || '').match(/[A-Za-z][A-Za-z0-9]*/g) || [];
  const fromId = idMatches.map((part) => part.toLowerCase());
  return [...new Set([...fromName, ...fromId])]
    .filter((token) => token.length > 1 && !GENERIC_LABEL_WORDS.has(token));
}

function significantTokensFromLabel(label) {
  return String(label || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !GENERIC_LABEL_WORDS.has(token));
}

function tokensOverlap(nameTokens, labelTokens) {
  if (!nameTokens.length) return true;
  if (!labelTokens.length) return false;
  return nameTokens.some((nameToken) => labelTokens.some((labelToken) => (
    labelToken.includes(nameToken)
    || nameToken.includes(labelToken)
    || labelToken.replace(/s$/, '') === nameToken.replace(/s$/, '')
  )));
}

function labelAlignsWithField(field, label) {
  const configLabel = String(field?.label || '').trim().toLowerCase();
  const testLabel = String(label || '').trim().toLowerCase();
  if (!testLabel) return false;
  if (isSectionHeaderLabel(label)) return false;

  if (configLabel) {
    if (testLabel === configLabel) return true;
    // Checkbox options are short, mutually exclusive labels — never borrow a neighbor's
    // PDF proximity label (e.g. "C corporation" for an S-corporation field).
    if (field?.type === 'checkbox') {
      return configLabel.includes(testLabel) || testLabel.includes(configLabel);
    }
    if (configLabel.includes(testLabel) || testLabel.includes(configLabel)) return true;
  }

  const nameTokens = significantTokensFromField(field);
  const labelTokens = significantTokensFromLabel(label);
  return tokensOverlap(nameTokens, labelTokens);
}

function questionTextMatchesField(questionText, field, resolvedLabel) {
  const text = String(questionText || '').trim().toLowerCase();
  const label = String(resolvedLabel || '').trim().toLowerCase();
  if (!text || !label) return true;

  const labelWords = label.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  if (!labelWords.length) return true;
  return labelWords.some((word) => text.includes(word));
}

function extractLabelFromDocument(field, extractedDocumentContent) {
  const doc = String(extractedDocumentContent || '');
  const fieldId = field?.id;
  if (!doc || !fieldId) return '';

  const marker = field.type === 'checkbox' ? `{{${fieldId}}}` : `[[${fieldId}]]`;
  const idx = doc.indexOf(marker);
  if (idx < 0) return '';

  const before = doc.slice(Math.max(0, idx - 120), idx);
  const lines = before.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || before.trim();
  const match = lastLine.match(/([A-Za-z][A-Za-z0-9\s.,\-/()]{1,48})$/);
  const raw = match ? match[1].trim().replace(/\s+/g, ' ') : '';
  return sanitizeFieldLabel(raw, field?.newName);
}

function resolveSpecificFieldLabel(field, extractedDocumentContent = '', structuredContext = null) {
  const configLabel = sanitizeFieldLabel(field?.label, field?.newName);
  const configIsGood = configLabel && !isVagueLabel(configLabel) && !isGarbageText(configLabel);

  const ctxRaw = structuredContext?.nearestLabel || structuredContext?.sanitizedLabel;
  const ctxLabel = ctxRaw ? sanitizeFieldLabel(ctxRaw, field?.newName) : '';
  const ctxIsGood = ctxLabel
    && !isVagueLabel(ctxLabel)
    && !isGarbageText(ctxLabel)
    && !isSectionHeaderLabel(ctxLabel);
  const ctxAligns = ctxIsGood && labelAlignsWithField(field, ctxLabel);

  if (configIsGood && !ctxAligns) return configLabel;
  if (ctxAligns && ctxLabel.length >= (configLabel || '').length) return ctxLabel;
  if (configIsGood) return configLabel;

  const docLabel = extractLabelFromDocument(field, extractedDocumentContent);
  if (docLabel && !isVagueLabel(docLabel) && !isGarbageText(docLabel) && labelAlignsWithField(field, docLabel)) {
    return docLabel;
  }

  const domain = inferFieldDomain(field);
  const fromName = formatFieldNameAsLabel(field?.newName);
  if (fromName && !isVagueLabel(fromName)) {
    if (domain === 'Agency' && /^city$/i.test(fromName)) return 'Agency City';
    if (domain === 'Agency' && /^state$/i.test(fromName)) return 'Agency State';
    if (domain === 'Agency' && /zip/i.test(fromName)) return 'Agency ZIP Code';
    if (domain === 'Applicant' && /home.*city/i.test(field?.newName || '')) return 'Home City';
    if (domain === 'Employer' && /^city$/i.test(fromName)) return 'Employer City';
    return fromName;
  }

  return configLabel || docLabel || fromName;
}

function simplifyLabelForQuestion(label, field) {
  let text = String(label || '').trim().replace(/\s+/g, ' ');
  const name = String(field?.newName || '').toLowerCase();
  if (!text) return text;

  if (/your_number|oca_number|applicant_number/.test(name) || /^your number$/i.test(text)) return 'OCA number';
  if (/\bbilling\b/i.test(name) || /billing/i.test(text)) return 'billing number';
  if (/\bori\b/i.test(text)) return 'ORI code';
  if (/\boca\b/i.test(text)) return 'OCA number';
  if (/\bati\b/i.test(text) && /original/i.test(text + name)) return 'original ATI number';
  if (/mail\s*code/i.test(text)) return 'mail code';
  if (/name of entity\/individual|entity\/individual/i.test(text + name)) {
    return 'name as shown on your tax return';
  }
  if (/business name.*disregarded|disregarded entity name/i.test(text + name)) {
    return 'business name or disregarded entity name (if different from above)';
  }
  if (/exempt payee code/i.test(text + name)) return 'exempt payee code';
  if (/fatca reporting code/i.test(text + name)) return 'FATCA reporting code';
  if (/taxpayer identification number|^tin$/i.test(text + name)) return 'taxpayer identification number (TIN)';
  if (/employer identification number|^ein$/i.test(text + name)) return 'employer identification number (EIN)';
  if (/tax classification code|classif.*owner|llc.*owner/i.test(text + name)) {
    return 'LLC tax classification letter (C, S, or P)';
  }
  if (/other tax classification/i.test(text + name)) return 'other tax classification (specify)';
  if (/list account number|account number.*here/i.test(text + name)) return 'account number(s) for this request (optional)';
  if (/other tin|other taxpayer/i.test(text + name)) return 'other taxpayer identification number';
  if (/additional name information/i.test(text + name)) return 'additional name or DBA (if applicable)';
  if (/other_name_first|other_first_name/.test(name)) return 'other first name (alias)';
  if (/other_name_last|other_last_name/.test(name)) return 'other last name (alias)';
  if (/other_name_suffix|suffix.*alias/.test(name + text)) return 'suffix for your alias name';
  if (/requester.*name.*number|name and number.*requester/i.test(text + name)) {
    return 'name and number to give the requester';
  }
  if (/^name for ssn$/i.test(text) || /name_for_ssn/.test(name)) {
    return 'name associated with this Social Security number';
  }

  // Inline short distinguishing parentheticals ("Senior (Self) Amount" vs "(Spouse)")
  // instead of dropping them — otherwise sibling fields collapse into duplicate questions.
  text = text
    .replace(/\s*\(([^)]*)\)\s*/g, (match, inner) => {
      const qualifier = String(inner || '').trim();
      if (!qualifier || /^(if any|if applicable|optional|see instructions?|\d{4})$/i.test(qualifier)) {
        return ' ';
      }
      if (qualifier.split(/\s+/).length <= 2 && /^[a-z0-9\s'-]+$/i.test(qualifier)) {
        return ` ${qualifier} `;
      }
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function formatLabelForQuestionPhrase(label) {
  return String(label || '')
    .replace(/\b(ori|oca|ati|doj|fbi|ssn|zip|cdl|ein|tin|fatca|llc|dba)\b/gi, (match) => match.toUpperCase());
}

/** Lowercase for sentence flow, then restore known acronyms. */
function phraseForQuestion(label) {
  return formatLabelForQuestionPhrase(String(label || '').toLowerCase());
}

function buildPossessiveQuestion(possessive, label, domain) {
  let phrase = phraseForQuestion(label).replace(/\?+$/, '').trim();
  if (!phrase) return 'Please provide this information.';

  // Avoid "the contributing agency's agency …" / "your employer's employer …"
  if (domain === 'Agency' && /^agency\b/.test(phrase)) {
    const rest = phrase.replace(/^agency\s+/, '');
    if (/^(authorized|responsible|designated|named)\b/.test(rest)) {
      return `What is the name of the agency ${rest}?`;
    }
    return `What is ${possessive} ${rest}?`;
  }
  if (domain === 'Employer' && /^employer\b/.test(phrase)) {
    const rest = phrase.replace(/^employer\s+/, '');
    return `What is ${possessive} ${rest}?`;
  }

  return `What is ${possessive} ${phrase}?`;
}

function buildQuestionTextForField(field, extractedDocumentContent = '', structuredContext = null) {
  const domain = inferFieldDomain(field);
  const wording = getDomainWording(domain);
  const rawLabel = resolveSpecificFieldLabel(field, extractedDocumentContent, structuredContext);
  const label = simplifyLabelForQuestion(rawLabel, field);
  if (!label) return 'Please provide this information.';

  const name = String(field?.newName || '').toLowerCase();

  // Tracking / submission IDs before domain wording — Agency domain would otherwise
  // turn "Your Number" into a vague "contributing agency's applicant number".
  if (
    /your_number|oca_number/.test(name)
    || /^your number$/i.test(label)
    || /^oca number$/i.test(label)
  ) {
    return 'What is the OCA number for this submission?';
  }
  if (/original_ati/.test(name)) {
    return 'What is your original ATI number?';
  }
  if (/billing_number/.test(name)) {
    return "What is the contributing agency's billing number?";
  }

  if (/employer identification number|\bein\b/i.test(label) && !/^employer_/.test(name)) {
    return 'What is your employer identification number (EIN)?';
  }
  if (/taxpayer identification number/i.test(label) && !/other/.test(name)) {
    return 'What is your taxpayer identification number (TIN)?';
  }

  if (domain === 'Agency') {
    if (/^what is/i.test(label)) {
      return formatLabelForQuestionPhrase(
        label.replace(/\byour\b/gi, "the contributing agency's").replace(/\?\?+/g, '?')
      ).replace(/([^.?])$/, '$1?');
    }
    return buildPossessiveQuestion(wording.possessive, label, 'Agency');
  }
  if (domain === 'Employer') {
    return buildPossessiveQuestion(wording.possessive, label, 'Employer');
  }
  if (domain === 'Operator') {
    return buildPossessiveQuestion(wording.possessive, label, 'Operator');
  }

  if (/tax_classification_code|llc.*classif/.test(name)) {
    return 'What is the tax classification of the LLC owner (C, S, or P)?';
  }
  if (name === 'tax_classification_other' || /tax_classification_other$/.test(name)) {
    return 'What is your other tax classification?';
  }
  if (/optional_requester|requester.*name and address|name and address.*optional/.test(name + label)) {
    return "What is the requester's name and address (optional)?";
  }
  if (/name_for_ein|name and number to give the requester/i.test(name + label)) {
    return 'What name and number should you give the requester?';
  }
  if (/name_for_ssn|^name for ssn$/i.test(name + label)) {
    return 'What name is associated with this Social Security number?';
  }
  if (/name.*requester|requester.*name/.test(name + label) && !/optional_requester|name_for_ein/.test(name)) {
    return 'What is the name and phone number of the person to contact about this form?';
  }

  if (/^(what|when|where|who|how|is|are|do|does|please)\b/i.test(label)) {
    return label.endsWith('?') ? formatLabelForQuestionPhrase(label) : `${formatLabelForQuestionPhrase(label)}?`;
  }
  if (/^your\s+/i.test(label)) {
    const withQuestion = label.endsWith('?') ? label : `${label}?`;
    return formatLabelForQuestionPhrase(withQuestion.replace(/\byour\s+your\b/gi, 'your'));
  }
  if (/^(ORI|OCA|ATI)\s/i.test(label) || /ori code|oca number|ati number/i.test(label)) {
    return `What is your ${formatLabelForQuestionPhrase(label)}?`.replace(/\byour\s+your\b/gi, 'your');
  }
  return `What is your ${phraseForQuestion(label)}?`.replace(/\byour\s+your\b/gi, 'your');
}

function buildAddressQuestionText(domain, field = null) {
  if (domain === 'Agency') return 'What is the contributing agency\'s address?';
  if (domain === 'Employer') return 'What is your employer\'s address?';
  const blob = `${field?.newName || ''} ${field?.label || ''}`.toLowerCase();
  if (/home/.test(blob)) return 'What is your home address?';
  return 'What is your address?';
}

function buildExplanationForQuestion(question, field, extractedDocumentContent = '', structuredContext = null) {
  const domain = inferFieldDomain(field);
  const wording = getDomainWording(domain);
  const rawLabel = resolveSpecificFieldLabel(field, extractedDocumentContent, structuredContext);
  const friendlyLabel = simplifyLabelForQuestion(rawLabel, field)
    || String(question?.text || '').replace(/\?+$/, '').replace(/^what is (your|the[^?]+'?s?)\s+/i, '');
  const label = friendlyLabel;
  const nameBlob = `${field?.newName || ''} ${rawLabel} ${friendlyLabel}`.toLowerCase();

  if (/tax_classification_code|llc.*classif/.test(nameBlob)) {
    return 'If you checked LLC above, enter C for corporation, S for S corporation, or P for partnership — the tax classification of the LLC owner shown on the W-9.';
  }
  if (/other tax classification|tax_classification_other/.test(nameBlob)) {
    return 'Only complete this if you selected "Other" for federal tax classification. Enter the classification exactly as it should appear on the form.';
  }
  if (/name as shown on your tax return|taxpayer_name|entity\/individual/.test(nameBlob)) {
    return 'Enter the name exactly as it appears on your income tax return. For individuals, use your legal name; for entities, use the registered business name.';
  }
  if (/business name.*disregarded|disregarded entity/.test(nameBlob)) {
    return 'Enter your business name or disregarded entity name if it differs from the name on line 1. Leave blank if the same.';
  }
  if (/exempt payee code/.test(nameBlob)) {
    return 'Enter an exempt payee code only if you are exempt from backup withholding under IRS rules. Most individuals leave this blank.';
  }
  if (/fatca reporting code/.test(nameBlob)) {
    return 'Enter a FATCA reporting code only if you are exempt from FATCA reporting. Most individuals leave this blank.';
  }
  if (/taxpayer identification number|\btin\b/.test(nameBlob) && !/other tin/.test(nameBlob)) {
    return 'Enter your taxpayer identification number (SSN for individuals, EIN for businesses) exactly as it should appear on the W-9.';
  }
  if (/employer identification number|\bein\b/.test(nameBlob)) {
    return 'Enter the employer identification number (EIN) for the business entity, if applicable.';
  }
  if (/foreign partner/.test(nameBlob)) {
    return 'Check this box if the entity has foreign partners, owners, or beneficiaries that may require special reporting.';
  }
  if (/alias|aka|other_(first|last|middle)_name/.test(nameBlob)) {
    return 'Enter any alias or other name you have used, if different from your legal name. This appears in the Applicant Information section of the form.';
  }
  if (/mail.?code/i.test(nameBlob)) {
    if (domain === 'Employer') {
      return 'Enter the five-digit mail code assigned to your employer by the Department of Justice. This is in the Employer section — not the agency mail code.';
    }
    return 'Enter the five-digit mail code assigned to the contributing agency by the Department of Justice. This is in the Contributing Agency Information section — not your personal address.';
  }
  if (/\bori\b/i.test(nameBlob)) {
    return 'Enter the ORI (Originating Agency Identifier) code assigned to the contributing agency by the DOJ. This identifies the agency submitting the live scan — not your personal information.';
  }
  if (/\boca\b|yournumber|your number/i.test(nameBlob)) {
    return 'Enter your OCA (Operator Control Agency) number — the agency identifying number for this submission. This is about the agency\'s tracking number, not your home address.';
  }
  if (/\bati\b/i.test(nameBlob) && /original/i.test(nameBlob)) {
    return 'If you are resubmitting, enter the ATI number from your original live scan submission. You must provide proof of rejection.';
  }
  if (/street|address|p\.?o\.?\s*box/i.test(nameBlob)) {
    if (domain === 'Agency') {
      return `This asks for ${wording.subject}'s street address or P.O. Box — not ${wording.notWho} home address. Find it in the "${wording.pdfSection}" section on the PDF.`;
    }
    if (domain === 'Employer') {
      return `This asks for ${wording.subject}'s street address or P.O. Box — not your personal home address unless you live at your workplace. See the Employer section on the PDF.`;
    }
    return 'Enter your home street address or P.O. Box as the applicant. This is your personal residence — not the agency or employer address.';
  }
  if (/\bcity\b/i.test(nameBlob)) {
    if (domain === 'Agency') return 'Enter the city for the contributing agency\'s address — not your home city.';
    if (domain === 'Employer') return 'Enter the city where your employer is located — not your home city.';
    return 'Enter the city for your home address as the applicant.';
  }
  if (/\bstate\b/i.test(nameBlob) || /\bzip\b/i.test(nameBlob)) {
    if (domain === 'Agency') return `Enter the state and ZIP for ${wording.subject}'s address in the Contributing Agency Information section.`;
    if (domain === 'Employer') return `Enter the state and ZIP for ${wording.subject}'s address in the Employer section.`;
    return 'Enter the state and ZIP for your home address as the applicant.';
  }
  if (/contact.*phone|telephone|phone/i.test(nameBlob)) {
    if (domain === 'Agency') return 'Enter the contact telephone number for the contributing agency — the person who can be reached about this submission.';
    if (domain === 'Employer') return 'Enter your employer\'s telephone number (optional on the PDF).';
    return 'Enter a phone number where you can be reached about this application.';
  }
  if (/authorized.*applicant/i.test(nameBlob)) {
    return 'Enter the authorized applicant type code for this submission, as assigned or required by the DOJ for your agency\'s live scan category.';
  }
  if (/type.*license|working title/i.test(nameBlob)) {
    return 'Enter the type of license, certification, permit, or working title (maximum 30 characters). Use the exact title assigned by the DOJ if applicable.';
  }
  if (question?.autoTodayDate) {
    return 'This date is automatically set to today\'s date for your convenience.';
  }
  if (question?.type === 'date') {
    return `Enter ${wording.who === 'you' ? 'your' : wording.possessive} ${label.toLowerCase()} as shown on official records. Use MM/DD/YYYY.`;
  }
  if (question?.type === 'phone') {
    return `Enter a phone number for ${wording.subject} regarding ${label.toLowerCase()}.`;
  }
  if (question?.type === 'checkbox') {
    if (/sex|male|female|nonbinary|gender/i.test(nameBlob)) {
      return 'Select the option that best describes your sex as required in the Applicant Information section.';
    }
    if (/doj|fbi|level.?of.?service/i.test(nameBlob)) {
      return 'Select whether this submission requires DOJ, FBI, or both levels of service. If FBI is selected, fingerprints will be checked against FBI records.';
    }
    return 'Select the option or options that best apply to your situation.';
  }
  if (question?.type === 'dropdown' && !question?.nameId) {
    return 'Choose Yes or No to determine whether the following question applies to you.';
  }
  if (question?.type === 'multipleTextboxes') {
    const qDomain = question._addressDomain || domain;
    const qWording = getDomainWording(qDomain);
    if (qDomain === 'Agency') {
      return `Enter the complete address for ${qWording.subject} — street or P.O. Box, city, state, and ZIP. This is not your personal home address.`;
    }
    if (qDomain === 'Employer') {
      return `Enter the complete address for ${qWording.subject} — street or P.O. Box, city, state, and ZIP.`;
    }
    return 'Enter your complete home address — street or P.O. Box, city, state, and ZIP — as the applicant.';
  }

  if (domain === 'Agency') {
    return `Enter ${wording.possessive} ${label.toLowerCase()} exactly as it should appear in the "${wording.pdfSection}" section on the PDF. This is about ${wording.subject}, not about you personally.`;
  }
  if (domain === 'Employer') {
    return `Enter ${wording.possessive} ${label.toLowerCase()} for the Employer section on the PDF.`;
  }
  return `Enter your ${label.toLowerCase()} exactly as it should appear on the completed form in the ${wording.pdfSection} section.`;
}

module.exports = {
  FIELD_ACRONYMS,
  VAGUE_LABELS,
  GENERIC_LABEL_WORDS,
  GARBAGE_LABEL_PATTERNS,
  titleCaseWord,
  formatFieldNameAsLabel,
  isGarbageText,
  sanitizeFieldLabel,
  isVagueLabel,
  isSectionHeaderLabel,
  labelAlignsWithField,
  questionTextMatchesField,
  extractLabelFromDocument,
  resolveSpecificFieldLabel,
  buildQuestionTextForField,
  buildExplanationForQuestion,
  buildAddressQuestionText,
};
