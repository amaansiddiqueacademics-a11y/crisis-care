#!/usr/bin/env node
/**
 * Crisis Care — Simulation Sanity-Check: 24-hour Inventory Curves  (PRD §12)
 *
 * Runs the Poisson simulation in-process (dry-run: no DB writes) for 144 ticks
 * = 144 × 10 simulated minutes = 24 simulated hours.
 *
 * Prints an ASCII sparkline chart for:
 *   • One Tier 1 hospital — resource: oxygen_cylinder  (high volatility)
 *   • One Tier 3 hospital — resource: oxygen_cylinder  (high volatility)
 *
 * Then prints summary tables for ALL volatility groups so the difference in
 * Tier 1 vs Tier 3 dynamics is immediately visible.
 *
 * Usage:
 *   node scripts/test_simulation.js
 *
 * No gateway needs to be running.  The script talks to the DB directly.
 */

'use strict';

const { Pool } = require('pg');
const { poissonDraw, LAMBDA, TICK_MINUTES } = require('../backend/gateway/simulation-worker');

const DB_URL = process.env.DATABASE_URL ||
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

const pool = new Pool({ connectionString: DB_URL });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TICKS_PER_HOUR = 60 / TICK_MINUTES;          // 6 ticks/hr at 10-min ticks
const TICKS_TOTAL    = 24 * TICKS_PER_HOUR;         // 144 ticks = 24 sim-hours
const CHART_WIDTH    = 72;                           // ASCII chart columns

// Resources to highlight individually
const SPOTLIGHT_RESOURCES = ['oxygen_cylinder', 'icu_bed', 'ventilator'];

// ---------------------------------------------------------------------------
// Capacity cache (same logic as simulation-worker.js)
// ---------------------------------------------------------------------------

const CAPACITY_MULTIPLIER = { 1: 3, 2: 2, 3: 1.5 };
const capacityCache = new Map();

function getCapacity(id, qty, tier) {
  if (!capacityCache.has(id)) {
    const mult = CAPACITY_MULTIPLIER[tier] ?? 1.5;
    capacityCache.set(id, Math.max(1, Math.round(qty * mult)));
  }
  return capacityCache.get(id);
}

// ---------------------------------------------------------------------------
// Simulation (dry-run — no DB writes)
// ---------------------------------------------------------------------------

/**
 * Run TICKS_TOTAL ticks over all resources for the given hospitals.
 * Returns a time-series per resource row.
 *
 * @param {Array<object>} rows - resource rows from DB (with tier)
 * @returns {Map<number, number[]>}  resourceId → quantity at each tick
 */
function simulate(rows) {
  // Initialise state
  const qty   = new Map(rows.map(r => [Number(r.id), Number(r.qty)]));
  const caps  = new Map(rows.map(r => {
    const id = Number(r.id);
    return [id, getCapacity(id, Number(r.qty), r.tier)];
  }));

  // History: id → [qty at tick 0, tick 1, … tick TICKS_TOTAL]
  const history = new Map(rows.map(r => [Number(r.id), [Number(r.qty)]]));

  for (let t = 0; t < TICKS_TOTAL; t++) {
    for (const row of rows) {
      const id      = Number(row.id);
      const tier    = row.tier;
      const vg      = row.vg;
      const lambdas = LAMBDA[tier]?.[vg];
      if (!lambdas) continue;

      const current = qty.get(id);
      const cap     = caps.get(id);
      const consume = poissonDraw(lambdas.consume);
      const restock = poissonDraw(lambdas.replenish);
      const next    = Math.min(cap, Math.max(0, current + restock - consume));

      qty.set(id, next);
      history.get(id).push(next);
    }
  }

  return history;
}

// ---------------------------------------------------------------------------
// ASCII sparkline chart
// ---------------------------------------------------------------------------

const BLOCK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Render a time-series as an ASCII sparkline (one line of unicode blocks).
 * @param {number[]} series
 * @param {number}   capacity
 * @param {number}   width    — max characters wide
 * @returns {string}
 */
