#!/usr/bin/env node
/**
 * Crisis Care V2 — Tier-Aware Inventory Seeder
 *
 * Upserts one `resources` row per (hospital × resource_type) for every
 * hospital in the DB. Extends the V1 generator with:
 *
 *   • volatility_group  — set per PRD §5 (high/medium/low)
 *   • Tier-scaled quantities — Tier 1 highest capacity, Tier 3 lowest
 *   • Per-volatility staleness_threshold_minutes
 *   • Realistic staleness distribution so routing queries exercise the
 *     threshold filter from the first run
 *
 * ─── QUANTITY RANGES (placeholder — tune after field calibration) ──────────
 *
 *  Resource                 Tier 1 range   Tier 2 range   Tier 3 range
 *  ─────────────────────────────────────────────────────────────────────
 *  HIGH VOLATILITY
 *  blood_o_pos              10 – 50        4 – 25         0 – 8
 *  blood_o_neg               5 – 30        2 – 12         0 – 5
 *  blood_a_pos               8 – 40        3 – 20         0 – 7
 *  blood_a_neg               3 – 20        1 –  8         0 – 3
 *  blood_b_pos               8 – 40        3 – 20         0 – 7
 *  blood_b_neg               2 – 15        1 –  6         0 – 2
 *  blood_ab_pos              3 – 18        1 –  8         0 – 3
 *  blood_ab_neg              1 –  8        0 –  4         0 – 1
 *  oxygen_cylinder          15 – 60        8 – 30         2 – 12
 *
 *  MEDIUM VOLATILITY
 *  icu_bed                   3 – 20        1 – 10         0 –  4
 *  ventilator                2 – 15        1 –  6         0 –  2
 *
 *  LOW VOLATILITY
 *  specialist_trauma_surgeon 0 –  4        0 –  2         0 –  1
 *  specialist_cardiologist   0 –  4        0 –  2         0 –  1
 *  specialist_neurologist    0 –  3        0 –  2         0 –  1
 *  specialist_pediatric_er   0 –  3        0 –  1         0 –  1
 *  equipment_dialysis        1 –  6        0 –  3         0 –  1
 *  equipment_mri_trauma_ready 0 – 2        0 –  1         0 –  0
 *  equipment_ct_scanner      1 –  4        0 –  2         0 –  1
 *
 *  Rationale:
 *    - Tier 1 (Urban hub) modelled on large Mumbai/Pune teaching hospitals.
 *    - Tier 2 (District) modelled on Nashik district hospital capacity.
 *    - Tier 3 (Rural) modelled on Nandurbar/Gadchiroli primary health
 *      centres and sub-district hospitals — often single units or zero.
 *    - ~15 % zero-probability added on top of range minimum to simulate
 *      depletion; higher for Tier 3 (25 %).
 *    - Sources: Maharashtra public health reports, NHM facility surveys.
 *      All values are illustrative; replace with real data when available.
 *
 * ─── STALENESS THRESHOLDS ────────────────────────────────────────────────────
 *  high   → 30 min  (blood/O2 changes frequently; admins update every shift)
 *  medium → 60 min  (beds/vents updated once per hour)
 *  low    → 240 min (specialists/equipment rarely change intra-day)
 *
 * Usage:
 *   node scripts/synthetic-data/seed_v2_inventory.js
 *   DATABASE_URL=postgresql://... node scripts/synthetic-data/seed_v2_inventory.js
 */

'use strict';

const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

// ---------------------------------------------------------------------------
// Resource configuration — 18 types, 3 volatility groups  (PRD §5)
//
// Shape per entry:
//   volatility  — 'high' | 'medium' | 'low'
//   staleness   — staleness_threshold_minutes
//   t1          — [min, max] quantity for Tier 1 hospitals
//   t2          — [min, max] quantity for Tier 2 hospitals
//   t3          — [min, max] quantity for Tier 3 hospitals
// ---------------------------------------------------------------------------

