/**
 * Repository for the append-only `auth_events` security log.
 */
const { db } = require('../config/db');

async function insert(e) {
  await db.query(
    `INSERT INTO auth_events
       (event_type, user_id, email_attempted, reason, ip_address, user_agent, http_method, path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.eventType, e.userId, e.email, e.reason, e.ip, e.userAgent, e.method, e.path],
  );
}

/**
 * Failed logins for one email since its last successful login, within the window.
 * Used for the temporary account lockout.
 */
async function countRecentFailures(email, minutes) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS failures
       FROM auth_events f
      WHERE f.email_attempted = ?
        AND f.event_type = 'login_failure'
        AND f.created_at > (UTC_TIMESTAMP(3) - INTERVAL ? MINUTE)
        AND f.created_at > COALESCE(
              (SELECT MAX(s.created_at) FROM auth_events s
                WHERE s.email_attempted = ? AND s.event_type = 'login_success'),
              '1970-01-01 00:00:01')`,
    [email, minutes, email],
  );
  return Number(row.failures);
}

async function list({ eventType, userId, ip }, limit, offset) {
  const where = [];
  const params = [];
  if (eventType) { where.push('event_type = ?'); params.push(eventType); }
  if (userId) { where.push('user_id = ?'); params.push(userId); }
  if (ip) { where.push('ip_address = ?'); params.push(ip); }
  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT * FROM auth_events ${sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM auth_events ${sql}`, params);
  return { rows, total: Number(total) };
}

module.exports = { insert, countRecentFailures, list };
