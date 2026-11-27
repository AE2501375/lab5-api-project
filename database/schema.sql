-- =====================================================================
-- FixMyUnit database schema (MySQL 8.0.29 or later, InnoDB, utf8mb4)
-- Milestone 4: Milestone 3 schema + auth_events (security log) +
-- sessions (server-side session store) + encrypted technician phone.
-- Run with:  npm run db:setup   (or paste into MySQL Workbench)
-- =====================================================================

CREATE TABLE IF NOT EXISTS units (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_number        VARCHAR(20)  NOT NULL,
  floor              SMALLINT     NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         TIMESTAMP    NULL DEFAULT NULL,
  deleted_by         INT UNSIGNED NULL,
  -- unit_number is unique only among units that are not soft-deleted
  active_unit_number VARCHAR(20) GENERATED ALWAYS AS (IF(deleted_at IS NULL, unit_number, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_active_number (active_unit_number)
) ENGINE=InnoDB;

-- users: residents and the admin. Only an Argon2id hash of the password is stored.
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role          ENUM('resident','admin') NOT NULL DEFAULT 'resident',
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  unit_id       INT UNSIGNED NULL,
  last_login_at TIMESTAMP    NULL DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP    NULL DEFAULT NULL,
  deleted_by    INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_unit (unit_id),
  CONSTRAINT fk_users_unit       FOREIGN KEY (unit_id)    REFERENCES units (id) ON DELETE RESTRICT,
  CONSTRAINT fk_users_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_users_hash      CHECK (password_hash LIKE '$argon2id$%'),
  CONSTRAINT chk_users_admin_unit CHECK (role = 'resident' OR unit_id IS NULL)
) ENGINE=InnoDB;

-- Added after users exists (units.deleted_by -> users.id)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_units_deleted_by');
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE units ADD CONSTRAINT fk_units_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- technicians: no login. Phone number is personal data, stored AES-256-GCM encrypted.
CREATE TABLE IF NOT EXISTS technicians (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name       VARCHAR(100) NOT NULL,
  phone_encrypted VARCHAR(255) NULL,
  specialty       ENUM('plumbing','electricity','appliances','heating_cooling','other') NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS requests (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_id       INT UNSIGNED NOT NULL,
  resident_id   INT UNSIGNED NOT NULL,
  technician_id INT UNSIGNED NULL,
  category      ENUM('plumbing','electricity','appliances','heating_cooling','other') NOT NULL,
  description   VARCHAR(2000) NOT NULL,
  priority      ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status        ENUM('open','in_progress','done','cancelled') NOT NULL DEFAULT 'open',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at     TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_requests_status_category (status, category),
  KEY idx_requests_resident (resident_id, created_at),
  KEY idx_requests_unit (unit_id),
  KEY idx_requests_technician (technician_id),
  CONSTRAINT fk_requests_unit       FOREIGN KEY (unit_id)       REFERENCES units (id)       ON DELETE RESTRICT,
  CONSTRAINT fk_requests_resident   FOREIGN KEY (resident_id)   REFERENCES users (id)       ON DELETE RESTRICT,
  CONSTRAINT fk_requests_technician FOREIGN KEY (technician_id) REFERENCES technicians (id) ON DELETE RESTRICT,
  CONSTRAINT chk_requests_description CHECK (CHAR_LENGTH(description) >= 10),
  CONSTRAINT chk_requests_closed CHECK (
    (status IN ('done','cancelled') AND closed_at IS NOT NULL) OR
    (status IN ('open','in_progress') AND closed_at IS NULL))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS request_activity (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id INT UNSIGNED NOT NULL,
  actor_id   INT UNSIGNED NOT NULL,
  action     ENUM('created','edited','cancelled','status_changed','technician_assigned','note_added') NOT NULL,
  old_value  VARCHAR(255) NULL,
  new_value  VARCHAR(255) NULL,
  note       VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_request (request_id, created_at),
  CONSTRAINT fk_activity_request FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE RESTRICT,
  CONSTRAINT fk_activity_actor   FOREIGN KEY (actor_id)   REFERENCES users (id)    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  request_id   INT UNSIGNED NOT NULL,
  status_after ENUM('open','in_progress','done','cancelled') NOT NULL,
  message      VARCHAR(255) NOT NULL,
  note         VARCHAR(500) NULL,
  is_read      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at      TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE RESTRICT,
  CONSTRAINT fk_notifications_request FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- auth_events: security log of authentication and authorisation events.
-- user_id is NULL when the email did not match an account.
CREATE TABLE IF NOT EXISTS auth_events (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type      ENUM('signup','login_success','login_failure','login_locked','logout',
                       'session_expired','access_denied','rate_limited') NOT NULL,
  user_id         INT UNSIGNED NULL,
  email_attempted VARCHAR(255) NULL,
  reason          VARCHAR(100) NULL,
  ip_address      VARCHAR(45)  NOT NULL,
  user_agent      VARCHAR(255) NULL,
  http_method     VARCHAR(10)  NULL,
  path            VARCHAR(255) NULL,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_auth_events_email (email_attempted, event_type, created_at),
  KEY idx_auth_events_ip (ip_address, created_at),
  KEY idx_auth_events_user (user_id, created_at),
  KEY idx_auth_events_type (event_type, created_at),
  CONSTRAINT fk_auth_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- sessions: server-side session store used by express-mysql-session.
-- The browser cookie only holds the signed session_id.
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  expires    INT UNSIGNED NOT NULL,
  data       MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id),
  KEY idx_sessions_expires (expires)
) ENGINE=InnoDB;

-- Append-only enforcement: the activity log and the security log can only be inserted into.
CREATE TRIGGER IF NOT EXISTS trg_activity_no_update BEFORE UPDATE ON request_activity
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'request_activity is append-only';

CREATE TRIGGER IF NOT EXISTS trg_activity_no_delete BEFORE DELETE ON request_activity
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'request_activity is append-only';

CREATE TRIGGER IF NOT EXISTS trg_auth_events_no_update BEFORE UPDATE ON auth_events
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'auth_events is append-only';

CREATE TRIGGER IF NOT EXISTS trg_auth_events_no_delete BEFORE DELETE ON auth_events
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'auth_events is append-only';
