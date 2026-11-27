/**
 * Repository for `units` and `technicians` (building data managed by the admin).
 */
const { db } = require('../config/db');

// ---------- units ----------
async function listUnits() {
  const [rows] = await db.query(
    'SELECT id, unit_number, floor FROM units WHERE deleted_at IS NULL ORDER BY unit_number',
  );
  return rows;
}

async function findActiveUnit(id) {
  const [rows] = await db.query(
    'SELECT id, unit_number, floor FROM units WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

async function createUnit({ unitNumber, floor }) {
  const [result] = await db.query('INSERT INTO units (unit_number, floor) VALUES (?, ?)', [unitNumber, floor ?? null]);
  return result.insertId;
}

// ---------- technicians ----------
async function listTechnicians() {
  const [rows] = await db.query(
    'SELECT id, full_name, phone_encrypted, specialty, is_active FROM technicians ORDER BY full_name',
  );
  return rows;
}

async function findTechnician(id, conn = db) {
  const [rows] = await conn.query(
    'SELECT id, full_name, phone_encrypted, specialty, is_active FROM technicians WHERE id = ? LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

/** @param {{fullName:string, phoneEncrypted:string|null, specialty:string|null}} t */
async function createTechnician(t) {
  const [result] = await db.query(
    'INSERT INTO technicians (full_name, phone_encrypted, specialty) VALUES (?, ?, ?)',
    [t.fullName, t.phoneEncrypted, t.specialty ?? null],
  );
  return result.insertId;
}

module.exports = { listUnits, findActiveUnit, createUnit, listTechnicians, findTechnician, createTechnician };
