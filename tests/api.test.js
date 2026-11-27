/**
 * End-to-end API tests (node:test). Needs a MySQL server configured in .env.
 * WARNING: resets the database named in DB_NAME. Run against a test database only.
 *
 *   npm test
 */
process.env.NODE_ENV = 'test';
process.env.LOGIN_MAX_PER_MINUTE = '30';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { io: ioClient } = require('socket.io-client');

execFileSync(process.execPath, [path.join(__dirname, '..', 'database', 'setup.js'), '--reset'], { stdio: 'inherit' });

const { db } = require('../config/db');
const { createServer, attachSockets } = require('../server');

let server;
let base;
const ADMIN = { email: process.env.ADMIN_EMAIL.toLowerCase(), password: process.env.ADMIN_PASSWORD };
const SARA = { fullName: 'Sara Ali', email: 'sara.ali@example.com', password: 'correct horse battery 42' };
const OMAR = { fullName: 'Omar Nabil', email: 'omar.nabil@example.com', password: 'blue window garden 77' };
const state = {};

/** Minimal HTTP client that keeps the session cookie like a browser would. */
async function call(method, url, { body, cookie, headers = {} } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  const setCookies = res.headers.getSetCookie();
  return { status: res.status, body: text ? JSON.parse(text) : null, setCookies, headers: res.headers };
}