function sparkline(series, capacity, width = CHART_WIDTH) {
  // Downsample if needed
  const step   = Math.max(1, Math.ceil(series.length / width));
  const points = [];
  for (let i = 0; i < series.length; i += step) {
    const slice = series.slice(i, i + step);
    points.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }

  const mn  = 0;
  const mx  = Math.max(capacity, 1);
  const rng = mx - mn || 1;

  return points
    .map(v => {
      const idx = Math.round(((v - mn) / rng) * (BLOCK.length - 1));
      return BLOCK[Math.max(0, Math.min(BLOCK.length - 1, idx))];
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Table printer
// ---------------------------------------------------------------------------

function printSummaryTable(label, rows, history) {
  console.log(`\n${'─'.repeat(78)}`);
  console.log(` ${label}`);
  console.log('─'.repeat(78));
  console.log(
    ' Resource'.padEnd(32) +
    'Volatility'.padEnd(10) +
    'Start'.padStart(6) +
    '  Min'.padStart(6) +
    '  Avg'.padStart(6) +
    '  Max'.padStart(6) +
    '  End'.padStart(6) +
    '  Cap'.padStart(6),
  );
  console.log('─'.repeat(78));

  for (const row of rows) {
    const id  = Number(row.id);
    const cap = getCapacity(id, Number(row.qty), row.tier);
    const h   = history.get(id);
    if (!h) continue;
    const mn  = Math.min(...h);
    const mx  = Math.max(...h);
    const avg = (h.reduce((a, b) => a + b, 0) / h.length).toFixed(1);

    console.log(
      ` ${row.resource_type.padEnd(31)}` +
      `${row.vg.padEnd(10)}` +
      `${String(h[0]).padStart(6)}` +
      `${String(mn).padStart(6)}` +
      `${String(avg).padStart(6)}` +
      `${String(mx).padStart(6)}` +
      `${String(h[h.length - 1]).padStart(6)}` +
      `${String(cap).padStart(6)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load Tier 1 and Tier 3 hospitals (first of each by id)
  const { rows: hospitals } = await pool.query(`
    SELECT DISTINCT ON (tier) id, name, tier
    FROM   hospitals
    WHERE  tier IN (1, 3)
    ORDER  BY tier, id
  `);

  const tier1 = hospitals.find(h => h.tier === 1);
  const tier3 = hospitals.find(h => h.tier === 3);

  if (!tier1 || !tier3) {
    console.error('Could not find both a Tier 1 and Tier 3 hospital in the DB.');
    process.exit(1);
  }

  // Load their resources
  const { rows } = await pool.query(`
    SELECT r.id, r.hospital_id, r.resource_type,
           r.quantity_available AS qty,
           r.volatility_group   AS vg,
           h.tier
    FROM   resources r
    JOIN   hospitals h ON h.id = r.hospital_id
    WHERE  h.id IN ($1, $2)
    ORDER  BY h.tier, r.volatility_group, r.resource_type
  `, [tier1.id, tier3.id]);

  const t1rows = rows.filter(r => Number(r.hospital_id) === Number(tier1.id));
  const t3rows = rows.filter(r => Number(r.hospital_id) === Number(tier3.id));

  console.log('\n' + '═'.repeat(78));
  console.log(' Crisis Care — 24-Hour Inventory Simulation Sanity Check  (PRD §12)');
  console.log('═'.repeat(78));
  console.log(`\n  Tick size : ${TICK_MINUTES} sim-minutes`);
  console.log(`  Ticks     : ${TICKS_TOTAL}  (${TICKS_TOTAL * TICK_MINUTES / 60} sim-hours)`);
  console.log(`\n  Tier 1    : [id=${tier1.id}] ${tier1.name.substring(0, 60)}`);
  console.log(`  Tier 3    : [id=${tier3.id}] ${tier3.name.substring(0, 60)}`);

  // ── Run simulation ────────────────────────────────────────────────────────
  console.log('\n  Running simulation…');
  const histT1 = simulate(t1rows);
  const histT3 = simulate(t3rows);

  // ── Sparkline section ──────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(78));
  console.log(' Sparkline Charts  (▁=low … █=high relative to capacity)');
  console.log(' X-axis: 24 simulated hours  |  each block ≈ 20 simulated minutes');
  console.log('═'.repeat(78));

  for (const resType of SPOTLIGHT_RESOURCES) {
    const r1 = t1rows.find(r => r.resource_type === resType);
    const r3 = t3rows.find(r => r.resource_type === resType);

    if (!r1 || !r3) continue;

    const h1  = histT1.get(Number(r1.id));
    const h3  = histT3.get(Number(r3.id));
    const cap1 = getCapacity(Number(r1.id), Number(r1.qty), r1.tier);
    const cap3 = getCapacity(Number(r3.id), Number(r3.qty), r3.tier);

    console.log(`\n  ── ${resType.toUpperCase().replace(/_/g, ' ')} ──`);
    console.log(`  Tier 1 [cap=${cap1}]  ${sparkline(h1, cap1)}`);
    console.log(`  Tier 3 [cap=${cap3}]  ${sparkline(h3, cap3)}`);

    // Mini stats
    const avg1 = (h1.reduce((a, b) => a + b, 0) / h1.length).toFixed(1);
    const avg3 = (h3.reduce((a, b) => a + b, 0) / h3.length).toFixed(1);
    const std  = (arr) => {
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length).toFixed(1);
    };
    console.log(
      `  Tier 1: start=${h1[0]} avg=${avg1} σ=${std(h1)} min=${Math.min(...h1)} max=${Math.max(...h1)}`,
    );
    console.log(
      `  Tier 3: start=${h3[0]} avg=${avg3} σ=${std(h3)} min=${Math.min(...h3)} max=${Math.max(...h3)}`,
    );
  }

  // ── Full summary tables ───────────────────────────────────────────────────
  printSummaryTable(
    `Tier 1 — ${tier1.name.substring(0, 55)} (id=${tier1.id})`,
    t1rows, histT1,
  );
  printSummaryTable(
    `Tier 3 — ${tier3.name.substring(0, 55)} (id=${tier3.id})`,
    t3rows, histT3,
  );

  // ── Lambda reference table ────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(78));
  console.log(' λ Table used in this run  (consume / replenish per tick)');
  console.log('─'.repeat(78));
  console.log(' Tier  Volatility   λ_consume   λ_replenish');
  for (const [tier, vgs] of Object.entries(LAMBDA)) {
    for (const [vg, l] of Object.entries(vgs)) {
      console.log(
        `   ${tier}    ${vg.padEnd(10)}   ${String(l.consume).padStart(8)}    ${l.replenish}`,
      );
    }
  }

  console.log('\n' + '═'.repeat(78));
  console.log(' ✓ Simulation complete — No DB writes (dry-run mode)');
  console.log(' Expected pattern:');
  console.log('   Tier 1: wide fluctuations, high absolute numbers, frequent swings');
  console.log('   Tier 3: narrow fluctuations, low absolute numbers, flatter curve');
  console.log('═'.repeat(78) + '\n');

  await pool.end();
}

main().catch(async err => {
  console.error('FATAL:', err.stack || err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
