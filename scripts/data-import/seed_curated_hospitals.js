#!/usr/bin/env node
/**
 * DEPRECATED 2026-09-20: Replaced by scripts/data-import/seed_json_hospitals.js
 * which seeds from files/crisis_care_hospitals.json (80 real hospitals).
 * This script seeded from the Overpass/OSM API and must NOT be run again.
 * Kept for audit purposes only.
 *
 * Crisis Care V2 — Curated Hospital Seeder (LEGACY)
 *
 * Queries OpenStreetMap Overpass API for amenity=hospital and amenity=clinic
 * across four Maharashtra regions, deduplicates, caps at 60-80 hospitals,
 * assigns tiers per PRD §4, and upserts into the hospitals table.
 *
 * Regions and quotas:
 *   Mumbai Metro  → Tier 1 — up to 30 hospitals
 *   Pune Metro    → Tier 1 — up to 25 hospitals
 *   Nashik        → Tier 2 — up to 8 hospitals   (representative district hub)
 *   Nandurbar     → Tier 3 — up to 8 hospitals
 *   Gadchiroli    → Tier 3 — up to 7 hospitals
 *   Total target: 60–78 real OSM hospitals
 *
 * Tier semantics (PRD §4, §12):
 *   Tier 1 — Urban hub  (Mumbai, Pune): high Poisson λ, high density
 *   Tier 2 — District   (Nashik):       moderate λ
 *   Tier 3 — Rural      (Nandurbar, Gadchiroli): low λ, sparse
 *
 * Run:
 *   node scripts/data-import/seed_curated_hospitals.js
 *   DATABASE_URL=postgresql://... node scripts/data-import/seed_curated_hospitals.js
 *
 * DESTRUCTIVE: clears all existing hospitals (and cascades to resources,
 * admin_users, reservations, incidents) before inserting the curated set.
 * Re-run seed-admin.js afterwards to recreate admin accounts.
 */

'use strict';

const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

// ---------------------------------------------------------------------------
// Region definitions
// Bounding boxes verified against OSM Nominatim + map inspection.
// Overpass bbox order: south, west, north, east
// ---------------------------------------------------------------------------

const REGIONS = [
  {
    name:  'Mumbai Metro',
    tier:  1,
    quota: 30,
    // Greater Mumbai + Navi Mumbai + Thane city corridor
    bbox:  { south: 18.87, west: 72.72, north: 19.35, east: 73.10 },
  },
  {
    name:  'Pune Metro',
    tier:  1,
    quota: 25,
    // PMC + PCMC (Pimpri-Chinchwad) metro area
    bbox:  { south: 18.40, west: 73.72, north: 18.72, east: 74.08 },
  },
  {
    name:  'Nashik',
    tier:  2,
    quota: 8,
    // Nashik Municipal Corporation + immediate surrounds
    bbox:  { south: 19.93, west: 73.72, north: 20.07, east: 73.93 },
  },
  {
    name:  'Nandurbar',
    tier:  3,
    quota: 8,
    // Nandurbar district (entire district — sparse coverage expected)
    bbox:  { south: 21.33, west: 73.88, north: 22.20, east: 74.68 },
  },
  {
    name:  'Gadchiroli',
    tier:  3,
    quota: 7,
    // Gadchiroli district (entire district — very sparse, tribal area)
    bbox:  { south: 19.72, west: 79.55, north: 20.85, east: 80.58 },
  },
];

// Overpass mirrors — tried in order on failure
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const RATE_LIMIT_MS = 1500;   // courtesy pause between Overpass requests
const DEDUP_RADIUS_M = 300;   // drop entries within 300 m with the same name

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Overpass fetch
// ---------------------------------------------------------------------------

