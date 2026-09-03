/**
 * Validation entry point for form_config quality.
 * Does NOT rewrite AI/reviewer output — defects are reported for the AI revise loop.
 */

const {
  validateQuestionTextQuality,
  validatePdfCombineRules,
  validateAddressStateMapping,
  validateUniqueSectionNames,
  qualityFailuresToReviewIssues,
  trustedStructuredContext,
} = require('./form-config-quality');
const {
  validatePresenceOptionalGates,
} = require('./form-conditional-logic');

function validateFullQuality(formConfig, fieldConfig, payload = {}) {
  const textQuality = validateQuestionTextQuality(formConfig, fieldConfig, payload);
  const presence = validatePresenceOptionalGates(formConfig, fieldConfig);
  const combine = validatePdfCombineRules(formConfig, fieldConfig);
  const addressState = validateAddressStateMapping(formConfig, fieldConfig);
  const sections = validateUniqueSectionNames(formConfig);
  return {
    failures: [
      ...textQuality.failures,
      ...presence.failures,
      ...combine.failures,
      ...addressState.failures,
      ...sections.failures,
    ],
    warnings: [
      ...textQuality.warnings,
      ...(presence.warnings || []),
      ...(combine.warnings || []),
      ...(addressState.warnings || []),
    ],
    ok: textQuality.failures.length
      + presence.failures.length
      + combine.failures.length
      + addressState.failures.length
      + sections.failures.length === 0,
  };
}

module.exports = {
  validateFullQuality,
  qualityFailuresToReviewIssues,
  trustedStructuredContext,
};
