-- Optional (recommended): run as MySQL root to create a least-privilege
-- account for the running app. The app can read and write rows but cannot
-- drop or alter tables, so a compromised app account does less damage.
-- Replace the password, then put these credentials in .env (DB_USER / DB_PASSWORD).
-- Run `npm run db:setup` with an admin account first (it needs CREATE rights).

CREATE USER IF NOT EXISTS 'fixmyunit_app'@'localhost' IDENTIFIED BY 'change-me-to-a-long-random-password';

GRANT SELECT, INSERT, UPDATE ON fixmyunit.* TO 'fixmyunit_app'@'localhost';
-- DELETE is only needed on the session store (logout, expired sessions)
GRANT DELETE ON fixmyunit.sessions TO 'fixmyunit_app'@'localhost';

FLUSH PRIVILEGES;
