#!/usr/bin/env node
/**
 * Crisis Care — Real Hospital Data Importer
 *
 * Pulls hospital data from OpenStreetMap's Overpass API for a configurable
 * city and inserts into the hospitals table.
 *
 * Usage:
 *   node scripts/data-import/import_hospitals.js                  # defaults to Mumbai
 *   node scripts/data-import/import_hospitals.js --city "London"
 *   CITY="New York" node scripts/data-import/import_hospitals.js
 *   DATABASE_URL=postgresql://... node scripts/data-import/import_hospitals.js
 *
 * The city is resolved to a bounding box via the Nominatim geocoder,
 * then all amenity=hospital nodes/ways/relations within that box are fetched.
 *
 * Prerequisites: pg (in root devDependencies — uses native Node fetch, no extra deps)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { city: process.env.CITY || 'Mumbai', useSeed: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--city' && args[i + 1]) opts.city = args[++i];
    else if (args[i] === '--seed') opts.useSeed = true;
  }
  return opts;
}

const ARGS = parseArgs();
const CITY = ARGS.city;

// Path to the bundled seed file for the default city (Mumbai)
// used as a fallback when Overpass is unreachable.
const SEED_DIR = path.join(__dirname, '..', '..', 'db', 'seed');

// Overpass API mirrors — tried in order if the first returns an error
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

// Milliseconds to wait between Nominatim and Overpass requests (rate-limit courtesy)
const RATE_LIMIT_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolve a city name to a bounding box via Nominatim.
 * Nominatim boundingbox order: [south, north, west, east]
 */
async function getCityBoundingBox(city) {
  const url = new URL(NOMINATIM_API);
  url.searchParams.set('q', city);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  console.log(`[import] Resolving bounding box for "${city}"…`);
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'CrisisCare-DataImport/1.0 (academic project)',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data.length) throw new Error(`Nominatim returned no results for "${city}"`);

  const { boundingbox, display_name } = data[0];
  // boundingbox = [south, north, west, east] (strings)
  const [south, north, west, east] = boundingbox.map(Number);
  console.log(`[import] City resolved: "${display_name}"`);
  console.log(`[import] Bounding box: S=${south} N=${north} W=${west} E=${east}`);
  return { south, north, west, east };
}

/**
 * Fetch hospitals from Overpass API using a GET request with encoded query.
 * Tries each mirror in OVERPASS_MIRRORS until one succeeds.
 * Overpass bbox order: (south, west, north, east)
 */
async function fetchHospitalsFromOverpass({ south, north, west, east }) {
  // Use Overpass QL with [out:json] and a generous timeout
  const query =
    `[out:json][timeout:90];` +
    `(` +
    `node["amenity"="hospital"](${south},${west},${north},${east});` +
    `way["amenity"="hospital"](${south},${west},${north},${east});` +
    `relation["amenity"="hospital"](${south},${west},${north},${east});` +
    `);` +
    `out center tags;`;

  let lastError;
  for (const mirror of OVERPASS_MIRRORS) {
    // Use GET with the query in the URL — more universally accepted
    const url = `${mirror}?data=${encodeURIComponent(query)}`;
    console.log(`[import] Querying Overpass: ${mirror}…`);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CrisisCare-DataImport/1.0 (academic project)',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        lastError = new Error(`Overpass ${mirror} returned ${res.status} ${res.statusText}`);
        console.warn(`[import] Warning: ${lastError.message} — trying next mirror`);
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      const data = await res.json();
      if (!data.elements) throw new Error('Overpass response missing elements array');

      console.log(`[import] Raw elements from Overpass: ${data.elements.length}`);
      return data.elements;
    } catch (err) {
      lastError = err;
      console.warn(`[import] Warning: ${mirror} failed (${err.message}) — trying next mirror`);
      await sleep(RATE_LIMIT_MS);
    }
  }

  throw lastError || new Error('All Overpass mirrors failed');
}

/**
 * Parse raw Overpass elements into hospital records.
 */
