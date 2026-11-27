/**
 * Central configuration.
 *
 * Every setting is read from environment variables (.env in development) so
 * that no secret is ever committed to Git. The app refuses to start when a
 * security-critical value is missing or too weak (fail closed).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = process.env;

function required(name) {
  const value = env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

function bool(name, fallback) {
  if (env[name] === undefined || env[name] === '') return fallback;
  return ['1', 'true', 'yes'].includes(String(env[name]).toLowerCase());
}

function int(name, fallback) {
  const n = Number.parseInt(env[name], 10);
  return Number.isFinite(n) ? n : fallback;
}

const nodeEnv = env.NODE_ENV || 'development';
const tlsEnabled = Boolean(env.TLS_KEY_PATH && env.TLS_CERT_PATH);

const sessionSecret = required('SESSION_SECRET');
if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters (run: npm run keys).');
}

const encryptionKeyHex = required('DATA_ENCRYPTION_KEY');
if (!/^[0-9a-fA-F]{64}$/.test(encryptionKeyHex)) {
  throw new Error('DATA_ENCRYPTION_KEY must be 64 hex characters = 32 bytes (run: npm run keys).');
}

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  host: env.HOST || 'localhost',
  port: int('PORT', 5000),

  tls: {
    enabled: tlsEnabled,
    keyPath: env.TLS_KEY_PATH,
    certPath: env.TLS_CERT_PATH,
  },

  // Number of reverse proxies in front of the app (0 locally). Needed so req.ip
  // is the real client IP for logging and rate limiting, and cannot be spoofed.
  trustProxy: int('TRUST_PROXY', 0),

  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5500')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  db: {
    host: env.DB_HOST || 'localhost',
    port: int('DB_PORT', 3306),
    user: required('DB_USER'),
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'fixmyunit',
    ssl: bool('DB_SSL', false),
  },

  session: {
    secret: sessionSecret,
    cookieName: 'fmu.sid',
    // Secure flag: always on when the app serves HTTPS itself or runs in production;
    // COOKIE_SECURE=true turns it on when HTTPS is terminated by a proxy / load balancer.
    cookieSecure: tlsEnabled || nodeEnv === 'production' || bool('COOKIE_SECURE', false),
    idleMinutes: int('SESSION_IDLE_MINUTES', 30),
    absoluteHours: int('SESSION_ABSOLUTE_HOURS', 8),
  },

  security: {
    loginWindowMs: 60 * 1000,
    loginMaxPerIp: int('LOGIN_MAX_PER_MINUTE', 5),
    lockoutFailures: int('LOCKOUT_FAILURES', 5),
    lockoutMinutes: int('LOCKOUT_MINUTES', 15),
  },

  encryptionKey: Buffer.from(encryptionKeyHex, 'hex'),
};

module.exports = config;
