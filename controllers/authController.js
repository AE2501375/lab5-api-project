/**
 * HTTP layer for /api/auth and /api/users/me.
 * Controllers only translate HTTP <-> service calls; no business rules here.
 */
const config = require('../config/env');
const { cookieOptions } = require('../config/session');
const authService = require('../services/authService');
const { toUserProfile } = require('../utils/mappers');

/** POST /api/auth/signup -> 201 profile (no session is started) */
async function signup(req, res) {
  const profile = await authService.signup(req, req.valid.body);
  res.status(201).json(profile);
}

/** POST /api/auth/login -> 200 profile + Set-Cookie: fmu.sid=...; HttpOnly; SameSite=Lax */
async function login(req, res) {
  const profile = await authService.login(req, req.valid.body);
  res.status(200).json(profile);
}

/** POST /api/auth/logout -> 204, session row deleted and cookie expired */
async function logout(req, res) {
  await authService.logout(req);
  res.clearCookie(config.session.cookieName, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
}

/** GET /api/users/me -> own profile with unit */
function me(req, res) {
  res.json(toUserProfile(req.user.row));
}

module.exports = { signup, login, logout, me };