function parseElements(elements) {
  const hospitals = [];
  const seen = new Set();

  for (const el of elements) {
    const tags = el.tags || {};

    // Prefer English name, fall back to any name tag
    const name =
      tags['name:en'] ||
      tags.name ||
      tags['official_name'] ||
      null;
    if (!name) continue;

    // Nodes have lat/lon directly; ways/relations have a center
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    // Build address from OSM addr: tags
    const addressParts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:suburb'] || tags['addr:neighbourhood'],
      tags['addr:city'] || tags['addr:town'] || tags['addr:district'],
      tags['addr:postcode'],
    ].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(', ') : null;

    // Deduplicate: same name + within 500m (same ~4-decimal-place lat/lng bucket)
    const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    hospitals.push({ name, lat, lng, address });
  }

  return hospitals;
}

// ---------------------------------------------------------------------------
// Database insertion
// ---------------------------------------------------------------------------

async function insertHospitals(hospitals) {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('[import] Connected to database.');

    let inserted = 0;
    let skipped = 0;

    for (const h of hospitals) {
      // Upsert: if a hospital with the same name already exists within ~500m, skip it.
      // This makes the import safe to re-run.
      const { rows } = await client.query(
        `SELECT id FROM hospitals
         WHERE name = $1
           AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 500)
         LIMIT 1`,
        [h.name, h.lng, h.lat],
      );

      if (rows.length > 0) {
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO hospitals (name, geom, address)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)`,
        [h.name, h.lng, h.lat, h.address],
      );
      inserted++;
    }

    console.log(`[import] Inserted ${inserted} hospitals, skipped ${skipped} duplicates.`);

    const { rows: [{ count }] } = await client.query(
      'SELECT COUNT(*) AS count FROM hospitals',
    );
    console.log(`[import] Total hospitals in database: ${count}`);
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Seed-file fallback (used when Overpass is unreachable)
// ---------------------------------------------------------------------------

/**
 * Apply a bundled SQL seed file directly via pg client.
 * Used as a reliable offline fallback for Mumbai (the default pilot city).
 */
async function applySeedFile(seedFile) {
  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed file not found: ${seedFile}`);
  }
  const sql = fs.readFileSync(seedFile, 'utf8');
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log(`[import] Applying seed file: ${path.basename(seedFile)}`);
    await client.query(sql);
    const { rows: [{ count }] } = await client.query(
      'SELECT COUNT(*) AS count FROM hospitals',
    );
    console.log(`[import] Total hospitals in database: ${count}`);
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[import] City: ${CITY}`);

  // --seed flag: skip Overpass, apply bundled seed directly
  if (ARGS.useSeed) {
    const seedFile = path.join(SEED_DIR, `${CITY.toLowerCase().replace(/\s+/g, '_')}_hospitals.sql`);
    console.log(`[import] --seed flag set — using bundled seed file.`);
    await applySeedFile(seedFile);
    console.log('[import] Done.');
    return;
  }

  let hospitals;

  try {
    // Step 1: Resolve city to bounding box
    const bbox = await getCityBoundingBox(CITY);
    await sleep(RATE_LIMIT_MS); // Nominatim rate-limit courtesy

    // Step 2: Fetch hospitals from Overpass
    const elements = await fetchHospitalsFromOverpass(bbox);
    hospitals = parseElements(elements);
    console.log(`[import] Parsed ${hospitals.length} named hospitals (deduplicated).`);
  } catch (overpassErr) {
    console.warn(`[import] Overpass failed: ${overpassErr.message}`);

    // Try bundled seed file as fallback (only works for cities with a seed file)
    const seedFile = path.join(SEED_DIR, `${CITY.toLowerCase().replace(/\s+/g, '_')}_hospitals.sql`);
    if (fs.existsSync(seedFile)) {
      console.log(`[import] Falling back to bundled seed: ${path.basename(seedFile)}`);
      await applySeedFile(seedFile);
      console.log('[import] Done (via seed fallback).');
      return;
    }

    console.error('[import] No seed file available for this city and Overpass is unreachable.');
    console.error(`[import] To add a seed: create db/seed/${CITY.toLowerCase().replace(/\s+/g, '_')}_hospitals.sql`);
    throw overpassErr;
  }

  if (hospitals.length === 0) {
    console.log('[import] No hospitals found — nothing to import.');
    return;
  }

  // Step 3: Insert into DB
  await insertHospitals(hospitals);
  console.log('[import] Done.');
}

main().catch(err => {
  console.error('[import] Fatal:', err.message);
  process.exit(1);
});
