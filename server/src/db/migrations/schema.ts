import { pool } from '../../config/db.js';
import { logger } from '../../config/logger.js';

const statements: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    google_id     VARCHAR(255) NOT NULL,
    email         VARCHAR(320) NOT NULL,
    display_name  VARCHAR(255) NOT NULL DEFAULT '',
    avatar_url    VARCHAR(1024) NOT NULL DEFAULT '',
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_google_id (google_id),
    UNIQUE KEY uq_users_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id    VARCHAR(255) NOT NULL,
    user_id       BIGINT UNSIGNED NOT NULL,
    expires_at    TIMESTAMP NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sessions_sid (session_id),
    KEY idx_sessions_user (user_id),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sender_configs (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    from_name     VARCHAR(255) NOT NULL DEFAULT '',
    from_email    VARCHAR(320) NOT NULL,
    reply_to      VARCHAR(320) NULL,
    ethereal_user VARCHAR(255) NOT NULL DEFAULT '',
    ethereal_pass VARCHAR(255) NOT NULL DEFAULT '',
    ethereal_smtp_url VARCHAR(1024) NOT NULL DEFAULT '',
    hourly_limit  INT UNSIGNED NOT NULL DEFAULT 50,
    min_delay_sec INT UNSIGNED NOT NULL DEFAULT 60,
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sender_user (user_id),
    CONSTRAINT fk_sender_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS campaigns (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    sender_id     BIGINT UNSIGNED NOT NULL,
    subject       VARCHAR(500) NOT NULL,
    body          MEDIUMTEXT NOT NULL,
    start_time    TIMESTAMP NOT NULL,
    min_delay_sec INT UNSIGNED NOT NULL DEFAULT 60,
    hourly_limit  INT UNSIGNED NOT NULL DEFAULT 50,
    status        ENUM('pending','scheduled','in_progress','completed','cancelled','failed') NOT NULL DEFAULT 'pending',
    total_recipients INT UNSIGNED NOT NULL DEFAULT 0,
    sent_count    INT UNSIGNED NOT NULL DEFAULT 0,
    failed_count  INT UNSIGNED NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_campaign_user (user_id),
    KEY idx_campaign_status (status),
    CONSTRAINT fk_campaign_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_campaign_sender FOREIGN KEY (sender_id) REFERENCES sender_configs(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS recipients (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id   BIGINT UNSIGNED NOT NULL,
    email         VARCHAR(320) NOT NULL,
    name          VARCHAR(255) NOT NULL DEFAULT '',
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_recipient_campaign_email (campaign_id, email),
    KEY idx_recipient_campaign (campaign_id),
    CONSTRAINT fk_recipient_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS email_deliveries (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    delivery_uid     VARCHAR(36) NOT NULL,
    campaign_id     BIGINT UNSIGNED NOT NULL,
    recipient_id    BIGINT UNSIGNED NOT NULL,
    sender_id       BIGINT UNSIGNED NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    to_email        VARCHAR(320) NOT NULL,
    to_name         VARCHAR(255) NOT NULL DEFAULT '',
    subject         VARCHAR(500) NOT NULL,
    body            MEDIUMTEXT NOT NULL,
    status          ENUM('pending','queued','scheduled','in_progress','sent','failed','rescheduled','cancelled') NOT NULL DEFAULT 'pending',
    scheduled_time  TIMESTAMP NOT NULL,
    actual_send_time TIMESTAMP NULL,
    attempts        INT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts    INT UNSIGNED NOT NULL DEFAULT 5,
    last_error      TEXT NULL,
    ethereal_preview_url VARCHAR(1024) NOT NULL DEFAULT '',
    ethereal_message_id VARCHAR(255) NOT NULL DEFAULT '',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_delivery_uid (delivery_uid),
    UNIQUE KEY uq_delivery_campaign_recipient (campaign_id, recipient_id),
    KEY idx_delivery_status (status),
    KEY idx_delivery_scheduled (scheduled_time),
    KEY idx_delivery_user (user_id),
    KEY idx_delivery_sender (sender_id),
    KEY idx_delivery_campaign (campaign_id),
    CONSTRAINT fk_delivery_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_delivery_recipient FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE CASCADE,
    CONSTRAINT fk_delivery_sender FOREIGN KEY (sender_id) REFERENCES sender_configs(id) ON DELETE CASCADE,
    CONSTRAINT fk_delivery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS slack_integrations (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    team_id         VARCHAR(64) NOT NULL,
    team_name       VARCHAR(255) NOT NULL DEFAULT '',
    bot_user_id     VARCHAR(64) NOT NULL DEFAULT '',
    access_token    VARCHAR(255) NOT NULL,
    scopes          VARCHAR(1024) NOT NULL DEFAULT '',
    webhook_url     VARCHAR(1024) NOT NULL DEFAULT '',
    is_connected    TINYINT(1) NOT NULL DEFAULT 1,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_slack_user_team (user_id, team_id),
    KEY idx_slack_user (user_id),
    CONSTRAINT fk_slack_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS rate_limit_events (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sender_id     BIGINT UNSIGNED NOT NULL,
    event_type    ENUM('send','reschedule','hourly_limit_hit') NOT NULL,
    window_key    VARCHAR(128) NOT NULL DEFAULT '',
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_rate_sender (sender_id),
    KEY idx_rate_window (window_key),
    KEY idx_rate_created (created_at),
    CONSTRAINT fk_rate_sender FOREIGN KEY (sender_id) REFERENCES sender_configs(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS slack_notifications (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sender_id     BIGINT UNSIGNED NOT NULL,
    window_key    VARCHAR(128) NOT NULL,
    notified_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_slack_notif_sender_window (sender_id, window_key),
    CONSTRAINT fk_slack_notif_sender FOREIGN KEY (sender_id) REFERENCES sender_configs(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export async function runMigrations(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    for (const stmt of statements) {
      await conn.execute(stmt);
    }
    logger.info('Database migrations completed successfully');
  } finally {
    conn.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}
