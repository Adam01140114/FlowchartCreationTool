/**
 * Detect and apply linked (mirror) fields — duplicate PDF slots filled from one user answer.
 */

const SEMANTIC_PATTERNS = [
  { key: 'first_name', re: /\b(first[\s_-]?name|fname|given[\s_-]?name)\b/i },
  { key: 'last_name', re: /\b(last[\s_-]?name|lname|surname|family[\s_-]?name)\b/i },
  { key: 'middle_name', re: /\b(middle[\s_-]?name|mname)\b/i },
  { key: 'suffix', re: /\b(suffix|jr|sr)\b/i },
  { key: 'full_name', re: /\b(full[\s_-]?name|print[\s_-]?name|name[\s_-]?of[\s_-]?applicant)\b/i },
  { key: 'street', re: /\b(street|address[\s_-]?line|addr|p\.?o\.?\s*box)\b/i },
  { key: 'city', re: /\bcity\b/i },
  { key: 'state', re: /\bstate\b/i },
  { key: 'zip', re: /\b(zip|postal)\b/i },
  { key: 'phone', re: /\b(phone|telephone|tel)\b/i },
  { key: 'email', re: /\b(e[\s_-]?mail)\b/i },
  { key: 'date_of_birth', re: /\b(date[\s_-]?of[\s_-]?birth|dob|birth[\s_-]?date)\b/i },
  { key: 'ssn', re: /\b(social[\s_-]?security|ssn)\b/i },
  { key: 'signature_date', re: /\b(signature[\s_-]?date|date[\s_-]?signed)\b/i },
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripNameIdPrefixes(nameId) {
  return String(nameId || '')
    .toLowerCase()
    .replace(/^(applicant_|signature_|sig_|employer_|agency_|authorized_|confirm_|repeat_|re_|other_name_)/, '')
    .replace(/(_copy|_repeat|_duplicate|_sig|_signature|_\d+)$/, '');
}

function inferOwnershipDomain(nameId, label = '', questionText = '') {
  const blob = `${nameId || ''} ${label || ''} ${questionText || ''}`.toLowerCase();
  if (/employer/.test(blob)) return 'employer';
  if (/agency|contributing|ori|mail.?code|billing/.test(blob) && !/applicant|home/.test(blob)) {
    return 'agency';
  }
  if (/applicant|home_|your /.test(blob)) return 'applicant';
  const prefix = String(nameId || '').match(/^(agency|applicant|employer|authorized)_/i);
  if (prefix) return prefix[1].toLowerCase();
  return 'general';
}

function inferSemanticKey(nameId, label, questionText, profileKey) {
  const domain = inferOwnershipDomain(nameId, label, questionText);

  if (profileKey && String(profileKey).trim()) {
    return `${domain}:profile:${String(profileKey).trim().toLowerCase()}`;
  }

  const haystack = `${nameId} ${label} ${questionText}`;
  for (const pattern of SEMANTIC_PATTERNS) {
    if (pattern.re.test(haystack)) return `${domain}:semantic:${pattern.key}`;
  }

  const stripped = stripNameIdPrefixes(nameId);
  if (stripped) return `${domain}:nameid:${stripped}`;
  return `${domain}:nameid:${String(nameId || '').toLowerCase()}`;
}

function collectQuestionNameIds(question) {
  const ids = [];
  if (question.nameId) ids.push(question.nameId);
  for (const opt of question.options || []) {
    if (opt?.nameId) ids.push(opt.nameId);
  }
  for (const tb of question.textboxes || []) {
    if (tb?.nameId) ids.push(tb.nameId);
  }
  return ids;
}

function* iterateQuestions(formConfig) {
  for (const section of formConfig?.sections || []) {
    for (const question of section.questions || []) {
      yield question;
    }
  }
}

function buildFieldLabelMap(fieldConfig) {
  const map = new Map();
  for (const field of fieldConfig?.fields || []) {
    if (field?.newName) map.set(field.newName, field.label || field.newName);
  }
  return map;
}

function buildLinkedFieldGroups(formConfig, fieldConfig) {
  const labelMap = buildFieldLabelMap(fieldConfig);
  const groups = new Map();

  for (const question of iterateQuestions(formConfig)) {
    const nameIds = collectQuestionNameIds(question);
    for (const nameId of nameIds) {
      const label = labelMap.get(nameId) || question.placeholder || '';
      const profileKey = question.autopopulate?.enabled ? question.autopopulate.profileKey : '';
      const semanticKey = inferSemanticKey(nameId, label, question.text, profileKey);
      if (!groups.has(semanticKey)) {
        groups.set(semanticKey, []);
      }
      groups.get(semanticKey).push({
        nameId,
        question,
        label,
        questionId: question.questionId,
      });
    }
  }

  return groups;
}

function applyLinkedFields(formConfig, fieldConfig) {
  if (!formConfig?.sections) return formConfig;

  const groups = buildLinkedFieldGroups(formConfig, fieldConfig);
  const primaryByNameId = new Map();
  const linkedFieldGroups = [];

  for (const [groupKey, entries] of groups.entries()) {
    if (entries.length < 2) continue;

    const uniqueEntries = [];
    const seen = new Set();
    for (const entry of entries) {
      if (seen.has(entry.nameId)) continue;
      seen.add(entry.nameId);
      uniqueEntries.push(entry);
    }
    if (uniqueEntries.length < 2) continue;

    const primary = uniqueEntries[0];
    primaryByNameId.set(primary.nameId, primary.nameId);

    const mirrorNameIds = [];
    for (let i = 1; i < uniqueEntries.length; i += 1) {
      const mirror = uniqueEntries[i];
      mirrorNameIds.push(mirror.nameId);
      primaryByNameId.set(mirror.nameId, primary.nameId);
    }

    linkedFieldGroups.push({
      groupKey,
      primaryNameId: primary.nameId,
      primaryQuestionId: primary.questionId,
      mirrorNameIds,
    });
  }

  for (const question of iterateQuestions(formConfig)) {
    const questionNameIds = collectQuestionNameIds(question);

    for (const tb of question.textboxes || []) {
      const primary = primaryByNameId.get(tb.nameId);
      if (primary && primary !== tb.nameId) {
        tb.linkedToNameId = primary;
      } else if (tb.linkedToNameId) {
        delete tb.linkedToNameId;
      }
    }
    for (const opt of question.options || []) {
      const primary = primaryByNameId.get(opt.nameId);
      if (primary && primary !== opt.nameId) {
        opt.linkedToNameId = primary;
      } else if (opt.linkedToNameId) {
        delete opt.linkedToNameId;
      }
    }
    if (question.nameId) {
      const primary = primaryByNameId.get(question.nameId);
      if (primary && primary !== question.nameId) {
        question.linkedToNameId = primary;
      } else if (!questionNameIds.some((id) => primaryByNameId.get(id) && primaryByNameId.get(id) !== id)) {
        question.linkedToNameId = null;
      }
    }

    const isPureMirror = questionNameIds.length > 0
      && questionNameIds.every((id) => {
        const p = primaryByNameId.get(id);
        return p && p !== id;
      });
    const isPrimary = questionNameIds.some((id) => !primaryByNameId.has(id) || primaryByNameId.get(id) === id);

    if (isPureMirror) {
      question.linkedFieldRole = 'mirror';
      if (!question.linkedToNameId && questionNameIds.length === 1) {
        question.linkedToNameId = primaryByNameId.get(questionNameIds[0]);
      }
    } else if (isPrimary) {
      question.linkedFieldRole = 'primary';
      if (!question.textboxes?.some((tb) => tb.linkedToNameId) && !question.options?.some((o) => o.linkedToNameId)) {
        question.linkedToNameId = null;
      }
    } else {
      delete question.linkedFieldRole;
    }
  }

  if (linkedFieldGroups.length) {
    formConfig.linkedFieldGroups = linkedFieldGroups;
  } else if (formConfig.linkedFieldGroups) {
    delete formConfig.linkedFieldGroups;
  }

  return formConfig;
}

function buildLinkedFieldMap(formConfig) {
  const map = {};
  for (const question of iterateQuestions(formConfig)) {
    if (question.linkedToNameId && question.nameId) {
      if (!map[question.linkedToNameId]) map[question.linkedToNameId] = [];
      if (!map[question.linkedToNameId].includes(question.nameId)) {
        map[question.linkedToNameId].push(question.nameId);
      }
    }
    for (const opt of question.options || []) {
      if (opt?.linkedToNameId && opt.nameId) {
        if (!map[opt.linkedToNameId]) map[opt.linkedToNameId] = [];
        if (!map[opt.linkedToNameId].includes(opt.nameId)) {
          map[opt.linkedToNameId].push(opt.nameId);
        }
      }
    }
    for (const tb of question.textboxes || []) {
      if (tb?.linkedToNameId && tb.nameId) {
        if (!map[tb.linkedToNameId]) map[tb.linkedToNameId] = [];
        if (!map[tb.linkedToNameId].includes(tb.nameId)) {
          map[tb.linkedToNameId].push(tb.nameId);
        }
      }
    }
  }
  return map;
}

function isLinkedMirrorQuestion(question) {
  if (question?.linkedFieldRole === 'mirror') return true;
  if (question?.linkedToNameId) return true;
  const tbs = question?.textboxes || [];
  if (tbs.length > 0 && tbs.every((tb) => tb.linkedToNameId)) return true;
  const opts = question?.options || [];
  if (opts.length > 0 && opts.every((opt) => opt.linkedToNameId)) return true;
  return false;
}

module.exports = {
  applyLinkedFields,
  buildLinkedFieldMap,
  isLinkedMirrorQuestion,
  inferSemanticKey,
};
