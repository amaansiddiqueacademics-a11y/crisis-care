-- =============================================================================
-- Crisis Care — Migration 003: Fix hospital FK delete rules
--
-- The V1 DDL created some FK constraints without ON DELETE behaviour.
-- This migration replaces them with the correct semantics:
--   admin_users.hospital_id   → CASCADE  (admin accounts are per-hospital)
--   query_log.matched_hospital_id   → SET NULL (preserve log row, null the ref)
--   query_log.baseline_hospital_id  → SET NULL
-- =============================================================================

BEGIN;

-- ── admin_users.hospital_id ──────────────────────────────────────────────────

ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_hospital_id_fkey;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_hospital_id_fkey
  FOREIGN KEY (hospital_id)
  REFERENCES hospitals (id)
  ON DELETE CASCADE;

-- ── query_log.matched_hospital_id ────────────────────────────────────────────

ALTER TABLE query_log
  DROP CONSTRAINT IF EXISTS query_log_matched_hospital_id_fkey;

ALTER TABLE query_log
  ADD CONSTRAINT query_log_matched_hospital_id_fkey
  FOREIGN KEY (matched_hospital_id)
  REFERENCES hospitals (id)
  ON DELETE SET NULL;

-- ── query_log.baseline_hospital_id ───────────────────────────────────────────

ALTER TABLE query_log
  DROP CONSTRAINT IF EXISTS query_log_baseline_hospital_id_fkey;

ALTER TABLE query_log
  ADD CONSTRAINT query_log_baseline_hospital_id_fkey
  FOREIGN KEY (baseline_hospital_id)
  REFERENCES hospitals (id)
  ON DELETE SET NULL;

COMMIT;
