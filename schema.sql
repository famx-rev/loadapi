-- Loadbar schema (MySQL / TiDB)
-- Run this once on your database cluster

CREATE TABLE IF NOT EXISTS startups (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  owner_id    VARCHAR(255)  NOT NULL,
  name        VARCHAR(60)   NOT NULL,
  domain      VARCHAR(100)  NOT NULL,
  tagline     VARCHAR(120)  NOT NULL,
  url         VARCHAR(300)  NOT NULL,
  accent_from VARCHAR(20)   NOT NULL DEFAULT '#3dd79e',
  accent_to   VARCHAR(20)   NOT NULL DEFAULT '#0b9a6c',
  verified    TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_domain (domain),
  KEY idx_owner (owner_id),
  KEY idx_created (created_at)
);

CREATE TABLE IF NOT EXISTS events (
  id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  startup_id   VARCHAR(36)  NOT NULL,
  kind         VARCHAR(20)  NOT NULL,
  country      VARCHAR(100) DEFAULT NULL,
  country_code VARCHAR(10)  DEFAULT NULL,
  city         VARCHAR(100) DEFAULT NULL,
  device       VARCHAR(50)  DEFAULT NULL,
  referrer     VARCHAR(100) DEFAULT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_startup (startup_id),
  KEY idx_kind (kind),
  KEY idx_created (created_at),
  CONSTRAINT fk_events_startup FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE
);
