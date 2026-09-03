const PROFILE_KEY_ALIASES = {
  applicant_first_name: ['firstName', 'first_name'],
  applicant_last_name: ['lastName', 'last_name'],
  other_first_name: ['otherFirstName', 'alias_first_name', 'other_first_name'],
  other_last_name: ['otherLastName', 'alias_last_name', 'other_last_name'],
  street_address: ['street', 'home_street', 'address_street', 'agency_street'],
  home_street_address: ['street', 'home_street', 'home_street_address'],
  agency_city: ['city', 'agency_city'],
  home_city: ['city', 'home_city'],
  applicant_home_city: ['city', 'home_city', 'applicant_home_city'],
  employer_city: ['city', 'employer_city'],
  agency_zip_code: ['zip', 'zipCode', 'postal_code', 'agency_zip'],
  home_zip_code: ['zip', 'zipCode', 'home_zip'],
  applicant_home_zip_code: ['zip', 'zipCode', 'home_zip', 'applicant_home_zip_code'],
  employer_zip_code: ['zip', 'zipCode', 'employer_zip'],
  contact_telephone_number: ['phone', 'telephone', 'contact_phone_number'],
  employer_telephone_number: ['phone', 'employer_phone', 'employer_phone_number'],
  employer_phone_number: ['phone', 'employer_phone', 'employer_telephone_number'],
  social_security_number: ['ssn', 'social_security_number'],
  date_of_birth: ['dateOfBirth', 'dob', 'birth_date'],
  drivers_license_number: ['driversLicense', 'drivers_license', 'drivers_license_number'],
  hair_color: ['hair_color', 'hairColor', 'hair'],
  eye_color: ['eye_color', 'eyeColor', 'eye'],
  height: ['height'],
  weight: ['weight'],
  place_of_birth: ['place_of_birth', 'placeOfBirth', 'pob'],
  misc_number: ['misc_number', 'miscNumber'],
  email: ['email'],
  signature: ['signature'],
  applicant_signature: ['signature'],
  applicant_signature_date: ['signature_date', 'applicant_signature_date'],
  employer_name: ['employer_name', 'employerName'],
  employer_street_address: ['employer_street', 'employer_street_address', 'employer_address'],
  employer_mail_code: ['employer_mail_code'],
  applicant_suffix_0: ['suffix', 'applicant_suffix'],
  applicant_suffix_1: ['suffix', 'applicant_suffix_1'],
};

const NON_AUTOPOPULATE_PATTERNS = [
  /^ori_code$/i,
  /^mail_code$/i,
  /billing_number/i,
  /^your_number$/i,
  /original_ati/i,
  /^agency_authorized$/i,
  /^authorized_applicant_type$/i,
  /^type_of_license$/i,
  /^level_of_service/i,
  /^contact_name$/i,
  /operator/i,
  /amount_collected/i,
  /transmitting_agency/i,
  /lsid/i,
  /ati_number/i,
];

function isLikelyAutopopulatableField(field) {
  const name = field?.newName || '';
  if (!name) return false;
  if (NON_AUTOPOPULATE_PATTERNS.some((pattern) => pattern.test(name))) return false;

  if (field.type === 'checkbox') {
    if (/sex|male|female|nonbinary|morf/i.test(name)) return true;
    return false;
  }

  return /applicant|home_|employer_|other_|hair|eye|height|weight|dob|birth|ssn|social|driver|license|phone|street|city|zip|state|suffix|first|last|pob|place_of_birth|misc_number|signature|contact_telephone|employer_phone|employer_street|employer_city|employer_zip|employer_name|emplname|contact_phone/i.test(name);
}

function defaultProfileKey(newName) {
  const map = {
    applicant_first_name: 'firstName',
    applicant_last_name: 'lastName',
    home_street_address: 'street',
    street_address: 'street',
    agency_city: 'city',
    home_city: 'city',
    applicant_home_city: 'city',
    agency_zip_code: 'zip',
    home_zip_code: 'zip',
    applicant_home_zip_code: 'zip',
    contact_telephone_number: 'phone',
    employer_telephone_number: 'phone',
    employer_phone_number: 'phone',
  };
  return map[newName] || newName;
}

function defaultProfileDescription(field) {
  return field.label || `User's ${field.newName.replace(/_/g, ' ')}`;
}

