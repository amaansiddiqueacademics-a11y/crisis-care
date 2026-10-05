#!/usr/bin/env node
/**
 * DEPRECATED 2026-09-20: Replaced by scripts/data-import/seed_json_hospitals.js
 * which seeds from files/crisis_care_hospitals.json (80 real hospitals).
 * This script seeded the old ~41-hospital ORS-geocoded dataset and must NOT
 * be run again. It is kept for audit purposes only.
 *
 * Crisis Care — Hand-Verified Hospital Seeder (LEGACY)
 *
 * Replaces the contaminated OSM-scraped dataset with a curated allowlist of
 * ~41 real, named hospitals across Mumbai, Pune, Nandurbar, and Gadchiroli.
 *
 * Steps:
 *   1. TRUNCATE reservations → resources → admin_users → hospitals (CASCADE-safe)
 *   2. Geocode each entry via ORS Geocoding API (ORS_API_KEY from root .env)
 *   3. Insert successfully-geocoded hospitals into hospitals(name, address, geom, tier)
 *   4. Initialize one resources row per resource_type_enum at quantity_available=0
 *   5. Print a summary: geocoded OK / skipped / reasons
 *
 * Usage:
 *   node scripts/data-import/seed_real_hospitals.js
 *   DATABASE_URL=postgresql://... node scripts/data-import/seed_real_hospitals.js
 *
 * DESTRUCTIVE: clears all existing hospitals and dependents.
 * Re-run `node backend/gateway/scripts/seed-admin.js` afterwards.
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { Client } = require('pg');

// ---------------------------------------------------------------------------
// Load root .env manually (dotenv is not installed at the project root)
// ---------------------------------------------------------------------------
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

const ORS_API_KEY = process.env.ORS_API_KEY;
if (!ORS_API_KEY) {
  console.error('[FATAL] ORS_API_KEY not found in environment. Check root .env.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// All 18 resource types (mirrors resource_type_enum in schema)
// ---------------------------------------------------------------------------

const RESOURCE_TYPES = [
  'icu_bed',
  'blood_a_pos',
  'blood_a_neg',
  'blood_b_pos',
  'blood_b_neg',
  'blood_o_pos',
  'blood_o_neg',
  'blood_ab_pos',
  'blood_ab_neg',
  'oxygen_cylinder',
  'ventilator',
  'specialist_trauma_surgeon',
  'specialist_cardiologist',
  'specialist_neurologist',
  'specialist_pediatric_er',
  'equipment_dialysis',
  'equipment_mri_trauma_ready',
  'equipment_ct_scanner',
];

// ---------------------------------------------------------------------------
// City centre focus points — used to bias ORS geocoding toward the right city.
// ORS focus.point biases ranking; boundary.rect strictly constrains results.
// ---------------------------------------------------------------------------

const CITY_CONFIG = {
  Mumbai: {
    focusLon: 72.8777, focusLat: 19.0760,
    // Tight bounding box: Greater Mumbai island + suburbs
    rectMinLon: 72.72, rectMinLat: 18.87, rectMaxLon: 73.10, rectMaxLat: 19.35,
  },
  Pune: {
    focusLon: 73.8567, focusLat: 18.5204,
    // PMC + PCMC metro area
    rectMinLon: 73.72, rectMinLat: 18.40, rectMaxLon: 74.08, rectMaxLat: 18.72,
  },
  Nandurbar: {
    focusLon: 74.2433, focusLat: 21.3686,
    // Nandurbar district
    rectMinLon: 73.88, rectMinLat: 21.33, rectMaxLon: 74.68, rectMaxLat: 22.20,
  },
  Gadchiroli: {
    focusLon: 80.0029, focusLat: 20.1809,
    // Gadchiroli district
    rectMinLon: 79.55, rectMinLat: 19.72, rectMaxLon: 80.58, rectMaxLat: 20.85,
  },
};

// Hard sanity bounds for all of Maharashtra
const MH_BOUNDS = { minLat: 15.6, maxLat: 22.1, minLon: 72.6, maxLon: 80.9 };

// ---------------------------------------------------------------------------
// Hand-verified allowlist
// Fields: name, locality, city, tier
//   Tier 1 = Urban hub (Mumbai, Pune)
//   Tier 3 = Rural     (Nandurbar, Gadchiroli)
// ---------------------------------------------------------------------------

const HOSPITALS = [
  // ── MUMBAI (Tier 1) ──────────────────────────────────────────────────────
  { name: 'King Edward Memorial (KEM) Hospital',              locality: 'Parel',                  city: 'Mumbai',     tier: 1 },
  { name: 'Lokmanya Tilak Municipal General Hospital',        locality: 'Sion',                   city: 'Mumbai',     tier: 1 },
  { name: 'Sir J.J. Hospital',                                locality: 'Byculla',                city: 'Mumbai',     tier: 1 },
  { name: 'Lilavati Hospital and Research Centre',            locality: 'Bandra West',            city: 'Mumbai',     tier: 1 },
  { name: 'Kokilaben Dhirubhai Ambani Hospital',              locality: 'Andheri West',           city: 'Mumbai',     tier: 1 },
  { name: 'P.D. Hinduja Hospital and Medical Research Centre',locality: 'Mahim',                  city: 'Mumbai',     tier: 1 },
  { name: 'Nanavati Max Super Speciality Hospital',           locality: 'Vile Parle West',        city: 'Mumbai',     tier: 1 },
  { name: 'Breach Candy Hospital Trust',                      locality: 'Breach Candy',           city: 'Mumbai',     tier: 1 },
  { name: 'Jaslok Hospital and Research Centre',              locality: 'Pedder Road',            city: 'Mumbai',     tier: 1 },
  { name: 'Tata Memorial Hospital',                           locality: 'Parel',                  city: 'Mumbai',     tier: 1 },
  { name: 'Bombay Hospital and Medical Research Centre',      locality: 'Marine Lines',           city: 'Mumbai',     tier: 1 },
  { name: 'Wockhardt Hospital',                               locality: 'Mumbai Central',         city: 'Mumbai',     tier: 1 },
  { name: 'Global Hospital',                                  locality: 'Parel',                  city: 'Mumbai',     tier: 1 },
  { name: 'Fortis Hospital',                                  locality: 'Mulund West',            city: 'Mumbai',     tier: 1 },
  { name: 'Holy Family Hospital',                             locality: 'Bandra West',            city: 'Mumbai',     tier: 1 },
  { name: 'Cooper Hospital',                                  locality: 'Vile Parle West',        city: 'Mumbai',     tier: 1 },
  { name: 'Rajawadi Hospital',                                locality: 'Ghatkopar East',         city: 'Mumbai',     tier: 1 },
  { name: 'Saifee Hospital',                                  locality: 'Charni Road',            city: 'Mumbai',     tier: 1 },
  { name: 'Bhatia Hospital',                                  locality: 'Tardeo',                 city: 'Mumbai',     tier: 1 },
  { name: 'Sir H.N. Reliance Foundation Hospital',            locality: 'Girgaon',                city: 'Mumbai',     tier: 1 },
  { name: 'Masina Hospital',                                  locality: 'Byculla',                city: 'Mumbai',     tier: 1 },
  { name: 'St. George Hospital',                              locality: 'Fort',                   city: 'Mumbai',     tier: 1 },

  // ── PUNE (Tier 1) ─────────────────────────────────────────────────────────
  { name: 'Sassoon General Hospital',                         locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Ruby Hall Clinic',                                 locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Jehangir Hospital',                                locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Deenanath Mangeshkar Hospital',                    locality: 'Erandwane',              city: 'Pune',       tier: 1 },
  { name: 'Sahyadri Super Speciality Hospital',               locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'King Edward Memorial Hospital',                    locality: 'Rasta Peth',             city: 'Pune',       tier: 1 },
  { name: 'Command Hospital Southern Command',                locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Bharati Hospital and Research Centre',             locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Poona Hospital and Research Centre',               locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Aditya Birla Memorial Hospital',                   locality: 'Chinchwad',              city: 'Pune',       tier: 1 },
  { name: 'Noble Hospital',                                   locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Inlaks and Budhrani Hospital',                     locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Sancheti Hospital',                                locality: 'Pune',                   city: 'Pune',       tier: 1 },
  { name: 'Yashwantrao Chavan Memorial Hospital',             locality: 'Pimpri',                 city: 'Pune',       tier: 1 },
  { name: 'D.Y. Patil Hospital',                              locality: 'Pimpri',                 city: 'Pune',       tier: 1 },

  // ── NANDURBAR (Tier 3) ────────────────────────────────────────────────────
  { name: 'Government Medical College and Hospital Nandurbar',locality: 'Nandurbar',              city: 'Nandurbar',  tier: 3 },
  { name: 'Civil Hospital Nandurbar',                         locality: 'Sakri Road',             city: 'Nandurbar',  tier: 3 },

  // ── GADCHIROLI (Tier 3) ───────────────────────────────────────────────────
  { name: 'Government General Hospital Gadchiroli',           locality: 'Mul Road',               city: 'Gadchiroli', tier: 3 },
  { name: 'Maa Danteshwari Hospital SEARCH Shodhgram',        locality: 'Shodhgram Chatgaon Dhanora Taluka', city: 'Gadchiroli', tier: 3 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Geocode a single hospital entry via ORS with three layers of accuracy:
 *  1. boundary.rect  — hard box constrains results to the city's area
 *  2. focus.point    — biases ranking toward the city centre
 *  3. Coordinate sanity check — rejects anything outside Maharashtra
 */
