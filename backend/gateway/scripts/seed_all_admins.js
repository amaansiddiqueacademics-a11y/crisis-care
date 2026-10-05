'use strict';
/**
 * Crisis Care — Bulk Admin Account Seeder v2 (2026-09-20)
 *
 * Reads files/hospital_admin_credentials.csv (RFC 4180 format — quoted fields
 * with commas handled correctly) and creates one admin_users row per hospital.
 * Username = seed_key column. hospital_id looked up by hospitals.seed_key.
 *
 * Password hashing: bcrypt, 12 rounds (matches gateway auth.js).
 * Never stores plaintext.
 *
 * Usage (from project root):
 *   node backend/gateway/scripts/seed_all_admins.js
 */

const path   = require('path');
const fs     = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;

function loadRootEnv() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadRootEnv();

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

// ---------------------------------------------------------------------------
// RFC 4180 CSV parser — handles double-quoted fields with embedded commas
// ---------------------------------------------------------------------------

function parseCsvRfc4180(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  const result = [];

  for (const line of lines) {
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            field += '"'; i += 2;               // escaped quote
          } else if (line[i] === '"') {
            i++; break;                          // closing quote
          } else {
            field += line[i++];
          }
        }
        fields.push(field);
        if (line[i] === ',') i++;                // skip comma after closing quote
      } else {
        // Unquoted field
        const end = line.indexOf(',', i);
        if (end === -1) {
          fields.push(line.slice(i));
          break;
        } else {
          fields.push(line.slice(i, end));
          i = end + 1;
        }
      }
    }
    result.push(fields);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = path.join(__dirname, '..', '..', '..', 'files', 'hospital_admin_credentials.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('[seed-admins] FATAL: credentials CSV not found at ' + csvPath);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(csvPath, 'utf8');
  const allRows    = parseCsvRfc4180(rawContent);
  const [headerRow, ...dataRows] = allRows;

  // Map column names to indices
  const colIdx = {};
  headerRow.forEach((col, i) => { colIdx[col.trim()] = i; });

  console.log('[seed-admins] Header columns:', headerRow);
  console.log('[seed-admins] Loaded ' + dataRows.length + ' data rows');

  const pool = new Pool({ connectionString: DATABASE_URL });

  const { rows: hospitals } = await pool.query(
    'SELECT id, seed_key, name FROM hospitals WHERE seed_key IS NOT NULL'
  );
  const keyToId   = {};
  const keyToName = {};
  for (const h of hospitals) {
    keyToId[h.seed_key]   = h.id;
    keyToName[h.seed_key] = h.name;
  }
  console.log('[seed-admins] Found ' + hospitals.length + ' hospitals in DB');

  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const row of dataRows) {
    const seedKey  = (row[colIdx['seed_key']] || '').trim();
    const username = (row[colIdx['username']] || '').trim();
    const password = (row[colIdx['password_demo_only']] || '').trim();

    if (!seedKey || !username || !password) {
      console.warn('[seed-admins] Skipping malformed row:', row);
      skipped++;
      continue;
    }

    const hospitalId = keyToId[seedKey];
    if (!hospitalId) {
      console.warn('[seed-admins] No hospital for seed_key=' + seedKey + ' — skipping');
      skipped++;
      continue;
    }

    try {
      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const { rows: result } = await pool.query(
        `INSERT INTO admin_users (hospital_id, username, hashed_password)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO UPDATE SET
           hashed_password = EXCLUDED.hashed_password,
           hospital_id     = EXCLUDED.hospital_id
         RETURNING id, (xmax = 0) AS was_insert`,
        [hospitalId, username, hashed]
      );

      if (result[0]?.was_insert) {
        inserted++;
        console.log('[seed-admins] CREATED id=' + result[0].id + ' username=' + username + ' hospital_id=' + hospitalId + ' -> ' + keyToName[seedKey]);
      } else {
        updated++;
        console.log('[seed-admins] UPDATED id=' + result[0].id + ' username=' + username);
      }
    } catch (err) {
      console.error('[seed-admins] ERROR ' + username + ': ' + err.message);
      errors++;
    }
  }

  await pool.end();
  console.log('[seed-admins] Done: inserted=' + inserted + ' updated=' + updated + ' skipped=' + skipped + ' errors=' + errors);
  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('[seed-admins] Fatal:', err.message);
  process.exit(1);
});