function findBlocksByNameId(formConfig, nameId, found = []) {
  for (const section of formConfig.sections || []) {
    for (const question of section.questions || []) {
      if (question.nameId === nameId) {
        found.push({ block: question, questionText: question.text });
      }
      for (const tb of question.textboxes || []) {
        if (tb.nameId === nameId) {
          found.push({
            block: tb,
            questionText: `${question.text} — ${tb.label || tb.nameId}`,
          });
        }
      }
      for (const opt of question.options || []) {
        if (opt.nameId === nameId) {
          found.push({
            block: opt,
            questionText: `${question.text} — ${opt.label || opt.nameId}`,
          });
        }
      }
    }
  }
  return found;
}

function ensureAutopopulateOnFormConfig(formConfig, fieldConfig) {
  const config = JSON.parse(JSON.stringify(formConfig));

  for (const field of fieldConfig?.fields || []) {
    if (!isLikelyAutopopulatableField(field)) continue;

    const matches = findBlocksByNameId(config, field.newName);
    if (!matches.length) continue;

    for (const { block } of matches) {
      block.autopopulate = {
        enabled: true,
        profileKey: block.autopopulate?.profileKey || defaultProfileKey(field.newName),
        profileDescription: block.autopopulate?.profileDescription || defaultProfileDescription(field),
      };
    }
  }

  return config;
}

function isEmptyProfileValue(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function getProfileValue(profile, profileKey, nameId) {
  if (!profile || typeof profile !== 'object') return undefined;

  const keysToTry = new Set([profileKey]);
  if (nameId) {
    (PROFILE_KEY_ALIASES[nameId] || []).forEach((k) => keysToTry.add(k));
  }
  (PROFILE_KEY_ALIASES[profileKey] || []).forEach((k) => keysToTry.add(k));

  for (const key of keysToTry) {
    if (!key) continue;
    const val = profile[key];
    if (!isEmptyProfileValue(val)) return val;
  }

  return undefined;
}

function enrichAutopopulateBlock(block, profile, summary, context) {
  if (!block?.autopopulate?.enabled) return;

  const { profileKey, profileDescription } = block.autopopulate;
  const nameId = block.nameId || context.nameId || '';
  const value = getProfileValue(profile, profileKey, nameId);

  block.autopopulate.availableInProfile = !isEmptyProfileValue(value);
  if (block.autopopulate.availableInProfile) {
    block.autopopulate.currentProfileValue = value;
  } else {
    delete block.autopopulate.currentProfileValue;
  }

  summary.push({
    questionText: context.questionText || block.label || nameId,
    nameId: nameId || profileKey,
    profileKey,
    profileDescription: profileDescription || '',
    availableInProfile: block.autopopulate.availableInProfile,
    currentProfileValue: block.autopopulate.availableInProfile ? value : null,
  });
}

function walkQuestionsForAutopopulate(formConfig, profile) {
  const summary = [];

  for (const section of formConfig.sections || []) {
    for (const question of section.questions || []) {
      const context = {
        questionText: question.text,
        nameId: question.nameId,
      };

      enrichAutopopulateBlock(question, profile, summary, context);

      if (Array.isArray(question.textboxes)) {
        for (const tb of question.textboxes) {
          enrichAutopopulateBlock(tb, profile, summary, {
            questionText: `${question.text} — ${tb.label || tb.nameId}`,
            nameId: tb.nameId,
          });
        }
      }

      if (Array.isArray(question.options)) {
        for (const opt of question.options) {
          if (!opt.autopopulate?.enabled) continue;
          enrichAutopopulateBlock(opt, profile, summary, {
            questionText: `${question.text} — ${opt.label || opt.nameId}`,
            nameId: opt.nameId,
          });
        }
      }
    }
  }

  return summary;
}

function enrichFormConfigAutopopulate(formConfig, userProfile = {}, displayMode = 'all_at_once', fieldConfig = null) {
  let config = JSON.parse(JSON.stringify(formConfig));
  config.displayMode = displayMode || config.displayMode || 'all_at_once';

  if (fieldConfig) {
    config = ensureAutopopulateOnFormConfig(config, fieldConfig);
  }

  config.autopopulateFields = walkQuestionsForAutopopulate(config, userProfile || {});
  config.autopopulateAvailable = config.autopopulateFields.filter((f) => f.availableInProfile);
  config.autopopulateMissing = config.autopopulateFields.filter((f) => !f.availableInProfile);

  return config;
}

module.exports = {
  enrichFormConfigAutopopulate,
  ensureAutopopulateOnFormConfig,
  isLikelyAutopopulatableField,
  getProfileValue,
  PROFILE_KEY_ALIASES,
};
