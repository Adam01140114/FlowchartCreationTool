/**
 * Canonical PDF field names — strips erroneous transaction_* prefixes from AI output.
 */

function inferCanonicalNewName(field, structuredContext = null) {
  const id = String(field?.id || '').toLowerCase();
  let aiName = String(field?.newName || '').toLowerCase();
  const label = String(field?.label || '').toLowerCase();

  if (aiName.startsWith('transaction_')) {
    aiName = aiName.slice('transaction_'.length);
  }

  if (/morf.*__1_1/.test(id)) return 'applicant_sex_male';
  if (/morf.*__2_2/.test(id)) return 'applicant_sex_female';
  if (/morf.*__3_2/.test(id)) return 'applicant_sex_nonbinary';
  if (/\.doj\[0\]/.test(id)) return 'level_of_service_doj';
  if (/\.fbi\[0\]/.test(id)) return 'level_of_service_fbi';

  if (/\.ori\[0\]/.test(id)) return 'ori_code';
  if (/authorizedapptype/.test(id)) return 'authorized_applicant_type';
  if (/\.typeof\[0\]/.test(id)) return 'type_of_license_certification_permit';
  if (/agencyauthorized/.test(id)) return 'agency_authorized_to_receive_criminal_record_information';
  if (/mailcode\[0\]/.test(id)) return 'mail_code';
  if (/streetaddress/.test(id)) return 'agency_street_address_or_po_box';
  if (/contactname/.test(id)) return 'contact_name';
  if (/city\[0\]/.test(id)) return 'agency_city';
  if (/zip\[0\]/.test(id)) return 'agency_zip_code';
  if (/phonenum\[0\]/.test(id)) return 'contact_telephone_number';
  if (/firstname/.test(id)) return 'applicant_first_name';
  if (/suffix\[0\]/.test(id)) return 'applicant_suffix';
  if (/lastname/.test(id)) return 'applicant_last_name';
  if (/suffix\[1\]/.test(id)) return 'other_name_suffix';
  if (/\.last\[0\]/.test(id)) return 'other_name_last';
  if (/\.first\[0\]/.test(id)) return 'other_name_first';
  if (/\.dob\[0\]/.test(id)) return 'date_of_birth';
  if (/dlnumber/.test(id)) return 'drivers_license_number';
  if (/weight/.test(id)) return 'weight';
  if (/\.eye\[0\]/.test(id)) return 'eye_color';
  if (/height/.test(id)) return 'height';
  if (/hair/.test(id)) return 'hair_color';
  if (/billingnumber/.test(id)) return 'billing_number';
  if (/\.pob\[0\]/.test(id)) return 'place_of_birth';
  if (/\.ssn\[0\]/.test(id)) return 'social_security_number';
  if (/miscnumber/.test(id)) return 'miscellaneous_number';
  if (/streetorpo/.test(id)) return 'home_street_address_or_po_box';
  if (/city\[1\]/.test(id)) return 'applicant_home_city';
  if (/zip\[1\]/.test(id)) return 'applicant_home_zip_code';
  if (/datetimefield1/.test(id)) return 'applicant_signature_date';
  if (/yournumber/.test(id)) return 'oca_number';
  if (/origati/.test(id)) return 'original_ati_number';
  if (/emplname/.test(id)) return 'employer_name';
  if (/\.address\[0\]/.test(id)) return 'employer_street_address_or_po_box';
  if (/phonenum\[1\]/.test(id)) return 'employer_telephone_number';
  if (/city\[2\]/.test(id)) return 'employer_city';
  if (/zip\[2\]/.test(id)) return 'employer_zip_code';
  if (/mailcode\[1\]/.test(id)) return 'employer_mail_code';

  if (/operator|transmitting|lsid|amount.?collected|amount.?billed/.test(id + label + aiName)) {
    if (/operator/.test(id + aiName)) return 'operator_name';
    if (/transmitting/.test(id + aiName)) return 'transmitting_agency';
    if (/lsid/.test(id + aiName)) return 'lsid';
    if (/ati/.test(id + aiName) && !/origati/.test(id)) return 'processing_ati_number';
    if (/amount/.test(id + aiName)) return 'amount_collected';
  }

  return normalizeStrippedFieldName(aiName, structuredContext);
}

function normalizeStrippedFieldName(name, structuredContext = null) {
  const cleaned = String(name || '').trim().replace(/^transaction_/, '');
  if (!cleaned) return 'field';

  if (/^(ori|ori_code)$/.test(cleaned)) return 'ori_code';
  if (/^(city|state|zip)$/.test(cleaned) && structuredContext) {
    const hint = String(structuredContext.sectionHint || '').toLowerCase();
    if (/employer/.test(hint)) return `employer_${cleaned}`;
    if (/agency|contributing/.test(hint)) return cleaned === 'city' ? 'agency_city' : cleaned === 'zip' ? 'agency_zip_code' : `agency_${cleaned}`;
    if (/applicant|home/.test(hint)) return cleaned === 'city' ? 'applicant_home_city' : cleaned === 'zip' ? 'applicant_home_zip_code' : `applicant_${cleaned}`;
  }

  if (/^(first_name|last_name|suffix|middle_initial)$/.test(cleaned)) {
    return cleaned === 'suffix' ? 'applicant_suffix' : `applicant_${cleaned}`;
  }

  return cleaned;
}

function stripErroneousTransactionPrefix(newName, structuredContext = null) {
  const name = String(newName || '').trim();
  if (!name.toLowerCase().startsWith('transaction_')) return name;
  return normalizeStrippedFieldName(name.slice('transaction_'.length), structuredContext);
}

function isOperatorField(field) {
  const blob = `${field?.id || ''} ${field?.newName || ''} ${field?.label || ''}`.toLowerCase();
  return /operator|transmitting\s+agency|lsid|amount\s+collected|amount\s+billed|processing_ati/.test(blob)
    && !/applicant|employer|agency\s+authorized|ori|mail\s*code|firstname|lastname|authorized_applicant/.test(blob);
}

module.exports = {
  inferCanonicalNewName,
  stripErroneousTransactionPrefix,
  isOperatorField,
  isOperatorTransactionField: isOperatorField,
};
