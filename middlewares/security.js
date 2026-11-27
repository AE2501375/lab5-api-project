/**
 * Request-level security middleware: rate limiters and a CSRF guard.
 */
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const { logAuthEvent } = require('../services/authLogger');

function limiter({ windowMs, limit, name }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: async (req, res, next) => {
      await logAuthEvent(req, { eventType: 'rate_limited', email: req.body?.email ?? null, reason: name });
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait and try again.'));
    },
  });
}

/** 5 login attempts per IP per minute (brute-force protection, as in Lab 9.2). */
const loginLimiter = limiter({ windowMs: config.security.loginWindowMs, limit: config.security.loginMaxPerIp, name: 'login_ip_limit' });

/** 10 sign-ups per IP per hour (stops scripted mass account creation). */
const signupLimiter = limiter({ windowMs: 60 * 60 * 1000, limit: 10, name: 'signup_ip_limit' });

/** General API limit: 300 requests per IP per 15 minutes. */
const apiLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 300, name: 'api_ip_limit' });

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (on top of SameSite=Lax):
 * 1. State-changing requests with a body must be JSON. HTML forms cannot send
 *    application/json cross-site without a CORS preflight, which our CORS
 *    whitelist rejects.
 * 2. If the browser sends an Origin header it must be one of our allowed origins.
 */
function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && !config.corsOrigins.includes(origin) && origin !== `${req.protocol}://${req.get('host')}`) {
    throw new AppError(403, 'BAD_ORIGIN', 'Cross-site request blocked.');
  }

  const hasBody = Number(req.get('content-length') || 0) > 0 || req.get('transfer-encoding');
  if (hasBody && !req.is('application/json')) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the request body as application/json.');
  }
  next();
}

module.exports = { loginLimiter, signupLimiter, apiLimiter, csrfGuard };
