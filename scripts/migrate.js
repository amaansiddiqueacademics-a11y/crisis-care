#!/usr/bin/env node
/**
 * Crisis Care — Database Migration Runner
 *
 * Applies all SQL files in db/migrations/ in filename order against DATABASE_URL.
 * Safe to re-run against a fresh database:
 *   - Uses IF NOT EXISTS / CREATE EXTENSION IF NOT EXISTS where possible.
 *   - Wraps each migration in a transaction; rolls back the individual file on error.
 *   - Tracks applied migrations in a _migrations table to skip already-applied files.
 *
 * Usage:
 *   node scripts/migrate.js
 *   DATABASE_URL=postgresql://... node scripts/migrate.js
 *
 * Prerequisites: npm install pg (listed in devDependencies of root package.json)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('[migrate] Connected to database.');

    // Create the tracking table if it doesn't already exist.
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Collect and sort migration files by filename (numeric prefix ensures order).
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('[migrate] No migration files found.');
      return;
    }

    for (const filename of files) {
      // Check whether this file has already been applied.
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1',
        [filename]
      );

      if (rows.length > 0) {
        console.log(`[migrate] SKIP   ${filename} (already applied)`);
        continue;
      }

      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, 'utf8');

      console.log(`[migrate] APPLY  ${filename}`);

      // Run each migration inside its own transaction so a failure only
      // rolls back that file, leaving previously applied files intact.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`[migrate] OK     ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ERROR  ${filename}: ${err.message}`);
        process.exit(1);
      }
    }

    console.log('[migrate] All migrations complete.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[migrate] Fatal:', err.message);
  process.exit(1);
});
