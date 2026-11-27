/**
 * Repository for `requests`, `request_activity` and `notifications`.
 * Functions that take `conn` run inside the caller's transaction.
 */
const { db } = require('../config/db');

const REQUEST_SELECT = `
  SELECT r.id, r.unit_id, r.resident_id, r.technician_id, r.category, r.description,
         r.priority, r.status, r.created_at, r.updated_at, r.closed_at,
         un.unit_number,
         res.full_name AS resident_name, res.deleted_at AS resident_deleted_at,
         t.full_name AS technician_name, t.specialty AS technician_specialty
    FROM requests r
    JOIN units un  ON un.id = r.unit_id
    JOIN users res ON res.id = r.resident_id
    LEFT JOIN technicians t ON t.id = r.technician_id`;

// ---------- requests ----------
async function insertRequest(conn, { unitId, residentId, category, description, priority }) {
  const [result] = await conn.query(
    `INSERT INTO requests (unit_id, resident_id, category, description, priority)
     VALUES (?, ?, ?, ?, ?)`,
    [unitId, residentId, category, description, priority],
  );
  return result.insertId;
}

async function findById(id, conn = db) {
  const [rows] = await conn.query(`${REQUEST_SELECT} WHERE r.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

/** Locks the row until the transaction ends (prevents two admins racing on one request). */
async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, resident_id, technician_id, category, description, priority, status FROM requests WHERE id = ? FOR UPDATE',
    [id],
  );
  return rows[0] || null;
}

/**
 * @param {{residentId?:number,status?:string,category?:string,priority?:string,unitId?:number,technicianId?:number}} f
 */
async function list(f, limit, offset) {
  const where = [];
  const params = [];
  if (f.residentId) { where.push('r.resident_id = ?'); params.push(f.residentId); }
  if (f.status) { where.push('r.status = ?'); params.push(f.status); }
  if (f.category) { where.push('r.category = ?'); params.push(f.category); }
  if (f.priority) { where.push('r.priority = ?'); params.push(f.priority); }
  if (f.unitId) { where.push('r.unit_id = ?'); params.push(f.unitId); }
  if (f.technicianId) { where.push('r.technician_id = ?'); params.push(f.technicianId); }
  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await db.query(
    `${REQUEST_SELECT} ${sql} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM requests r ${sql}`, params);
  return { rows, total: Number(total) };
}

async function updateDetails(conn, id, { category, description, priority }) {
  await conn.query(
    'UPDATE requests SET category = ?, description = ?, priority = ? WHERE id = ?',
    [category, description, priority, id],
  );
}

/** Sets closed_at for final statuses so the chk_requests_closed constraint holds. */
async function updateStatus(conn, id, status) {
  const closing = status === 'done' || status === 'cancelled';
  await conn.query(
    `UPDATE requests SET status = ?, closed_at = ${closing ? 'CURRENT_TIMESTAMP' : 'NULL'} WHERE id = ?`,
    [status, id],
  );
}

async function setTechnician(conn, id, technicianId) {
  await conn.query('UPDATE requests SET technician_id = ? WHERE id = ?', [technicianId, id]);
}

// ---------- request_activity (append-only) ----------
async function insertActivity(conn, { requestId, actorId, action, oldValue = null, newValue = null, note = null }) {
  await conn.query(
    `INSERT INTO request_activity (request_id, actor_id, action, old_value, new_value, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [requestId, actorId, action, oldValue, newValue, note],
  );
}

async function listActivity(requestId) {
  const [rows] = await db.query(
    `SELECT a.*, u.full_name AS actor_name
       FROM request_activity a JOIN users u ON u.id = a.actor_id
      WHERE a.request_id = ?
      ORDER BY a.created_at, a.id`,
    [requestId],
  );
  return rows;
}

// ---------- notifications ----------
async function insertNotification(conn, { userId, requestId, statusAfter, message, note }) {
  const [result] = await conn.query(
    `INSERT INTO notifications (user_id, request_id, status_after, message, note)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, requestId, statusAfter, message, note ?? null],
  );
  const [rows] = await conn.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function listNotifications(userId, { unread }, limit, offset) {
  const where = ['user_id = ?'];
  const params = [userId];
  if (unread === true) where.push('is_read = 0');
  const sql = where.join(' AND ');
  const [rows] = await db.query(
    `SELECT * FROM notifications WHERE ${sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM notifications WHERE ${sql}`, params);
  const [[{ unreadCount }]] = await db.query(
    'SELECT COUNT(*) AS unreadCount FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId],
  );
  return { rows, total: Number(total), unreadCount: Number(unreadCount) };
}

/** Only marks the notification if it belongs to `userId` (ownership check in SQL). */
async function markNotificationRead(id, userId) {
  const [result] = await db.query(
    `UPDATE notifications SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  return rows[0];
}

async function markAllNotificationsRead(userId) {
  const [result] = await db.query(
    'UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0',
    [userId],
  );
  return result.affectedRows;
}

module.exports = {
  insertRequest, findById, findByIdForUpdate, list, updateDetails, updateStatus, setTechnician,
  insertActivity, listActivity,
  insertNotification, listNotifications, markNotificationRead, markAllNotificationsRead,
};
