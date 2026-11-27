/**
 * Security event logger.
 *
 * Writes one row to the append-only `auth_events` table for every
 * authentication / authorisation event (success or failure) with the client IP,
 * user agent, route and a UTC millisecond timestamp. A JSON line is also
 * written to stdout so events reach the hosting platform's log collector.
 *
 * Passwords, password hashes and session ids are NEVER logged.
 * Logging must never break the request, so database errors are caught here.
 */
const authEventRepository = require('../repositories/authEventRepository');

const EVENT_TYPES = new Set([
  'signup', 'login_success', 'login_failure', 'login_locked', 'logout',
  'session_expired', 'access_denied', 'rate_limited',
]);

/**
 * @param {import('express').Request} req
 * @param {{ eventType: string, userId?: number|null, email?: string|null, reason?: string|null }} event
 */
async function logAuthEvent(req, { eventType, userId = null, email = null, reason = null }) {
  if (!EVENT_TYPES.has(eventType)) throw new Error(`Unknown auth event type ${eventType}`);

  const entry = {
    eventType,
    userId,
    email: email ? String(email).slice(0, 255) : null,
    reason: reason ? String(reason).slice(0, 100) : null,
    ip: (req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 45),
    userAgent: (req.get('user-agent') || '').slice(0, 255) || null,
    method: req.method,
    path: (req.originalUrl || req.url || '').split('?')[0].slice(0, 255),
  };

  const level = ['login_failure', 'login_locked', 'access_denied', 'rate_limited'].includes(eventType) ? 'warn' : 'info';
  if (process.env.NODE_ENV !== 'test') {
    console[level](JSON.stringify({ ts: new Date().toISOString(), type: 'auth_event', ...entry }));
  }

  try {
    await authEventRepository.insert(entry);
  } catch (err) {
    console.error('Failed to write auth event:', err.message);
  }
}

module.exports = { logAuthEvent };
