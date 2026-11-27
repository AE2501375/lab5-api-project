# FixMyUnit – Backend API (Milestone 4)

Node.js + Express 5 + MySQL 8 REST API for FixMyUnit, a building maintenance tracker.
Residents report repairs; the building manager (admin) tracks them through to completion.

## Quick start

```bash
npm install
cp .env.example .env          # then edit DB_* and ADMIN_*
npm run keys                  # paste SESSION_SECRET and DATA_ENCRYPTION_KEY into .env
npm run db:setup              # creates the database, tables, triggers, admin + demo data
npm start                     # http://localhost:5000/api
```

Optional local HTTPS: `sh scripts/generate-cert.sh`, then set `TLS_KEY_PATH=certs/localhost-key.pem`
and `TLS_CERT_PATH=certs/localhost.pem` in `.env`. With HTTPS on, the cookie gets the `Secure` flag.

Tests (**reset the database in `DB_NAME`**, so point it at a test database):

```bash
npm test                      # 27 end-to-end tests: auth, UC-1, UC-2, security
```

Postman: import `postman/FixMyUnit.postman_collection.json`, set `adminPassword`, run top to bottom.

## Third-party packages

| Package | Used for |
|---|---|
| express | HTTP server and routing |
| express-session | server-side sessions and the `fmu.sid` cookie |
| express-mysql-session | stores sessions in the MySQL `sessions` table |
| mysql2 | MySQL driver (parameterised queries, transactions) |
| argon2 | Argon2id password hashing |
| express-rate-limit | login, sign-up and general rate limits |
| helmet | security headers (CSP, HSTS, nosniff ...) |
| cors | allow-list of frontend origins with credentials |
| dotenv | loads settings and secrets from `.env` |
| socket.io | WebSocket notifications |
| socket.io-client (dev) | WebSocket checks in the tests |

## Architecture (layered MVC + repository)

```
request ─► app.js (helmet, CORS, JSON limit, CSRF guard, session, rate limit)
        ─► routes/index.js        middleware chain per route
        ─► middlewares/           requireAuth (401) → requireRole (403) → validate (400)
        ─► controllers/           HTTP in/out only
        ─► services/              business rules, transactions, auth logging, WebSocket push
        ─► repositories/          the only SQL (parameterised ? placeholders)
        ─► MySQL (config/db.js)
```

| Folder | Purpose |
|---|---|
| `config/` | env validation, MySQL pool, session store and cookie flags |
| `database/` | `schema.sql`, `setup.js` (create + seed), `least_privilege.sql` |
| `middlewares/` | `auth.js`, `security.js` (rate limits, CSRF), `validate.js`, `errorHandler.js` |
| `services/` | `authService`, `requestService` (UC-1, UC-2), `authLogger`, `notifier` |
| `repositories/` | `userRepository`, `requestRepository`, `buildingRepository`, `authEventRepository` |
| `utils/` | Argon2id `password.js`, AES-256-GCM `crypto.js`, `validators.js`, `mappers.js`, `AppError.js` |
| `validation/schemas.js` | whitelist schema for every endpoint |

## Endpoints

| Method | Path | Access |
|---|---|---|
| POST | /api/auth/signup | public (10/h per IP) |
| POST | /api/auth/login | public (5/min per IP, account lockout) |
| POST | /api/auth/logout | logged in |
| GET | /api/users/me | logged in |
| POST | /api/requests | resident (**UC-1**) |
| GET | /api/requests | resident (own) / admin (all, filters) |
| GET | /api/requests/:id | owner / admin |
| PATCH | /api/requests/:id | owner, Open only |
| POST | /api/requests/:id/cancel | owner, Open only |
| PATCH | /api/requests/:id/status | admin (**UC-2**) |
| PUT | /api/requests/:id/technician | admin |
| GET | /api/requests/:id/activity | admin |
| GET | /api/notifications | resident |
| PATCH | /api/notifications/:id/read | resident (own) |
| POST | /api/notifications/read-all | resident |
| GET/POST | /api/units | admin |
| GET | /api/residents | admin |
| PUT | /api/residents/:id/unit | admin |
| GET/POST | /api/technicians | admin |
| GET | /api/admin/auth-events | admin (security log) |

WebSocket (Socket.IO, same session cookie): event `notification:new` to room `user:<id>`.

## Security summary

- **Passwords**: Argon2id (19 MiB, t=2, p=1), random salt per hash, rehash on login if parameters change; policy 12–128 chars with a letter and a digit, plus a common-password block list and a check against the email name.
- **Sessions**: server-side in the MySQL `sessions` table. The `fmu.sid` cookie holds only a signed random id and has `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS/production), `Path=/`, 30 min idle `Max-Age`, and an 8 h absolute limit. The session id is regenerated on login and the session is destroyed on logout.
- **Authorisation**: the role is re-read from the database on every request. Residents get 404 for other residents' requests. Server-controlled fields (role, status, residentId, unitId) are never taken from the body.
- **Logging**: append-only `auth_events` table (protected by triggers) records signup, login success/failure (with a reason), lockout, logout, session expiry, access denied and rate limiting, with IP, user agent, route and millisecond UTC timestamp. Passwords are never logged.
- **Brute force**: login is limited to 5 per IP per minute (429), and an account locks for 15 min after 5 failures. Unknown emails still run Argon2 against a dummy hash, so response time does not reveal which emails exist.
- **Data at rest**: technician phone numbers are AES-256-GCM encrypted. The key is held in `.env`, never in the database. `least_privilege.sql` creates a DB account without DROP/ALTER rights.
- **Input**: whitelist validation on body, query and params; parameterised SQL everywhere; LIKE wildcards are escaped; JSON body limited to 20 kB; Content-Type is enforced.
- **Transport/headers**: optional HTTPS (TLS 1.2+); Helmet sets CSP, HSTS, nosniff and frame protections; the CORS allow-list is limited to credentials; `Cache-Control: no-store` on API responses; generic 500 responses (no stack traces).
