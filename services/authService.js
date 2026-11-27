/**
 * Authentication business logic: sign-up, login (with lockout) and logout.
 * Controllers stay thin; all security decisions are made here.
 */
const config = require('../config/env');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');
const authEventRepository = require('../repositories/authEventRepository');
const { hashPassword, verifyPassword, needsRehash, getDummyHash } = require('../utils/password');
const { validatePasswordStrength } = require('../utils/validators');
const { toUserProfile } = require('../utils/mappers');
const { logAuthEvent } = require('./authLogger');

// Same message for unknown email, wrong password and deleted account, so an
// attacker cannot learn which emails are registered (account enumeration).
const INVALID_CREDENTIALS = new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

/**
 * UC: Resident sign-up. Role is always 'resident' (set by the server, never the client).
 */
async function signup(req, { fullName, email, password }) {
  const weak = validatePasswordStrength(password, email);
  if (weak) throw AppError.badRequest('Some fields are invalid.', [{ field: 'password', message: weak }]);

  const passwordHash = await hashPassword(password);
  let id;
  try {
    id = await userRepository.createResident({ fullName, email, passwordHash });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      await logAuthEvent(req, { eventType: 'signup', email, reason: 'duplicate_email_rejected' });
      throw AppError.conflict('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw err;
  }
  await logAuthEvent(req, { eventType: 'signup', userId: id, email, reason: 'created' });
  return toUserProfile(await userRepository.findActiveById(id));
}

/**
 * Verifies credentials, then starts a fresh server-side session.
 */
async function login(req, { email, password }) {
  // 1. Temporary lockout after repeated failures for this account (brute-force / credential stuffing).
  const failures = await authEventRepository.countRecentFailures(email, config.security.lockoutMinutes);
  if (failures >= config.security.lockoutFailures) {
    await logAuthEvent(req, { eventType: 'login_locked', email, reason: `${failures}_recent_failures` });
    throw new AppError(429, 'ACCOUNT_LOCKED',
      `Too many failed attempts. Try again in ${config.security.lockoutMinutes} minutes.`);
  }

  // 2. Look up the account. Always run one Argon2 verify so timing is the same either way.
  const user = await userRepository.findByEmailForLogin(email);
  const hash = user ? user.password_hash : await getDummyHash();
  const passwordOk = await verifyPassword(hash, password);

  if (!user || !passwordOk || user.deleted_at) {
    const reason = !user ? 'unknown_email' : user.deleted_at ? 'account_deleted' : 'wrong_password';
    await logAuthEvent(req, { eventType: 'login_failure', userId: user ? user.id : null, email, reason });
    throw INVALID_CREDENTIALS;
  }

  // 3. Upgrade old hashes transparently if the Argon2 parameters were raised.
  if (needsRehash(user.password_hash)) {
    await userRepository.updatePasswordHash(user.id, await hashPassword(password));
  }

  // 4. New session id on login (prevents session fixation). Only ids/role/timestamps are stored.
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.createdAt = Date.now();
  await saveSession(req);

  await userRepository.touchLastLogin(user.id);
  await logAuthEvent(req, { eventType: 'login_success', userId: user.id, email });
  return toUserProfile(await userRepository.findActiveById(user.id));
}

/** Deletes the server-side session; the controller clears the cookie. */
async function logout(req) {
  await logAuthEvent(req, { eventType: 'logout', userId: req.user.id, email: req.user.email });
  await destroySession(req);
}

// --- promise wrappers around express-session's callback API ---
function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
}
function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
}
function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { signup, login, logout, destroySession };