const RESOURCE_CONFIG = {
  // ── HIGH VOLATILITY: blood types + oxygen ──────────────────────────────────
  // Blood: frequent transfusion consumption + irregular donations.
  // O+ is the universal donor (kept highest), AB- is rarest.
  blood_o_pos:              { volatility: 'high',   staleness: 30,  t1: [10, 50], t2: [4, 25], t3: [0, 8]  },
  blood_o_neg:              { volatility: 'high',   staleness: 30,  t1: [5,  30], t2: [2, 12], t3: [0, 5]  },
  blood_a_pos:              { volatility: 'high',   staleness: 30,  t1: [8,  40], t2: [3, 20], t3: [0, 7]  },
  blood_a_neg:              { volatility: 'high',   staleness: 30,  t1: [3,  20], t2: [1,  8], t3: [0, 3]  },
  blood_b_pos:              { volatility: 'high',   staleness: 30,  t1: [8,  40], t2: [3, 20], t3: [0, 7]  },
  blood_b_neg:              { volatility: 'high',   staleness: 30,  t1: [2,  15], t2: [1,  6], t3: [0, 2]  },
  blood_ab_pos:             { volatility: 'high',   staleness: 30,  t1: [3,  18], t2: [1,  8], t3: [0, 3]  },
  blood_ab_neg:             { volatility: 'high',   staleness: 30,  t1: [1,   8], t2: [0,  4], t3: [0, 1]  },
  // Oxygen: consumed continuously; rural hospitals have limited resupply.
  oxygen_cylinder:          { volatility: 'high',   staleness: 30,  t1: [15, 60], t2: [8, 30], t3: [2, 12] },

  // ── MEDIUM VOLATILITY: ICU beds + ventilators ──────────────────────────────
  // Updated per bed-management round (hourly); rural PHCs rarely have ICU.
  icu_bed:                  { volatility: 'medium', staleness: 60,  t1: [3,  20], t2: [1, 10], t3: [0,  4] },
  ventilator:               { volatility: 'medium', staleness: 60,  t1: [2,  15], t2: [1,  6], t3: [0,  2] },

  // ── LOW VOLATILITY: specialists + heavy equipment ──────────────────────────
  // On-duty roster changes only at shift boundaries (8–12 h).
  // Equipment is near-permanent; rural sites have 0 MRI.
  specialist_trauma_surgeon:  { volatility: 'low',  staleness: 240, t1: [0,  4],  t2: [0, 2],  t3: [0, 1]  },
  specialist_cardiologist:    { volatility: 'low',  staleness: 240, t1: [0,  4],  t2: [0, 2],  t3: [0, 1]  },
  specialist_neurologist:     { volatility: 'low',  staleness: 240, t1: [0,  3],  t2: [0, 2],  t3: [0, 1]  },
  specialist_pediatric_er:    { volatility: 'low',  staleness: 240, t1: [0,  3],  t2: [0, 1],  t3: [0, 1]  },
  specialist_orthopedic_surgeon: { volatility: 'low', staleness: 240, t1: [0,  3], t2: [0, 1], t3: [0, 1]  },
  specialist_obstetrician:    { volatility: 'low',  staleness: 240, t1: [0,  4],  t2: [0, 2],  t3: [0, 1]  },
  specialist_pediatrician:    { volatility: 'low',  staleness: 240, t1: [0,  5],  t2: [0, 3],  t3: [0, 2]  },
  equipment_dialysis:         { volatility: 'low',  staleness: 240, t1: [1,  6],  t2: [0, 3],  t3: [0, 1]  },
  equipment_mri_trauma_ready: { volatility: 'low',  staleness: 240, t1: [0,  2],  t2: [0, 1],  t3: [0, 0]  },
  equipment_ct_scanner:       { volatility: 'low',  staleness: 240, t1: [1,  4],  t2: [0, 2],  t3: [0, 1]  },
  
  // ── PRD v5 NEW RESOURCES ───────────────────────────────────────────────────
  antivenom:                  { volatility: 'high', staleness: 30,  t1: [2, 10],  t2: [5, 20], t3: [10, 30] }, // Higher in rural (tier 3)
  labor_delivery_bed:         { volatility: 'medium', staleness: 60, t1: [5, 20], t2: [2, 10], t3: [1, 4]   },
  pediatric_icu_bed:          { volatility: 'medium', staleness: 60, t1: [2, 15], t2: [0, 5],  t3: [0, 0]   },
};

