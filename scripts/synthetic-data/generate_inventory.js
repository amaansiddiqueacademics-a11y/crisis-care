#!/usr/bin/env node
/**
 * Crisis Care — Synthetic Inventory Generator
 *
 * For every hospital already in the DB, inserts a resources row for every
 * resource_type_enum value with:
 *   - Random but plausible quantity_available (varies by resource category)
 *   - last_updated_at randomly within the last 24 hours — so some rows
 *     naturally exercise the staleness logic (staleness_threshold_minutes = 30)
 *
 * Safe to re-run: uses ON CONFLICT (hospital_id, resource_type) DO UPDATE
 * to overwrite existing inventory with fresh random values.
 *
 * Usage:
 *   node scripts/synthetic-data/generate_inventory.js
 *   DATABASE_URL=postgresql://... node scripts/synthetic-data/generate_inventory.js
 *
 * Prerequisites: pg (in root devDependencies)
 */

'use strict';

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

// ---------------------------------------------------------------------------
// Resource type metadata — controls realistic quantity ranges
// ---------------------------------------------------------------------------

const RESOURCE_CONFIG = {
  // Beds: hospitals typically have 0–20 ICU beds available
  icu_bed:                      { minQty: 0, maxQty: 20 },

  // Blood units: 0–50 per type (O+ most common, AB– rarest)
  blood_a_pos:                  { minQty: 0, maxQty: 30 },
  blood_a_neg:                  { minQty: 0, maxQty: 15 },
  blood_b_pos:                  { minQty: 0, maxQty: 30 },
  blood_b_neg:                  { minQty: 0, maxQty: 10 },
  blood_o_pos:                  { minQty: 0, maxQty: 50 },
  blood_o_neg:                  { minQty: 0, maxQty: 20 },
  blood_ab_pos:                 { minQty: 0, maxQty: 15 },
  blood_ab_neg:                 { minQty: 0, maxQty: 8  },

  // Equipment: small counts, often 0 (not every hospital has these)
  oxygen_cylinder:              { minQty: 0, maxQty: 40 },
  ventilator:                   { minQty: 0, maxQty: 15 },

  // Specialists: 0–5 on duty
  specialist_trauma_surgeon:    { minQty: 0, maxQty: 3  },
  specialist_cardiologist:      { minQty: 0, maxQty: 3  },
  specialist_neurologist:       { minQty: 0, maxQty: 2  },
  specialist_pediatric_er:      { minQty: 0, maxQty: 2  },

  // Heavy equipment: 0 or 1–2 units typically
  equipment_dialysis:           { minQty: 0, maxQty: 5  },
  equipment_mri_trauma_ready:   { minQty: 0, maxQty: 2  },
  equipment_ct_scanner:         { minQty: 0, maxQty: 3  },
};

// Probability that a resource has quantity 0 (simulates "out of stock")
const ZERO_PROBABILITY = 0.15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Random integer in [min, max] inclusive */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random timestamp with a realistic staleness distribution:
 *   ~70%  within the last 30 minutes (fresh — pass the threshold)
 *   ~15%  between 30 min and 2 hours (just stale — boundary testing)
 *   ~15%  between 2 hours and 24 hours (clearly stale)
 *
 * With default staleness_threshold_minutes = 30, this means ~70% of rows
 * are "available" and ~30% are stale — a realistic on-duty scenario.
 */
function randomRecentTimestamp() {
  const now = Date.now();
  const roll = Math.random();
  let msAgo;
  if (roll < 0.70) {
    // Fresh: 0–30 min ago
    msAgo = Math.random() * 30 * 60 * 1000;
  } else if (roll < 0.85) {
    // Just stale: 30 min – 2 hours ago
    msAgo = (30 + Math.random() * 90) * 60 * 1000;
  } else {
    // Clearly stale: 2–24 hours ago
    msAgo = (120 + Math.random() * 1320) * 60 * 1000;
  }
  return new Date(now - msAgo);
}

/**
 * Generate a plausible quantity for a resource type.
 * ZERO_PROBABILITY chance of being 0 regardless of range.
 */
function generateQuantity(config) {
  if (Math.random() < ZERO_PROBABILITY) return 0;
  return randInt(config.minQty, config.maxQty);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('[inventory] Connected to database.');

    // Fetch all hospital IDs
    const { rows: hospitals } = await client.query(
      'SELECT id, name FROM hospitals ORDER BY id'
    );

    if (hospitals.length === 0) {
      console.log('[inventory] No hospitals in DB. Run data-import first.');
      return;
    }

    console.log(`[inventory] Generating inventory for ${hospitals.length} hospitals…`);

    const resourceTypes = Object.keys(RESOURCE_CONFIG);
    let totalRows = 0;

    // Batch insert using a transaction for performance
    await client.query('BEGIN');

    for (const hospital of hospitals) {
      for (const resourceType of resourceTypes) {
        const config = RESOURCE_CONFIG[resourceType];
        const qty = generateQuantity(config);
        const lastUpdated = randomRecentTimestamp(24);

        await client.query(
          `INSERT INTO resources (hospital_id, resource_type, quantity_available, last_updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (hospital_id, resource_type) DO UPDATE
             SET quantity_available = EXCLUDED.quantity_available,
                 last_updated_at   = EXCLUDED.last_updated_at`,
          [hospital.id, resourceType, qty, lastUpdated]
        );
        totalRows++;
      }
    }

    await client.query('COMMIT');

    console.log(`[inventory] Upserted ${totalRows} resource rows ` +
      `(${hospitals.length} hospitals × ${resourceTypes.length} types).`);

    // Report staleness stats
    const { rows: staleStats } = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE last_updated_at < now() - (staleness_threshold_minutes || ' minutes')::interval
        ) AS stale,
        COUNT(*) FILTER (
          WHERE quantity_available = 0
        ) AS zero_qty
      FROM resources
    `);

    const stats = staleStats[0];
    console.log(`[inventory] Stats: ${stats.total} total rows, ` +
      `${stats.stale} stale (past threshold), ${stats.zero_qty} zero-quantity.`);
  } finally {
    await client.end();
  }

  console.log('[inventory] Done.');
}

main().catch(err => {
  console.error('[inventory] Fatal:', err.message);
  process.exit(1);
});
