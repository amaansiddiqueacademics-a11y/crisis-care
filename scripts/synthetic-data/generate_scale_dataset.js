#!/usr/bin/env node
/**
 * Crisis Care — Synthetic Scale Dataset Generator
 *
 * Generates synthetic hospital rows with valid geography points across a
 * bounding box, plus matching resources rows for each, to produce datasets
 * at 1K / 10K / 100K scale for the performance benchmark (PRD §12.B).
 *
 * Synthetic hospitals are tagged with is_synthetic metadata via a name prefix
 * so they can be easily truncated without polluting the real pilot-city data.
 *
 * Usage:
 *   node scripts/synthetic-data/generate_scale_dataset.js --count 1000
 *   node scripts/synthetic-data/generate_scale_dataset.js --count 10000
 *   node scripts/synthetic-data/generate_scale_dataset.js --count 100000
 *   node scripts/synthetic-data/generate_scale_dataset.js --truncate   # removes all synthetic rows
 *
 * Options:
 *   --count N       Number of synthetic hospitals to generate (required unless --truncate)
 *   --truncate      Remove all synthetic hospitals and their resources (CASCADE)
 *   --bbox S,W,N,E  Custom bounding box (default: Mumbai metro area)
 *   --batch N       Insert batch size (default: 500)
 *
 * Prerequisites: pg (in root devDependencies)
 */

'use strict';

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

// Synthetic hospital names are prefixed so they can be identified and truncated
const SYNTHETIC_PREFIX = '[SYNTH] ';

// Default bounding box: Mumbai metro area
// [south, west, north, east]
const DEFAULT_BBOX = [18.85, 72.75, 19.35, 73.05];

