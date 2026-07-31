#!/usr/bin/env node
/**
 * Crisis Care — Admin account seed script
 *
 * Creates one admin_users row per hospital that doesn't already have one,
 * using bcrypt to hash the password.
 *
 * Usage:
 *   node scripts/seed-admin.js
 *   node scripts/seed-admin.js --username admin --password secret --hospital-id 1001
 *
 * Options:
 *   --username     Username for the admin account (default: admin)
 *   --password     Plain-text password to hash (default: crisis2024)
 *   --hospital-id  Hospital to associate (default: first hospital in DB)
 *
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
 *
 * Prerequisites: pg and bcrypt (in gateway devDependencies)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const bcrypt   = require('bcrypt');

const BCRYPT_ROUNDS = 12;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { username: 'admin', password: 'crisis2024', hospitalId: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username'    && args[i+1]) opts.username   = args[++i];
    if (args[i] === '--password'    && args[i+1]) opts.password   = args[++i];
    if (args[i] === '--hospital-id' && args[i+1]) opts.hospitalId = parseInt(args[++i], 10);
  }
  return opts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Resolve hospital ID if not provided
    if (!opts.hospitalId) {
      const { rows } = await pool.query(
        'SELECT id, name FROM hospitals ORDER BY id LIMIT 1',
      );
      if (!rows.length) {
        console.error('[seed-admin] No hospitals in DB. Run data-import first.');
        process.exit(1);
      }
      opts.hospitalId = rows[0].id;
      console.log(`[seed-admin] No --hospital-id given; using first hospital: "${rows[0].name}" (id=${rows[0].id})`);
    } else {
      // Validate that the hospital exists
      const { rows } = await pool.query(
        'SELECT id, name FROM hospitals WHERE id = $1',
        [opts.hospitalId],
      );
      if (!rows.length) {
        console.error(`[seed-admin] Hospital id=${opts.hospitalId} not found.`);
        process.exit(1);
      }
      console.log(`[seed-admin] Hospital: "${rows[0].name}" (id=${rows[0].id})`);
    }

    const hashed = await bcrypt.hash(opts.password, BCRYPT_ROUNDS);
    console.log(`[seed-admin] Hashing password (${BCRYPT_ROUNDS} rounds)…`);

    const { rows } = await pool.query(
      `INSERT INTO admin_users (hospital_id, username, hashed_password)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING
       RETURNING id, hospital_id, username`,
      [opts.hospitalId, opts.username, hashed],
    );

    if (rows.length === 0) {
      console.log(`[seed-admin] Username "${opts.username}" already exists — no changes made.`);
    } else {
      const row = rows[0];
      console.log(
        `[seed-admin] Created admin: id=${row.id} username="${row.username}" hospital_id=${row.hospital_id}`,
      );
      console.log(`[seed-admin] Login with: { "username": "${opts.username}", "password": "${opts.password}" }`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[seed-admin] Fatal:', err.message);
  process.exit(1);
});
