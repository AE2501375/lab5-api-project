/**
 * Repository layer: the only code that talks SQL for the `users` table.
 * All queries are parameterised (? placeholders).
 */
const { db } = require('../config/db');

const PROFILE_COLUMNS = `
  u.id, u.role, u.full_name, u.email, u.unit_id, u.created_at, u.last_login_at,
  un.unit_number, un.floor AS unit_floor`;

/** Includes password_hash and deleted_at - for the login check only. */
async function findByEmailForLogin(email) {
  const [rows] = await db.query(
    'SELECT id, role, email, password_hash, deleted_at FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  return rows[0] || null;
}

/** Active (not soft-deleted) user with their unit; never returns the hash. */
async function findActiveById(id) {
  const [rows] = await db.query(
    `SELECT ${PROFILE_COLUMNS}
       FROM users u
       LEFT JOIN units un ON un.id = u.unit_id AND un.deleted_at IS NULL
      WHERE u.id = ? AND u.deleted_at IS NULL
      LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function createResident({ fullName, email, passwordHash }) {
  const [result] = await db.query(
    "INSERT INTO users (role, full_name, email, password_hash) VALUES ('resident', ?, ?, ?)",
    [fullName, email, passwordHash],
  );
  return result.insertId;
}

async function updatePasswordHash(id, passwordHash) {
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

async function touchLastLogin(id) {
  await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
}

function residentFilters({ unitId, unassigned, search }) {
  const where = ["u.role = 'resident'", 'u.deleted_at IS NULL'];
  const params = [];
  if (unitId) { where.push('u.unit_id = ?'); params.push(unitId); }
  if (unassigned === true) where.push('u.unit_id IS NULL');
  if (search) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like);
  }
  return { sql: where.join(' AND '), params };
}

async function listResidents(filters, limit, offset) {
  const { sql, params } = residentFilters(filters);
  const [rows] = await db.query(
    `SELECT ${PROFILE_COLUMNS},
            (SELECT COUNT(*) FROM requests r
              WHERE r.resident_id = u.id AND r.status IN ('open','in_progress')) AS open_requests
       FROM users u
       LEFT JOIN units un ON un.id = u.unit_id
      WHERE ${sql}
      ORDER BY u.full_name, u.id
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users u WHERE ${sql}`, params);
  return { rows, total: Number(total) };
}

async function findActiveResidentById(id) {
  const [rows] = await db.query(
    `SELECT ${PROFILE_COLUMNS} FROM users u LEFT JOIN units un ON un.id = u.unit_id
      WHERE u.id = ? AND u.role = 'resident' AND u.deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function setUnit(id, unitId) {
  await db.query('UPDATE users SET unit_id = ? WHERE id = ?', [unitId, id]);
}

module.exports = {
  findByEmailForLogin,
  findActiveById,
  createResident,
  updatePasswordHash,
  touchLastLogin,
  listResidents,
  findActiveResidentById,
  setUnit,
};
