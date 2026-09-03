/**
 * Explicit approval gate for the endpoints that spend money.
 *
 * Every AI route is refused until the operator arms it from the UI, so no code
 * path - including ones added later - can reach the Claude API on its own. One
 * arming covers a single pipeline run: it carries a call budget and a deadline,
 * and is dropped as soon as either runs out.
 */

const crypto = require('crypto');

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_CALLS = 12;
const MAX_ALLOWED_CALLS = 50;

// At most one run is armed at a time; arming again replaces the previous run.
let current = null;

function isLive(approval) {
  return Boolean(approval)
    && approval.expiresAt > Date.now()
    && approval.callsUsed < approval.maxCalls;
}

function arm({ reason, maxCalls, ttlMs } = {}) {
  const budget = Math.min(Number(maxCalls) || DEFAULT_MAX_CALLS, MAX_ALLOWED_CALLS);
  const ttl = Number(ttlMs) || DEFAULT_TTL_MS;

  current = {
    token: crypto.randomBytes(24).toString('hex'),
    reason: String(reason || 'automatic processing').slice(0, 200),
    expiresAt: Date.now() + ttl,
    maxCalls: Math.max(1, budget),
    callsUsed: 0,
  };

  console.log(
    `[ai-approval] Armed for "${current.reason}" - up to ${current.maxCalls} call(s), `
    + `expires in ${Math.round(ttl / 1000)}s`
  );

  return {
    token: current.token,
    expiresAt: current.expiresAt,
    maxCalls: current.maxCalls,
  };
}

function disarm(why) {
  if (current) {
    console.log(`[ai-approval] Disarmed (${why}) after ${current.callsUsed} call(s)`);
  }
  current = null;
}

function status() {
  if (!isLive(current)) {
    current = null;
    return { armed: false };
  }
  // Deliberately does not echo the token - only the arming response carries it.
  return {
    armed: true,
    reason: current.reason,
    expiresAt: current.expiresAt,
    maxCalls: current.maxCalls,
    callsUsed: current.callsUsed,
  };
}

/**
 * Refuse anything that would cost money unless the operator armed this run and
 * the caller carries that run's token.
 */
function requireAiApproval(req, res, next) {
  if (!isLive(current)) {
    disarm('expired or spent');
    return res.status(403).json({
      success: false,
      code: 'ai_not_armed',
      error: 'No API call was made. Click "Automatic processing" to approve this run first.',
    });
  }

  const token = String(req.get('x-ai-approval') || (req.body && req.body.aiApproval) || '');
  if (token !== current.token) {
    return res.status(403).json({
      success: false,
      code: 'ai_approval_mismatch',
      error: 'No API call was made. This request did not carry the current run\'s approval token.',
    });
  }

  current.callsUsed += 1;
  console.log(`[ai-approval] ${req.path} approved (${current.callsUsed}/${current.maxCalls})`);
  if (current.callsUsed >= current.maxCalls) disarm('call budget spent');

  return next();
}

function handleArm(req, res) {
  const { reason, maxCalls, ttlMs } = req.body || {};
  res.json({ success: true, approval: arm({ reason, maxCalls, ttlMs }) });
}

function handleDisarm(_req, res) {
  disarm('released by client');
  res.json({ success: true });
}

function handleStatus(_req, res) {
  res.json({ success: true, ...status() });
}

module.exports = {
  requireAiApproval,
  handleArm,
  handleDisarm,
  handleStatus,
  arm,
  disarm,
  status,
};