async function login(creds) {
  const res = await call('POST', '/api/auth/login', { body: { email: creds.email, password: creds.password } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const raw = res.setCookies.find((c) => c.startsWith('fmu.sid='));
  return { res, raw, cookie: raw.split(';')[0] };
}

before(async () => {
  server = createServer();
  attachSockets(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await db.end();
  setTimeout(() => process.exit(0), 100).unref(); // session store cleanup timer
});

// ---------------------------------------------------------------- auth
test('health check', async () => {
  const res = await call('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.ok(res.headers.get('content-security-policy'));
});

test('signup rejects invalid input with field details', async () => {
  const res = await call('POST', '/api/auth/signup', { body: { fullName: 'S', email: 'not-an-email', password: 'short1' } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  const fields = res.body.error.details.map((d) => d.field).sort();
  assert.deepEqual(fields, ['email', 'fullName']);

  const weak = await call('POST', '/api/auth/signup', { body: { ...SARA, password: 'onlyletterspassword' } });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.error.details[0].field, 'password');
});

test('signup creates a resident, ignores a client-sent role, never returns the hash', async () => {
  const res = await call('POST', '/api/auth/signup', { body: { ...SARA, email: '  Sara.Ali@Example.com ', role: 'admin' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.role, 'resident');
  assert.equal(res.body.email, SARA.email);
  assert.equal(res.body.unit, null);
  assert.ok(!JSON.stringify(res.body).includes('argon2'));
  assert.equal(res.setCookies.length, 0, 'signup does not start a session');
  state.saraId = res.body.id;

  const [[row]] = await db.query('SELECT password_hash FROM users WHERE id = ?', [state.saraId]);
  assert.match(row.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

  const omar = await call('POST', '/api/auth/signup', { body: OMAR });
  assert.equal(omar.status, 201);
  state.omarId = omar.body.id;
});

test('duplicate email -> 409', async () => {
  const res = await call('POST', '/api/auth/signup', { body: SARA });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'EMAIL_TAKEN');
});

test('wrong password and unknown email return the same 401', async () => {
  const a = await call('POST', '/api/auth/login', { body: { email: SARA.email, password: 'wrong password 1' } });
  const b = await call('POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: 'wrong password 1' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.deepEqual(a.body, b.body);
});

test('SQL injection in login is rejected by validation and harmless anyway', async () => {
  const res = await call('POST', '/api/auth/login', { body: { email: "' OR '1'='1' -- ", password: "' OR '1'='1" } });
  assert.equal(res.status, 400);
  const res2 = await call('POST', '/api/auth/login', { body: { email: "x'or'1'='1@a.com", password: 'anything 123' } });
  assert.equal(res2.status, 401);
});

test('login sets an HttpOnly SameSite session cookie and regenerates the id', async () => {
  const first = await login(SARA);
  assert.match(first.raw, /HttpOnly/i);
  assert.match(first.raw, /SameSite=Lax/i);
  assert.match(first.raw, /Path=\//);
  assert.match(first.raw, /Expires=/i);
  assert.equal(first.res.body.role, 'resident');
  assert.ok(!('passwordHash' in first.res.body));
  const second = await login(SARA);
  assert.notEqual(first.cookie, second.cookie, 'new session id on every login');
  state.sara = second.cookie;
  state.omar = (await login(OMAR)).cookie;
  state.admin = (await login(ADMIN)).cookie;
});

test('protected routes need a valid session (401) and the right role (403)', async () => {
  assert.equal((await call('GET', '/api/users/me')).status, 401);
  assert.equal((await call('GET', '/api/users/me', { cookie: 'fmu.sid=s%3Aforged.signature' })).status, 401);
  const me = await call('GET', '/api/users/me', { cookie: state.sara });
  assert.equal(me.status, 200);
  assert.equal(me.body.email, SARA.email);

  const denied = await call('GET', '/api/units', { cookie: state.sara });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'FORBIDDEN');
});

test('CSRF guard: foreign Origin -> 403, non-JSON body -> 415', async () => {
  const evil = await call('POST', '/api/requests', {
    cookie: state.sara, headers: { Origin: 'https://evil.example' }, body: { category: 'other', description: 'cross site attack' },
  });
  assert.equal(evil.status, 403);
  const form = await fetch(`${base}/api/requests`, {
    method: 'POST', headers: { Cookie: state.sara, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'category=other&description=form+post+attack',
  });
  assert.equal(form.status, 415);
});

// ---------------------------------------------------------------- UC-1
test('UC-1 extension: resident without a unit cannot create a request (409)', async () => {
  const res = await call('POST', '/api/requests', {
    cookie: state.sara, body: { category: 'plumbing', description: 'Kitchen sink is leaking.' },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'NO_UNIT_ASSIGNED');
});

test('admin assigns units to residents', async () => {
  const units = await call('GET', '/api/units', { cookie: state.admin });
  const b204 = units.body.items.find((u) => u.unitNumber === 'B-204');
  const a101 = units.body.items.find((u) => u.unitNumber === 'A-101');
  state.unitId = b204.id;
  const res = await call('PUT', `/api/residents/${state.saraId}/unit`, { cookie: state.admin, body: { unitId: b204.id } });
  assert.equal(res.status, 200);
  assert.equal(res.body.unit.unitNumber, 'B-204');
  await call('PUT', `/api/residents/${state.omarId}/unit`, { cookie: state.admin, body: { unitId: a101.id } });
});

test('UC-1 validation errors', async () => {
  const res = await call('POST', '/api/requests', {
    cookie: state.sara, body: { category: 'roof', description: 'short', priority: 'urgent' },
  });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), ['category', 'description', 'priority']);
  const bad = await call('POST', '/api/requests', { cookie: state.sara, body: '{"category": "plumb' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'INVALID_JSON');
});

test('UC-1 main flow: resident creates a request; server sets resident, unit and status', async () => {
  const res = await call('POST', '/api/requests', {
    cookie: state.sara,
    body: {
      category: 'plumbing', description: 'Kitchen sink is leaking under the cabinet.', priority: 'high',
      status: 'done', residentId: state.omarId, unitId: 999, // must be ignored
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.status, 'open');
  assert.equal(res.body.resident.id, state.saraId);
  assert.equal(res.body.unit.unitNumber, 'B-204');
  assert.equal(res.body.priority, 'high');
  assert.match(res.body.createdAt, /Z$/);
  state.requestId = res.body.id;

  const list = await call('GET', '/api/requests', { cookie: state.sara });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.pagination.totalItems, 1);
});

test('UC-1: admin cannot create a request; other residents cannot see it (404)', async () => {
  const asAdmin = await call('POST', '/api/requests', {
    cookie: state.admin, body: { category: 'other', description: 'Admin should not do this.' },
  });
  assert.equal(asAdmin.status, 403);
  const asOmar = await call('GET', `/api/requests/${state.requestId}`, { cookie: state.omar });
  assert.equal(asOmar.status, 404);
  const omarList = await call('GET', '/api/requests', { cookie: state.omar });
  assert.equal(omarList.body.items.length, 0);
  const omarCancel = await call('POST', `/api/requests/${state.requestId}/cancel`, { cookie: state.omar });
  assert.equal(omarCancel.status, 404);
});

// ---------------------------------------------------------------- UC-2
test('UC-2: resident cannot change status (403)', async () => {
  const res = await call('PATCH', `/api/requests/${state.requestId}/status`, {
    cookie: state.sara, body: { status: 'in_progress' },
  });
  assert.equal(res.status, 403);
});

test('UC-2: disallowed transition open -> done is rejected (409) and nothing changes', async () => {
  const res = await call('PATCH', `/api/requests/${state.requestId}/status`, { cookie: state.admin, body: { status: 'done' } });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INVALID_STATUS_TRANSITION');
  const [[row]] = await db.query('SELECT status FROM requests WHERE id = ?', [state.requestId]);
  assert.equal(row.status, 'open');
});

test('UC-2 main flow: status + note + notification in one transaction, pushed over WebSocket', async () => {
  const socket = ioClient(base, { transports: ['websocket'], extraHeaders: { Cookie: state.sara }, forceNew: true });
  await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });
  const pushed = new Promise((resolve) => socket.on('notification:new', resolve));

  const res = await call('PATCH', `/api/requests/${state.requestId}/status`, {
    cookie: state.admin, body: { status: 'in_progress', note: 'Plumber will visit tomorrow morning.' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'in_progress');

  const event = await pushed;
  assert.equal(event.requestId, state.requestId);
  assert.equal(event.statusAfter, 'in_progress');
  assert.equal(event.note, 'Plumber will visit tomorrow morning.');
  socket.close();

  const notes = await call('GET', '/api/notifications?unread=true', { cookie: state.sara });
  assert.equal(notes.body.unreadCount, 1);
  const read = await call('PATCH', `/api/notifications/${notes.body.items[0].id}/read`, { cookie: state.sara });
  assert.equal(read.body.isRead, true);
  const notMine = await call('PATCH', `/api/notifications/${notes.body.items[0].id}/read`, { cookie: state.omar });
  assert.equal(notMine.status, 404);

  const activity = await call('GET', `/api/requests/${state.requestId}/activity`, { cookie: state.admin });
  assert.deepEqual(activity.body.items.map((a) => a.action), ['created', 'status_changed', 'note_added']);
});

test('UC-2: unauthenticated socket connections are refused', async () => {
  const socket = ioClient(base, { transports: ['websocket'], forceNew: true, reconnection: false });
  const err = await new Promise((resolve) => socket.on('connect_error', resolve));
  assert.equal(err.message, 'unauthorized');
  socket.close();
});

test('UC-2: assign technician, finish, then final status cannot change', async () => {
  const techs = await call('GET', '/api/technicians', { cookie: state.admin });
  const plumber = techs.body.items.find((t) => t.specialty === 'plumbing');
  const assign = await call('PUT', `/api/requests/${state.requestId}/technician`, { cookie: state.admin, body: { technicianId: plumber.id } });
  assert.equal(assign.status, 200);
  assert.equal(assign.body.technician.fullName, plumber.fullName);

  const done = await call('PATCH', `/api/requests/${state.requestId}/status`, { cookie: state.admin, body: { status: 'done' } });
  assert.equal(done.status, 200);
  const [[row]] = await db.query('SELECT status, closed_at FROM requests WHERE id = ?', [state.requestId]);
  assert.equal(row.status, 'done');
  assert.ok(row.closed_at);

  const reopen = await call('PATCH', `/api/requests/${state.requestId}/status`, { cookie: state.admin, body: { status: 'in_progress' } });
  assert.equal(reopen.status, 409);
  const cancel = await call('POST', `/api/requests/${state.requestId}/cancel`, { cookie: state.sara });
  assert.equal(cancel.status, 409);
});

test('resident edits and cancels an Open request', async () => {
  const created = await call('POST', '/api/requests', {
    cookie: state.sara, body: { category: 'electricity', description: 'Bedroom light flickers at night.' },
  });
  const edit = await call('PATCH', `/api/requests/${created.body.id}`, { cookie: state.sara, body: { priority: 'low' } });
  assert.equal(edit.body.priority, 'low');
  const cancel = await call('POST', `/api/requests/${created.body.id}/cancel`, { cookie: state.sara });
  assert.equal(cancel.body.status, 'cancelled');
  assert.ok(cancel.body.closedAt);
});

// ---------------------------------------------------------------- storage & logging
test('technician phone is encrypted at rest and decrypted for the admin', async () => {
  const res = await call('POST', '/api/technicians', {
    cookie: state.admin, body: { fullName: 'Hany Samir', phone: '+20 109 000 1122', specialty: 'appliances' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.phone, '+20 109 000 1122');
  const [[row]] = await db.query('SELECT phone_encrypted FROM technicians WHERE id = ?', [res.body.id]);
  assert.match(row.phone_encrypted, /^v1:/);
  assert.ok(!row.phone_encrypted.includes('1122'));
});

test('activity log and auth log are append-only at database level', async () => {
  await assert.rejects(db.query('DELETE FROM request_activity'), /append-only/);
  await assert.rejects(db.query("UPDATE auth_events SET reason = 'x'"), /append-only/);
});

test('search input with SQL / LIKE wildcards is treated as data', async () => {
  const res = await call('GET', `/api/residents?search=${encodeURIComponent("%' OR 1=1 -- ")}`, { cookie: state.admin });
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 0);
});

test('account lockout after 5 failed logins, even with the right password', async () => {
  for (let i = 0; i < 5; i += 1) {
    const r = await call('POST', '/api/auth/login', { body: { email: OMAR.email, password: `wrong guess ${i}x` } });
    assert.equal(r.status, 401);
  }
  const locked = await call('POST', '/api/auth/login', { body: { email: OMAR.email, password: OMAR.password } });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error.code, 'ACCOUNT_LOCKED');
});

test('auth events record success/failure with IP and timestamp; admin only', async () => {
  const forbidden = await call('GET', '/api/admin/auth-events', { cookie: state.sara });
  assert.equal(forbidden.status, 403);

  const res = await call('GET', '/api/admin/auth-events?pageSize=100', { cookie: state.admin });
  assert.equal(res.status, 200);
  const types = new Set(res.body.items.map((e) => e.eventType));
  for (const t of ['signup', 'login_success', 'login_failure', 'login_locked', 'access_denied']) {
    assert.ok(types.has(t), `missing ${t}`);
  }
  const failure = res.body.items.find((e) => e.eventType === 'login_failure' && e.reason === 'unknown_email');
  assert.ok(failure.ip);
  assert.match(failure.createdAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(failure.path, '/api/auth/login');
  const [rows] = await db.query("SELECT COUNT(*) AS n FROM auth_events WHERE reason LIKE '%password 1%'");
  assert.equal(rows[0].n, 0, 'passwords are never logged');
});

test('logout destroys the server session; the old cookie stops working', async () => {
  const fresh = await login(SARA);
  const out = await call('POST', '/api/auth/logout', { cookie: fresh.cookie });
  assert.equal(out.status, 204);
  assert.ok(out.setCookies.some((c) => c.startsWith('fmu.sid=;')));
  const after = await call('GET', '/api/users/me', { cookie: fresh.cookie });
  assert.equal(after.status, 401);
});

test('login rate limit per IP -> 429 (run last)', async () => {
  let status = 0;
  for (let i = 0; i < 40 && status !== 429; i += 1) {
    const r = await call('POST', '/api/auth/login', { body: { email: `ghost${i}@example.com`, password: 'nothing here 1' } });
    status = r.status;
  }
  assert.equal(status, 429);
  const [[row]] = await db.query("SELECT COUNT(*) AS n FROM auth_events WHERE event_type = 'rate_limited'");
  assert.ok(row.n >= 1);
});
