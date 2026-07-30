-- Migration 005: Create admin_users table
--
-- One row per hospital admin account.
-- hospital_id FK (not a back-reference on hospitals) — avoids the circular FK
-- that a hospitals.admin_user_id would create (see PRD.md Section 7).
-- Also supports multiple admin accounts per hospital in future without
-- any schema change — just add more rows with the same hospital_id.
--
-- hashed_password stores a bcrypt hash; the plaintext is never stored.
-- username must be unique across all hospitals (used as login credential).

CREATE TABLE IF NOT EXISTS admin_users (
    id              SERIAL PRIMARY KEY,
    hospital_id     INTEGER NOT NULL REFERENCES hospitals(id),
    username        VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