async function geocode(entry) {
  const cityConf = CITY_CONFIG[entry.city];
  if (!cityConf) return { error: `No city config for "${entry.city}"` };

  const query = `${entry.name}, ${entry.locality}, ${entry.city}, Maharashtra, India`;
  const url = new URL('https://api.openrouteservice.org/geocode/search');
  url.searchParams.set('api_key', ORS_API_KEY);
  url.searchParams.set('text', query);
  url.searchParams.set('size', '3'); // fetch top 3; we'll pick best inside bbox

  // Focus biases ranking toward city centre
  url.searchParams.set('focus.point.lon', String(cityConf.focusLon));
  url.searchParams.set('focus.point.lat', String(cityConf.focusLat));

  // Bounding rect: strictly constrains results to the city area
  url.searchParams.set('boundary.rect.min_lon', String(cityConf.rectMinLon));
  url.searchParams.set('boundary.rect.min_lat', String(cityConf.rectMinLat));
  url.searchParams.set('boundary.rect.max_lon', String(cityConf.rectMaxLon));
  url.searchParams.set('boundary.rect.max_lat', String(cityConf.rectMaxLat));

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const features = data.features;

    if (!features || features.length === 0) {
      return { error: 'No features in bbox — hospital may not be in ORS index' };
    }

    const feature = features[0];
    const [lon, lat] = feature.geometry.coordinates;
    const label = feature.properties?.label || '(no label)';
    const confidence = feature.properties?.confidence ?? null;

    // Hard sanity check: must be inside Maharashtra
    if (lat < MH_BOUNDS.minLat || lat > MH_BOUNDS.maxLat ||
        lon < MH_BOUNDS.minLon || lon > MH_BOUNDS.maxLon) {
      return { error: `Out-of-state coords (${lat.toFixed(4)}, ${lon.toFixed(4)}): "${label}"` };
    }

    return { lon, lat, label, confidence };

  } catch (err) {
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Crisis Care — Hand-Verified Hospital Seeder            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('[db] Connected.\n');

  // ── Step 1: Clear existing data ─────────────────────────────────────────
  // Order: child tables first, then hospitals (FK constraints).
  // reservations and resources both CASCADE from hospitals, but admin_users
  // also CASCADE — so DELETE FROM hospitals alone is sufficient.
  // We spell it out explicitly for clarity and safety.
  console.log('[db] Clearing existing data (reservations → resources → admin_users → hospitals)…');
  await client.query('BEGIN');
  const { rows: [{ count: oldHospitals }] } = await client.query('SELECT COUNT(*) AS count FROM hospitals');
  // Cascade handles resources, admin_users, reservations automatically
  await client.query('DELETE FROM hospitals');
  await client.query("SELECT setval(pg_get_serial_sequence('hospitals','id'), 1, false)");
  await client.query("SELECT setval(pg_get_serial_sequence('resources','id'), 1, false)");
  await client.query('COMMIT');
  console.log(`[db] Deleted ${oldHospitals} existing hospital rows (cascades cleared dependents).\n`);

  // ── Step 2: Geocode each entry ────────────────────────────────────────────
  console.log(`[geocode] Geocoding ${HOSPITALS.length} entries via ORS…`);
  console.log('[geocode] Rate: 1 request/sec (ORS free tier: 100/min, 1000/day)\n');

  const results = [];
  const skipped = [];

  for (let i = 0; i < HOSPITALS.length; i++) {
    const entry = HOSPITALS[i];
    const label = `[${i + 1}/${HOSPITALS.length}]`;

    process.stdout.write(`${label} ${entry.name.substring(0, 55).padEnd(55)} → `);

    const geo = await geocode(entry);

    if (geo.error) {
      console.log(`SKIP — ${geo.error}`);
      skipped.push({ entry, reason: geo.error });
    } else {
      const confStr = geo.confidence !== null ? ` [conf=${geo.confidence.toFixed(2)}]` : '';
      console.log(`OK   ${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}${confStr}`);
      results.push({ entry, lon: geo.lon, lat: geo.lat, label: geo.label });
    }

    // Courtesy pause: ~1 req/sec to stay well within ORS limits
    if (i < HOSPITALS.length - 1) await sleep(700);
  }

  console.log(`\n[geocode] Done. OK: ${results.length}  Skipped: ${skipped.length}\n`);

  if (results.length === 0) {
    console.error('[FATAL] No hospitals geocoded successfully. Check ORS_API_KEY and network.');
    await client.end();
    process.exit(1);
  }

  // ── Step 3: Insert hospitals ──────────────────────────────────────────────
  console.log(`[db] Inserting ${results.length} hospitals…`);
  await client.query('BEGIN');

  const insertedIds = [];
  for (const { entry, lon, lat } of results) {
    const address = `${entry.locality}, ${entry.city}, Maharashtra`;
    const { rows: [{ id }] } = await client.query(
      `INSERT INTO hospitals (name, geom, address, tier)
       VALUES (
         $1,
         ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
         $4, $5
       )
       RETURNING id`,
      [entry.name, lon, lat, address, entry.tier]
    );
    insertedIds.push(id);
  }

  await client.query('COMMIT');
  console.log(`[db] ✓ Inserted ${insertedIds.length} hospitals.\n`);

  // ── Step 4: Initialize resources ─────────────────────────────────────────
  console.log(`[db] Initializing resources (${insertedIds.length} hospitals × ${RESOURCE_TYPES.length} types = ${insertedIds.length * RESOURCE_TYPES.length} rows)…`);
  await client.query('BEGIN');

  let resourceRows = 0;
  for (const hospitalId of insertedIds) {
    for (const resourceType of RESOURCE_TYPES) {
      await client.query(
        `INSERT INTO resources (hospital_id, resource_type, quantity_available)
         VALUES ($1, $2, 0)
         ON CONFLICT (hospital_id, resource_type) DO NOTHING`,
        [hospitalId, resourceType]
      );
      resourceRows++;
    }
  }

  await client.query('COMMIT');
  console.log(`[db] ✓ Initialized ${resourceRows} resource rows.\n`);

  // ── Step 5: Summary ───────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════');
  console.log('  GEOCODING SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Total attempted : ${HOSPITALS.length}`);
  console.log(`  Geocoded OK     : ${results.length}`);
  console.log(`  Skipped         : ${skipped.length}`);

  if (skipped.length > 0) {
    console.log('\n  ── Skipped entries (fix before review) ──');
    skipped.forEach(({ entry, reason }) => {
      console.log(`  ✗ ${entry.name.substring(0, 45).padEnd(45)} — ${reason}`);
    });
  }

  console.log('\n  ── Inserted hospitals by city ──');
  const cityCount = {};
  for (const { entry } of results) {
    cityCount[entry.city] = (cityCount[entry.city] || 0) + 1;
  }
  for (const [city, count] of Object.entries(cityCount)) {
    console.log(`  ${city.padEnd(15)} ${count}`);
  }

  console.log('\n  ── DB verification ──');
  const { rows: dbSummary } = await client.query(
    `SELECT tier, COUNT(*) AS count FROM hospitals GROUP BY tier ORDER BY tier`
  );
  for (const row of dbSummary) {
    const label = row.tier == 1 ? 'Urban (Mumbai/Pune)' : 'Rural (Nandurbar/Gadchiroli)';
    console.log(`  Tier ${row.tier} — ${label}: ${row.count}`);
  }

  console.log('\n  ── Sample coordinates (first 8) ──');
  const { rows: sample } = await client.query(
    `SELECT name,
       ROUND(ST_Y(geom::geometry)::numeric, 5) AS lat,
       ROUND(ST_X(geom::geometry)::numeric, 5) AS lng
     FROM hospitals ORDER BY id LIMIT 8`
  );
  sample.forEach(r =>
    console.log(`  ${r.name.substring(0, 48).padEnd(48)} ${r.lat}, ${r.lng}`)
  );

  console.log('══════════════════════════════════════════════════════════\n');

  if (skipped.length > 0) {
    console.log(`[warn] ${skipped.length} entr${skipped.length === 1 ? 'y' : 'ies'} skipped — review the list above and fix before the demo.`);
  }

  console.log('[done] Re-run:  node backend/gateway/scripts/seed-admin.js');
  console.log('       to recreate the admin account (it was cascade-deleted with the old hospitals).\n');

  await client.end();
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