// All 18 resource types from the enum
const RESOURCE_TYPES = [
  'icu_bed',
  'blood_a_pos', 'blood_a_neg', 'blood_b_pos', 'blood_b_neg',
  'blood_o_pos', 'blood_o_neg', 'blood_ab_pos', 'blood_ab_neg',
  'oxygen_cylinder', 'ventilator',
  'specialist_trauma_surgeon', 'specialist_cardiologist',
  'specialist_neurologist', 'specialist_pediatric_er',
  'equipment_dialysis', 'equipment_mri_trauma_ready', 'equipment_ct_scanner',
];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { count: null, truncate: false, bbox: DEFAULT_BBOX, batchSize: 500 };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--count':
        opts.count = parseInt(args[++i], 10);
        if (isNaN(opts.count) || opts.count <= 0) {
          console.error('--count must be a positive integer');
          process.exit(1);
        }
        break;
      case '--truncate':
        opts.truncate = true;
        break;
      case '--bbox': {
        const parts = args[++i].split(',').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) {
          console.error('--bbox must be S,W,N,E (4 comma-separated numbers)');
          process.exit(1);
        }
        opts.bbox = parts;
        break;
      }
      case '--batch':
        opts.batchSize = parseInt(args[++i], 10) || 500;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!opts.truncate && opts.count == null) {
    console.error('Usage: generate_scale_dataset.js --count N [--bbox S,W,N,E] [--batch N]');
    console.error('       generate_scale_dataset.js --truncate');
    process.exit(1);
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Random float in [min, max) */
function randFloat(min, max) {
  return min + Math.random() * (max - min);
}

/** Random integer in [min, max] inclusive */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random timestamp within the last N hours */
function randomRecentTimestamp(hours = 24) {
  return new Date(Date.now() - Math.random() * hours * 60 * 60 * 1000);
}

/** Generate a synthetic hospital name */
function syntheticName(index) {
  return `${SYNTHETIC_PREFIX}Hospital ${index}`;
}

/** Generate a random phone number */
function syntheticPhone() {
  return `+91-${randInt(7000, 9999)}-${String(randInt(0, 999999)).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

async function generateHospitals(client, count, bbox, batchSize) {
  const [south, west, north, east] = bbox;

  console.log(`[scale] Generating ${count.toLocaleString()} synthetic hospitals…`);
  console.log(`[scale] Bounding box: S=${south} W=${west} N=${north} E=${east}`);
  console.log(`[scale] Batch size: ${batchSize}`);

  let totalHospitals = 0;
  let totalResources = 0;

  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, count);
    const batchCount = batchEnd - batchStart;

    await client.query('BEGIN');

    // Build a single multi-row INSERT for hospitals
    const hospitalValues = [];
    const hospitalParams = [];
    let paramIdx = 1;

    for (let i = 0; i < batchCount; i++) {
      const globalIdx = batchStart + i + 1;
      const lat = randFloat(south, north);
      const lng = randFloat(west, east);
      const name = syntheticName(globalIdx);
      const phone = syntheticPhone();

      hospitalValues.push(
        `($${paramIdx}, ST_SetSRID(ST_MakePoint($${paramIdx + 1}, $${paramIdx + 2}), 4326)::geography, $${paramIdx + 3})`
      );
      hospitalParams.push(name, lng, lat, phone);
      paramIdx += 4;
    }

    const insertHospitalsSQL = `
      INSERT INTO hospitals (name, geom, phone)
      VALUES ${hospitalValues.join(',\n             ')}
      RETURNING id
    `;

    const { rows: newHospitals } = await client.query(insertHospitalsSQL, hospitalParams);
    totalHospitals += newHospitals.length;

    // Now insert resources for each new hospital
    // Build a large multi-row INSERT for resources
    const resourceValues = [];
    const resourceParams = [];
    let rParamIdx = 1;

    for (const { id } of newHospitals) {
      for (const rt of RESOURCE_TYPES) {
        const qty = Math.random() < 0.15 ? 0 : randInt(0, 20);
        const lastUpdated = randomRecentTimestamp(24);

        resourceValues.push(
          `($${rParamIdx}, $${rParamIdx + 1}, $${rParamIdx + 2}, $${rParamIdx + 3})`
        );
        resourceParams.push(id, rt, qty, lastUpdated);
        rParamIdx += 4;
      }
    }

    // Split resource inserts if they exceed Postgres parameter limit (65535)
    const maxParamsPerInsert = 65000;
    const paramsPerRow = 4;
    const maxRowsPerInsert = Math.floor(maxParamsPerInsert / paramsPerRow);

    for (let rStart = 0; rStart < resourceValues.length; rStart += maxRowsPerInsert) {
      const rEnd = Math.min(rStart + maxRowsPerInsert, resourceValues.length);
      const sliceValues = resourceValues.slice(rStart, rEnd);
      const sliceParams = resourceParams.slice(rStart * paramsPerRow, rEnd * paramsPerRow);

      // Re-number parameters for this slice
      const renumberedValues = [];
      let sliceParamIdx = 1;
      for (let j = 0; j < sliceValues.length; j++) {
        renumberedValues.push(
          `($${sliceParamIdx}, $${sliceParamIdx + 1}, $${sliceParamIdx + 2}, $${sliceParamIdx + 3})`
        );
        sliceParamIdx += 4;
      }

      const insertResourcesSQL = `
        INSERT INTO resources (hospital_id, resource_type, quantity_available, last_updated_at)
        VALUES ${renumberedValues.join(',\n               ')}
      `;

      await client.query(insertResourcesSQL, sliceParams);
      totalResources += sliceValues.length;
    }

    await client.query('COMMIT');

    if ((batchEnd % (batchSize * 10) === 0) || batchEnd === count) {
      const pct = ((batchEnd / count) * 100).toFixed(0);
      console.log(`[scale] Progress: ${batchEnd.toLocaleString()} / ${count.toLocaleString()} hospitals (${pct}%)`);
    }
  }

  console.log(`[scale] Inserted ${totalHospitals.toLocaleString()} hospitals ` +
    `and ${totalResources.toLocaleString()} resource rows.`);
}

async function truncateSynthetic(client) {
  console.log(`[scale] Removing all synthetic hospitals (prefix: "${SYNTHETIC_PREFIX}")…`);

  // resources rows are deleted automatically via ON DELETE CASCADE
  const { rowCount } = await client.query(
    `DELETE FROM hospitals WHERE name LIKE $1`,
    [`${SYNTHETIC_PREFIX}%`]
  );

  console.log(`[scale] Deleted ${rowCount} synthetic hospitals (resources removed via CASCADE).`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('[scale] Connected to database.');

    if (opts.truncate) {
      await truncateSynthetic(client);
    } else {
      const start = Date.now();
      await generateHospitals(client, opts.count, opts.bbox, opts.batchSize);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[scale] Completed in ${elapsed}s.`);
    }

    // Show totals
    const { rows: [totals] } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM hospitals) AS total_hospitals,
        (SELECT COUNT(*) FROM hospitals WHERE name LIKE $1) AS synthetic_hospitals,
        (SELECT COUNT(*) FROM resources) AS total_resources
    `, [`${SYNTHETIC_PREFIX}%`]);

    console.log(`[scale] DB totals: ${totals.total_hospitals} hospitals ` +
      `(${totals.synthetic_hospitals} synthetic), ` +
      `${totals.total_resources} resource rows.`);
  } finally {
    await client.end();
  }

  console.log('[scale] Done.');
}

main().catch(err => {
  console.error('[scale] Fatal:', err.message);
  process.exit(1);
});
