/**
 * Parsing JSON that came back from a language model.
 *
 * Shared by every generator, and mirrored by the browser-side importer, so a
 * response pasted in by hand is read exactly the way an API response is.
 */

// A backslash that does not begin a legal JSON escape. Real PDF field names
// contain these - DV-110 has `FillText11\.yards`, where the period is escaped
// so it is not read as a name-hierarchy separator - and a model asked to echo
// one back will often emit `\.` instead of the required `\\.`, which makes
// JSON.parse fail with "Bad escaped character".
const LONE_BACKSLASH = /\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g;

function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Parse model JSON, repairing invalid escape sequences if the first attempt
 * fails. The repair runs only after a genuine parse error, so well-formed
 * responses are never rewritten.
 */
function extractJsonFromModelResponse(text) {
  const candidate = stripCodeFence(text);

  try {
    return JSON.parse(candidate);
  } catch (firstError) {
    const repaired = candidate.replace(LONE_BACKSLASH, '\\\\');
    if (repaired === candidate) throw firstError;

    try {
      const parsed = JSON.parse(repaired);
      console.warn('[model-json] Repaired invalid escape sequence(s) in model output');
      return parsed;
    } catch (_) {
      // The escapes were not the problem - report the original failure.
      throw firstError;
    }
  }
}

module.exports = { extractJsonFromModelResponse, stripCodeFence };
