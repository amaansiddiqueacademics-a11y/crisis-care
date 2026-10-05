'use strict';

const path = require('path');
const fs   = require('fs');
const { Client } = require('pg');

function loadRootEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
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

function mapTier(entry) {
  if (entry.region_type === 'rural_sparse') return 3;
  if (entry.suggested_tier === 'A') return 1;
  return 2;
}

async function main() {
  const hospitalsPath = path.join(__dirname, '..', '..', 'files', 'crisis_care_hospitals.json');
  if (!fs.existsSync(hospitalsPath)) {
    console.error('[seed-json] FATAL: hospitals JSON not found at ' + hospitalsPath);
    process.exit(1);
  }

  const hospitals = JSON.parse(fs.readFileSync(hospitalsPath, 'utf8'));
  console.log('[seed-json] Loaded ' + hospitals.length + ' hospitals from JSON');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  let inserted = 0;
  let updated  = 0;
  let errors   = 0;

  try {
    for (const h of hospitals) {
      const tier = mapTier(h);
      try {
        const result = await client.query(
          `INSERT INTO hospitals
             (name, geom, address, phone, tier,
              seed_key, city, cluster, region_type, google_place_id)
           VALUES (
             $1,
             ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
             $4, $5, $6,
             $7, $8, $9, $10, $11
           )
           ON CONFLICT (seed_key) DO UPDATE SET
             name            = EXCLUDED.name,
             geom            = EXCLUDED.geom,
             address         = EXCLUDED.address,
             phone           = EXCLUDED.phone,
             tier            = EXCLUDED.tier,
             city            = EXCLUDED.city,
             cluster         = EXCLUDED.cluster,
             region_type     = EXCLUDED.region_type,
             google_place_id = EXCLUDED.google_place_id
           RETURNING (xmax = 0) AS was_insert, id`,
          [
            h.name,
            h.lng,
            h.lat,
            h.address || null,
            h.phone   || null,
            tier,
            h.seed_key,
            h.city    || null,
            h.cluster || null,
            h.region_type || null,
            h.google_place_id || null,
          ],
        );
        if (result.rows[0].was_insert) inserted++;
        else updated++;
      } catch (err) {
        console.error('[seed-json] ERROR ' + h.seed_key + ': ' + err.message);
        errors++;
      }
    }
  } finally {
    await client.end();
  }

  console.log('[seed-json] Done: inserted=' + inserted + ' updated=' + updated + ' errors=' + errors);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[seed-json] Fatal:', err.message);
  process.exit(1);
});