/**
 * Authentication and authorisation middleware chain:
 *   requireAuth            -> 401 if there is no valid, unexpired session for an active user
 *   requireRole('admin')   -> 403 if the logged-in user has the wrong role
 *
 * The role is re-read from the database on every request (not trusted from the
 * cookie or the client), so a deleted account loses access immediately.
 */
const config = require('../config/env');
const { cookieOptions } = require('../config/session');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');
const { logAuthEvent } = require('../services/authLogger');
const { destroySession } = require('../services/authService');

const ABSOLUTE_MS = config.session.absoluteHours * 60 * 60 * 1000;

async function endSession(req, res, reason, userId) {
  await logAuthEvent(req, { eventType: 'session_expired', userId, reason });
  await destroySession(req);
  res.clearCookie(config.session.cookieName, { ...cookieOptions, maxAge: undefined });
}

async function requireAuth(req, res, next) {
  const userId = req.session && req.session.userId;
  if (!userId) throw AppError.unauthenticated();

  // Absolute lifetime: even an active session must log in again after N hours.
  if (!req.session.createdAt || Date.now() - req.session.createdAt > ABSOLUTE_MS) {
    await endSession(req, res, 'absolute_timeout', userId);
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.');
  }

  const user = await userRepository.findActiveById(userId);
  if (!user) {
    await endSession(req, res, 'account_deleted', null);
    throw AppError.unauthenticated();
  }

  req.user = {
    id: user.id,
    role: user.role,
    fullName: user.full_name,
    email: user.email,
    unitId: user.unit_id,
    row: user,
  };
  next();
}

/**
 * @param {...('resident'|'admin')} roles allowed roles
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) throw AppError.unauthenticated();
    if (!roles.includes(req.user.role)) {
      await logAuthEvent(req, {
        eventType: 'access_denied',
        userId: req.user.id,
        reason: `role_${req.user.role}_needs_${roles.join('_or_')}`,
      });
      throw AppError.forbidden();
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
