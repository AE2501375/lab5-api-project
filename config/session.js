/**
 * Server-side session configuration (express-session + MySQL store).
 *
 * The browser only receives an opaque, signed session id in the `fmu.sid`
 * cookie. The user id, role and timestamps live in the `sessions` table on the
 * server, so nothing sensitive is stored in the cookie and a session can be
 * revoked instantly (logout, deleted account, timeout).
 *
 * Cookie flags:
 *   HttpOnly  - JavaScript cannot read the cookie (limits XSS cookie theft)
 *   SameSite  - Lax: not sent on cross-site POST/PATCH/DELETE (CSRF defence)
 *   Secure    - only sent over HTTPS (enabled when TLS / production is on)
 *   Max-Age   - idle timeout; `rolling` renews it on every request
 */
const session = require('express-session');
const MySQLStoreFactory = require('express-mysql-session');
const config = require('./env');
const { pool } = require('./db');

const MySQLStore = MySQLStoreFactory(session);

const store = new MySQLStore(
  {
    createDatabaseTable: false, // table is created by database/schema.sql
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: config.session.idleMinutes * 60 * 1000,
    schema: {
      tableName: 'sessions',
      columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' },
    },
  },
  pool,
);

const cookieOptions = {
  httpOnly: true,
  secure: config.session.cookieSecure,
  sameSite: 'lax',
  path: '/',
  maxAge: config.session.idleMinutes * 60 * 1000,
};

const sessionMiddleware = session({
  name: config.session.cookieName,
  secret: config.session.secret,
  store,
  resave: false,
  saveUninitialized: false, // no cookie until the user actually logs in
  rolling: true,
  proxy: config.trustProxy > 0,
  cookie: cookieOptions,
});

module.exports = { sessionMiddleware, store, cookieOptions };