async function fetchOverpass(region) {
  const { bbox } = region;
  const q =
    `[out:json][timeout:60];` +
    `(` +
    `node["amenity"="hospital"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});` +
    `way["amenity"="hospital"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});` +
    `relation["amenity"="hospital"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});` +
    `node["amenity"="clinic"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});` +
    `way["amenity"="clinic"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});` +
    `);` +
    `out center tags;`;

  let lastErr;
  for (const mirror of OVERPASS_MIRRORS) {
    const url = `${mirror}?data=${encodeURIComponent(q)}`;
    console.log(`  [overpass] ${region.name} → ${mirror.replace('https://', '').split('/')[0]}`);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CrisisCareV2/1.0 (academic project; maharashtra hospital seeder)',
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${mirror}`);
        console.warn(`  [overpass] ${lastErr.message} — trying next mirror`);
        await sleep(RATE_LIMIT_MS);
        continue;
      }
      const data = await res.json();
      if (!Array.isArray(data.elements)) throw new Error('No elements in response');
      console.log(`  [overpass] ${region.name}: ${data.elements.length} raw elements`);
      return data.elements;
    } catch (err) {
      lastErr = err;
      console.warn(`  [overpass] ${mirror.split('/')[2]} failed: ${err.message}`);
      await sleep(RATE_LIMIT_MS);
    }
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

// ---------------------------------------------------------------------------
// Parse elements → hospital records
// ---------------------------------------------------------------------------

function parseElements(elements) {
  const records = [];

  for (const el of elements) {
    const tags = el.tags || {};

    // Prefer English name, then local name, then official_name
    const name =
      tags['name:en'] ||
      tags.name ||
      tags['official_name'] ||
      null;
    if (!name || name.trim().length < 3) continue;

    // Coordinates: nodes have lat/lon directly; ways/relations have a center
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    // Skip entries that are clearly not real hospitals
    const nameLower = name.toLowerCase();
    const skipWords = ['veterinary', 'vet clinic', 'animal', 'dental only', 'dispensary note'];
    if (skipWords.some(w => nameLower.includes(w))) continue;

    // Build address from OSM addr: tags
    const addrParts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:suburb'] || tags['addr:neighbourhood'],
      tags['addr:city'] || tags['addr:town'] || tags['addr:district'],
      tags['addr:postcode'],
    ].filter(Boolean);
    const address = addrParts.length > 0 ? addrParts.join(', ') : null;

    const phoneRaw = tags.phone || tags['contact:phone'] || null;
    // Truncate to 100 chars — OSM phone tags can include multiple numbers
    const phone = phoneRaw ? phoneRaw.substring(0, 100) : null;

    records.push({ name: name.trim(), lat, lng, address, phone });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Deduplicate within-region: same (normalised) name within DEDUP_RADIUS_M
// ---------------------------------------------------------------------------

function dedup(records) {
  const kept = [];
  for (const rec of records) {
    const normName = rec.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isDup = kept.some(k => {
      const kNorm = k.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (kNorm !== normName) return false;
      return haversineM(rec.lat, rec.lng, k.lat, k.lng) < DEDUP_RADIUS_M;
    });
    if (!isDup) kept.push(rec);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Cross-region deduplicate: drop records that are already in `existing`
// using the same name+proximity rule
// ---------------------------------------------------------------------------

function deduplicateAgainstExisting(newRecords, existing) {
  return newRecords.filter(rec => {
    const normName = rec.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !existing.some(e => {
      const eNorm = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (eNorm !== normName) return false;
      return haversineM(rec.lat, rec.lng, e.lat, e.lng) < DEDUP_RADIUS_M;
    });
  });
}

// ---------------------------------------------------------------------------
// Prioritise: prefer records with more metadata (address, phone)
// Tiebreak by name length (more descriptive names rank higher)
// ---------------------------------------------------------------------------

function prioritise(records) {
  return records.slice().sort((a, b) => {
    const scoreA = (a.address ? 2 : 0) + (a.phone ? 1 : 0);
    const scoreB = (b.address ? 2 : 0) + (b.phone ? 1 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.name.length - a.name.length;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Crisis Care V2 — Curated Hospital Seeder           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('[db] Connected.\n');

  // ── Step 1: Clear existing hospital data ──────────────────────────────────
  // ON DELETE CASCADE handles resources, admin_users, reservations, incidents.
  // query_log.matched_hospital_id / baseline_hospital_id are SET NULL (safe).
  console.log('[db] Clearing existing hospitals (and cascaded dependents)…');
  await client.query('BEGIN');
  const { rows: [{ count: oldCount }] } = await client.query(
    'SELECT COUNT(*) AS count FROM hospitals'
  );
  await client.query('DELETE FROM hospitals');
  // Reset the sequence so IDs start clean
  await client.query("SELECT setval(pg_get_serial_sequence('hospitals','id'), 1, false)");
  await client.query('COMMIT');
  console.log(`[db] Deleted ${oldCount} existing rows.\n`);

  // ── Step 2: Fetch, parse, dedup each region ───────────────────────────────
  const allInserted = [];

  for (const region of REGIONS) {
    console.log(`\n─── ${region.name.toUpperCase()} (Tier ${region.tier}, quota ${region.quota}) ───`);

    let elements;
    try {
      elements = await fetchOverpass(region);
    } catch (err) {
      console.error(`  [WARN] Overpass failed for ${region.name}: ${err.message}`);
      console.error(`  [WARN] Skipping ${region.name} — no data inserted for this region.`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    await sleep(RATE_LIMIT_MS); // rate-limit between regions

    // Parse
    let records = parseElements(elements);
    console.log(`  Parsed:      ${records.length} named entries`);

    // Dedup within region
    records = dedup(records);
    console.log(`  After dedup: ${records.length}`);

    // Cross-region dedup against what we've already committed
    records = deduplicateAgainstExisting(records, allInserted);
    console.log(`  After cross-region dedup: ${records.length}`);

    // Prioritise (more metadata first)
    records = prioritise(records);

    // Apply quota
    records = records.slice(0, region.quota);
    console.log(`  After quota: ${records.length}`);

    if (records.length === 0) {
      console.log(`  [WARN] No records to insert for ${region.name}.`);
      continue;
    }

    // ── Insert ──────────────────────────────────────────────────────────────
    await client.query('BEGIN');
    let inserted = 0;
    for (const h of records) {
      await client.query(
        `INSERT INTO hospitals (name, geom, address, phone, tier)
         VALUES (
           $1,
           ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           $4, $5, $6
         )`,
        [h.name, h.lng, h.lat, h.address, h.phone, region.tier]
      );
      // Track for cross-region dedup
      allInserted.push({ name: h.name, lat: h.lat, lng: h.lng });
      inserted++;
    }
    await client.query('COMMIT');
    console.log(`  ✓ Inserted ${inserted} hospitals (Tier ${region.tier}) for ${region.name}`);
  }

  // ── Step 3: Summary ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Final hospital count by tier:');
  console.log('══════════════════════════════════════════════════════');

  const { rows: summary } = await client.query(
    `SELECT tier, COUNT(*) AS count
     FROM hospitals
     GROUP BY tier
     ORDER BY tier`
  );
  let total = 0;
  for (const row of summary) {
    const label =
      row.tier === 1 ? 'Urban hub  (Mumbai/Pune)' :
      row.tier === 2 ? 'District   (Nashik)     ' :
      'Rural      (Nandurbar/Gadchiroli)';
    console.log(`  Tier ${row.tier} — ${label}: ${row.count}`);
    total += parseInt(row.count, 10);
  }
  console.log('──────────────────────────────────────────────────────');
  console.log(`  TOTAL: ${total} hospitals`);
  console.log('══════════════════════════════════════════════════════\n');

  const { rows: sample } = await client.query(
    `SELECT tier, name,
       ROUND(ST_Y(geom::geometry)::numeric, 4) AS lat,
       ROUND(ST_X(geom::geometry)::numeric, 4) AS lng
     FROM hospitals
     ORDER BY tier, id
     LIMIT 10`
  );
  console.log('  Sample (first 10):');
  sample.forEach(r =>
    console.log(`  [T${r.tier}] ${r.name.substring(0, 50).padEnd(50)} ${r.lat}, ${r.lng}`)
  );

  console.log('\n[done] Re-run `node backend/gateway/scripts/seed-admin.js` to recreate admin accounts.');

  await client.end();
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
