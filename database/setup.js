/**
 * Creates the database and tables, then seeds the admin account and demo data.
 *
 *   npm run db:setup   -> create anything missing, seed if empty (safe to re-run)
 *   npm run db:reset   -> DROP all FixMyUnit tables first (development only!)
 *
 * The admin account is created here because there is no public admin sign-up.
 * Its password comes from ADMIN_PASSWORD in .env and is stored only as an Argon2id hash.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config/env');
const { hashPassword } = require('../utils/password');
const { encrypt } = require('../utils/crypto');
const { validatePasswordStrength } = require('../utils/validators');

const TABLES_IN_DROP_ORDER = [
  'auth_events', 'notifications', 'request_activity', 'requests',
  'technicians', 'sessions', 'users', 'units',
];

async function main() {
  const reset = process.argv.includes('--reset');
  if (reset && config.isProduction) throw new Error('Refusing to reset a production database.');

  const base = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true,
    timezone: 'Z',
  };

  const server = await mysql.createConnection(base);
  await server.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  await server.end();

  const conn = await mysql.createConnection({ ...base, database: config.db.database });
  await conn.query("SET time_zone = '+00:00'");

  if (reset) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of TABLES_IN_DROP_ORDER) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Dropped existing FixMyUnit tables.');
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(schema);
  console.log('Schema is up to date.');

  try {
    await seed(conn);
  } finally {
    await conn.end();
  }
}

async function seed(conn) {
  const [[{ admins }]] = await conn.query("SELECT COUNT(*) AS admins FROM users WHERE role = 'admin'");
  if (admins > 0) {
    console.log('Admin already exists - skipping seed.');
    return;
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (!adminEmail || !adminPassword) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running db:setup.');
  }
  const weak = validatePasswordStrength(adminPassword, adminEmail);
  if (weak) throw new Error(`ADMIN_PASSWORD rejected: ${weak}`);

  await conn.query(
    'INSERT INTO users (role, full_name, email, password_hash) VALUES (?, ?, ?, ?)',
    ['admin', process.env.ADMIN_NAME || 'Building Manager', adminEmail, await hashPassword(adminPassword)],
  );

  await conn.query(
    'INSERT INTO units (unit_number, floor) VALUES (?, ?), (?, ?), (?, ?), (?, ?)',
    ['A-101', 1, 'A-102', 1, 'B-204', 2, 'C-301', 3],
  );

  const technicians = [
    ['Omar Hassan', '+20 100 123 4567', 'plumbing'],
    ['Mona Adel', '+20 111 765 4321', 'electricity'],
    ['Karim Fathy', '+20 122 555 0101', 'heating_cooling'],
  ];
  for (const [name, phone, specialty] of technicians) {
    await conn.query(
      'INSERT INTO technicians (full_name, phone_encrypted, specialty) VALUES (?, ?, ?)',
      [name, encrypt(phone), specialty],
    );
  }

  console.log(`Seeded admin (${adminEmail}), 4 units and 3 technicians.`);
}

main().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
