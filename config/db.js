/**
 * MySQL connection pool (mysql2).
 *
 * - Every query in the repositories uses ? placeholders (parameterised queries),
 *   so user input is never concatenated into SQL (prevents SQL injection).
 * - Each pooled connection is switched to UTC so TIMESTAMP values are stored
 *   and returned consistently as ISO 8601 UTC strings.
 */
const mysql = require('mysql2');
const config = require('./env');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: false,
});

pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

const db = pool.promise();

/**
 * Runs `work(connection)` inside a single SQL transaction.
 * Commits if `work` resolves, rolls back if it throws, always releases the connection.
 * @template T
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} work
 * @returns {Promise<T>}
 */
async function withTransaction(work) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { db, pool, withTransaction };