// Probability of returning 0 regardless of range (simulate depletion).
// Tier 3 rural hospitals are more often depleted.
const ZERO_PROB = { 1: 0.10, 2: 0.15, 3: 0.25 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQty(config, tier) {
  if (Math.random() < ZERO_PROB[tier]) return 0;
  const [min, max] = config[`t${tier}`];
  if (min === max) return min;                // e.g. mri Tier 3 is always 0
  return randInt(min, max);
}

/**
 * Returns a random timestamp that produces a realistic staleness distribution:
 *
 *   ~65%  fresh:      0 → threshold         (passes staleness filter)
 *   ~20%  borderline: threshold → 2×thresh  (just stale — exercises boundary)
 *   ~15%  stale:      2×thresh → 24 hours   (clearly stale)
 *
 * @param {number} thresholdMinutes  staleness_threshold_minutes for this row
 */
function randomTimestamp(thresholdMinutes) {
  const now  = Date.now();
  const roll = Math.random();
  let msAgo;
  if (roll < 0.65) {
    msAgo = Math.random() * thresholdMinutes * 60_000;
  } else if (roll < 0.85) {
    msAgo = (thresholdMinutes + Math.random() * thresholdMinutes) * 60_000;
  } else {
    msAgo = (thresholdMinutes * 2 + Math.random() * (24 * 60 - thresholdMinutes * 2)) * 60_000;
  }
  return new Date(now - msAgo);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Crisis Care V2 — Tier-Aware Inventory Seeder           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('[db] Connected.\n');

  // Fetch all hospitals with their tier
  const { rows: hospitals } = await client.query(
    'SELECT id, name, tier FROM hospitals ORDER BY tier, id'
  );

  if (hospitals.length === 0) {
    console.error('[error] No hospitals found. Run seed_curated_hospitals.js first.');
    process.exit(1);
  }

  const tierCounts = hospitals.reduce((acc, h) => {
    acc[h.tier] = (acc[h.tier] || 0) + 1; return acc;
  }, {});
  console.log(`[db] Hospitals: ${hospitals.length} total`);
  Object.entries(tierCounts).forEach(([tier, count]) =>
    console.log(`     Tier ${tier}: ${count}`)
  );

  const resourceTypes = Object.keys(RESOURCE_CONFIG);
  const totalRows = hospitals.length * resourceTypes.length;
  console.log(`\n[seed] Upserting ${totalRows} rows (${hospitals.length} hospitals × ${resourceTypes.length} types)…\n`);

  // Batch everything in a single transaction for speed
  await client.query('BEGIN');

  let upserted = 0;
  for (const hospital of hospitals) {
    for (const resourceType of resourceTypes) {
      const cfg = RESOURCE_CONFIG[resourceType];
      const qty = generateQty(cfg, hospital.tier);
      const ts  = randomTimestamp(cfg.staleness);

      await client.query(
        `INSERT INTO resources
           (hospital_id, resource_type, quantity_available,
            last_updated_at, staleness_threshold_minutes, volatility_group)
         VALUES ($1, $2, $3, $4, $5, $6::volatility_group)
         ON CONFLICT (hospital_id, resource_type) DO UPDATE
           SET quantity_available          = EXCLUDED.quantity_available,
               last_updated_at            = EXCLUDED.last_updated_at,
               staleness_threshold_minutes = EXCLUDED.staleness_threshold_minutes,
               volatility_group           = EXCLUDED.volatility_group`,
        [hospital.id, resourceType, qty, ts, cfg.staleness, cfg.volatility]
      );
      upserted++;
    }
  }

  await client.query('COMMIT');
  console.log(`[seed] ✓ Upserted ${upserted} rows.\n`);

  // ── Staleness stats ─────────────────────────────────────────────────────────
  const { rows: [stats] } = await client.query(`
    SELECT
      COUNT(*)                                                     AS total,
      COUNT(*) FILTER (
        WHERE last_updated_at > now()
                - (staleness_threshold_minutes || ' minutes')::interval
      )                                                            AS fresh,
      COUNT(*) FILTER (
        WHERE last_updated_at <= now()
                - (staleness_threshold_minutes || ' minutes')::interval
      )                                                            AS stale,
      COUNT(*) FILTER (WHERE quantity_available = 0)               AS zero_qty
    FROM resources
  `);
  console.log('── Staleness summary ─────────────────────────────────────────');
  console.log(`   Total rows : ${stats.total}`);
  console.log(`   Fresh      : ${stats.fresh}  (${pct(stats.fresh, stats.total)}%)`);
  console.log(`   Stale      : ${stats.stale}  (${pct(stats.stale, stats.total)}%)`);
  console.log(`   Zero qty   : ${stats.zero_qty}  (${pct(stats.zero_qty, stats.total)}%)`);
  console.log('──────────────────────────────────────────────────────────────\n');

  // ── Sample: 3 hospitals (one from each tier) ────────────────────────────────
  const { rows: sampleHospitals } = await client.query(`
    SELECT DISTINCT ON (tier) id, name, tier
    FROM hospitals
    ORDER BY tier, id
    LIMIT 3
  `);

  console.log('── Sample inventory (1 hospital per tier) ────────────────────\n');

  for (const h of sampleHospitals) {
    console.log(`  [Tier ${h.tier}] ${h.name}`);
    console.log('  ' + '─'.repeat(70));
    console.log(
      '  ' +
      'resource_type'.padEnd(30) +
      'volatility'.padEnd(10) +
      'qty'.padEnd(6) +
      'stale_thresh'.padEnd(14) +
      'fresh?'
    );
    console.log('  ' + '─'.repeat(70));

    const { rows: inv } = await client.query(`
      SELECT
        resource_type,
        volatility_group,
        quantity_available,
        staleness_threshold_minutes,
        CASE
          WHEN last_updated_at > now()
               - (staleness_threshold_minutes || ' minutes')::interval
          THEN 'yes' ELSE 'NO'
        END AS is_fresh
      FROM resources
      WHERE hospital_id = $1
      ORDER BY volatility_group DESC, resource_type
    `, [h.id]);

    for (const r of inv) {
      console.log(
        '  ' +
        r.resource_type.padEnd(30) +
        r.volatility_group.padEnd(10) +
        String(r.quantity_available).padEnd(6) +
        `${r.staleness_threshold_minutes} min`.padEnd(14) +
        r.is_fresh
      );
    }
    console.log();
  }

  console.log('[done] Inventory seeded. Next: node scripts/dev.js\n');
  await client.end();
}

function pct(n, total) {
  return total > 0 ? ((Number(n) / Number(total)) * 100).toFixed(1) : '0.0';
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
