'use strict';
/**
 * Crisis Care — Poisson Inventory Simulation Worker  (PRD §12)
 *
 * Tick model (birth-death process):
 *   Each tick = TICK_MINUTES simulated minutes (default 10).
 *   For every (hospital × resource) pair, we draw:
 *     - consumption_delta  ~ Poisson(λ_consume)   units consumed this tick
 *     - replenishment_delta ~ Poisson(λ_replenish) units restocked this tick
 *   Net delta = replenishment_delta − consumption_delta
 *   New qty   = clamp(current_qty + net_delta, 0, capacity)
 *
 * Tier-based λ (Poisson rate per tick, per volatility group):
 *
 *   Tier 1 (urban hub)   → high throughput / restocking
 *   Tier 2 (district)    → moderate
 *   Tier 3 (rural)       → low
 *
 *   Volatility group scales λ within each tier:
 *     high   = frequent, larger deltas
 *     medium = moderate
 *     low    = rare, small (specialists / heavy equipment barely move intra-day)
 *
 * Capacities:
 *   Derived from the seeded quantity at worker start — we record the first
 *   observed quantity as the initial value and treat a tier-scaled multiple
 *   as the upper bound (Tier 1 ×3, Tier 2 ×2, Tier 3 ×1.5, min 1).
 *   This is stored in-memory only; the DB column stays as quantity_available.
 *
 * SIM_ENABLED env var (default: 'true'):
 *   Set SIM_ENABLED=false to start the server with the sim paused.
 *   Can also be toggled at runtime via POST /api/dev/sim {enabled:bool}.
 *   When paused: inventory changes only via dispatch/accept/admin edits.
 *   When enabled: normal Poisson ticks, but SKIPS resources with active
 *   (pending/confirmed, non-expired) reservations — preserves reservation
 *   integrity during the 15-minute handshake window.
 *
 * Usage (embedded):
 *   const worker = require('./simulation-worker');
 *   worker.start();
 *   worker.stop();
 *   worker.setEnabled(false);  // pause without stopping the interval
 *
 * Usage (standalone / test):
 *   node simulation-worker.js        # runs live against DB
 */

const db = require('./db');

// ---------------------------------------------------------------------------
// Configuration — tune here; document final values in the paper
// ---------------------------------------------------------------------------

/** Simulated minutes per tick (PRD §12 suggests 10). */
const TICK_MINUTES = parseInt(process.env.SIM_TICK_MINUTES  || '10', 10);

/** Wall-clock milliseconds between ticks when running live. */
const TICK_INTERVAL_MS = parseInt(process.env.SIM_TICK_INTERVAL_MS || String(30_000), 10);

/**
 * Runtime enable/disable flag.
 * Initialised from SIM_ENABLED env var (default true).
 * Toggled at runtime by setEnabled() (called from /api/dev/sim endpoint).
 */
let _simEnabled = (process.env.SIM_ENABLED ?? 'true') !== 'false';

/**
 * Poisson λ table: λ[tier][volatility_group] → { consume, replenish }
 *
 * λ is the *expected* number of units consumed or replenished per tick.
 * Keeping replenish ≈ consume on average means inventory fluctuates but
 * doesn't monotonically drain — defensible as a stationary birth-death
 * process over a 24-hour simulation window.
 *
 * Tier 1 numbers are intentionally ~4× Tier 3 to produce visibly different
 * inventory curves on the sanity-check plot (PRD motivation).
 *
 * NOTE: these are placeholder rates to be tuned with domain knowledge
 * before the final paper run.
 */
const LAMBDA = {
  1: { high: { consume: 3.0, replenish: 2.8 }, medium: { consume: 1.5, replenish: 1.3 }, low: { consume: 0.2, replenish: 0.2 } },
  2: { high: { consume: 1.5, replenish: 1.4 }, medium: { consume: 0.7, replenish: 0.6 }, low: { consume: 0.1, replenish: 0.1 } },
  3: { high: { consume: 0.7, replenish: 0.8 }, medium: { consume: 0.3, replenish: 0.4 }, low: { consume: 0.05, replenish: 0.05 } },
};

/** Capacity multiplier: seeded_qty × multiplier = upper bound. */
const CAPACITY_MULTIPLIER = { 1: 3, 2: 2, 3: 1.5 };

// ---------------------------------------------------------------------------
// Poisson sampler — Knuth algorithm, exact for small λ
// ---------------------------------------------------------------------------

/**
 * Sample one draw from Poisson(lambda).
 * Uses Knuth's algorithm — correct and exact for λ ≤ ~700.
 * @param {number} lambda
 * @returns {number}
 */
function poissonDraw(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// ---------------------------------------------------------------------------
// In-memory capacity cache
// ---------------------------------------------------------------------------

/**
 * Map<resourceRowId, capacity>
 * Populated on first tick from the current DB quantity × multiplier.
 * @type {Map<number, number>}
 */
const capacityCache = new Map();

/**
 * Derive and cache the capacity for a resource row.
 * Called once per row during the first tick.
 * @param {number} id - resources.id PK
 * @param {number} currentQty - current quantity_available
 * @param {number} tier - hospital tier (1/2/3)
 * @returns {number}
 */
function getCapacity(id, currentQty, tier) {
  if (!capacityCache.has(id)) {
    const mult = CAPACITY_MULTIPLIER[tier] ?? 1.5;
    const cap  = Math.max(1, Math.round(currentQty * mult));
    capacityCache.set(id, cap);
  }
  return capacityCache.get(id);
}

// ---------------------------------------------------------------------------
// Core tick
// ---------------------------------------------------------------------------

/**
 * Run one simulation tick.
 * Fetches all resources with their hospital tiers, draws Poisson deltas,
 * applies net change, and writes back to the DB in a single batch UPDATE.
 *
 * Resources with active (pending/confirmed, non-expired) reservations are
 * SKIPPED — the simulation must not alter inventory that is locked during
 * the 90-second handshake window (PRD §10 / PRD §12).
 *
 * @param {{ dryRun?: boolean }} options
 *   dryRun: if true, compute deltas but do NOT write to the DB.
 *           Used by the test / plot script.
 * @returns {Promise<Array<TickResult>>}
 */
async function runTick({ dryRun = false } = {}) {
  // Load all resource rows with hospital tier in one query.
  // LEFT JOIN on active reservations — any resource with reserved_qty > 0
  // is excluded from simulation updates (PRD §12 active-reservation skip rule).
  const { rows } = await db.query(`
    SELECT
      r.id,
      r.hospital_id,
      r.resource_type,
      r.quantity_available  AS qty,
      r.volatility_group    AS vg,
      h.tier,
      COALESCE(rsv.reserved_qty, 0) AS reserved_qty
    FROM resources r
    JOIN hospitals h ON h.id = r.hospital_id
    LEFT JOIN (
      SELECT hospital_id, resource_type, SUM(quantity) AS reserved_qty
      FROM   reservations
      WHERE  status IN ('pending', 'confirmed')
        AND  expires_at > now()
      GROUP BY hospital_id, resource_type
    ) rsv ON rsv.hospital_id   = r.hospital_id
         AND rsv.resource_type = r.resource_type
    ORDER BY r.id
  `);

  const updates = [];
  const results = [];

  for (const row of rows) {
    const tier = row.tier;
    const vg   = row.vg;            // 'high' | 'medium' | 'low'
    const id   = Number(row.id);
    const qty  = Number(row.qty);
    const reservedQty = Number(row.reserved_qty);

    // Skip resources with active reservations — do not perturb locked inventory.
    if (reservedQty > 0) {
      results.push({
        id,
        hospital_id:   Number(row.hospital_id),
        resource_type: row.resource_type,
        tier,
        vg,
        qty_before: qty,
        consume:    0,
        restock:    0,
        delta:      0,
        qty_after:  qty,
        capacity:   getCapacity(id, qty, tier),
        skipped:    true,
        skip_reason: 'active_reservation',
      });
      continue;
    }

    const lambdas = LAMBDA[tier]?.[vg];
    if (!lambdas) continue;         // unknown tier/vg — skip

    const cap     = getCapacity(id, qty, tier);
    const consume = poissonDraw(lambdas.consume);
    const restock = poissonDraw(lambdas.replenish);
    const delta   = restock - consume;
    const newQty  = Math.min(cap, Math.max(0, qty + delta));

    results.push({
      id,
      hospital_id:   Number(row.hospital_id),
      resource_type: row.resource_type,
      tier,
      vg,
      qty_before: qty,
      consume,
      restock,
      delta,
      qty_after: newQty,
      capacity:  cap,
      skipped:   false,
    });

    if (!dryRun && newQty !== qty) {
      updates.push({ id, newQty });
    }
  }

  // Batch write — one UPDATE per changed row (kept simple; for scale use COPY)
  if (!dryRun && updates.length > 0) {
    // Build a single VALUES list: UPDATE … SET quantity_available = v.qty …
    const valuesClause = updates
      .map((u, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
      .join(', ');
    const params = updates.flatMap(u => [u.id, u.newQty]);

    await db.query(`
      UPDATE resources AS r
      SET
        quantity_available = v.qty,
        last_updated_at    = now()
      FROM (VALUES ${valuesClause}) AS v(id, qty)
      WHERE r.id = v.id
    `, params);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Live worker (start / stop / setEnabled)
// ---------------------------------------------------------------------------

let _tickInterval = null;

function start() {
  if (_tickInterval) {
    console.warn('[sim] Worker already running');
    return;
  }
  console.log(
    `[sim] Simulation worker started — tick=${TICK_MINUTES} sim-min,` +
    ` interval=${TICK_INTERVAL_MS}ms wall-clock` +
    ` enabled=${_simEnabled}`,
  );
  _tickInterval = setInterval(async () => {
    if (!_simEnabled) return;   // paused — skip this tick silently
    try {
      const results = await runTick();
      const changed  = results.filter(r => r.qty_after !== r.qty_before && !r.skipped).length;
      const skipped  = results.filter(r => r.skipped).length;
      if (changed || skipped) {
        console.log(
          `[sim] tick — ${changed}/${results.length} resources updated, ${skipped} skipped (active reservations)`,
        );
      }
    } catch (err) {
      console.error('[sim] tick error:', err.message);
    }
  }, TICK_INTERVAL_MS);
}

function stop() {
  if (_tickInterval) {
    clearInterval(_tickInterval);
    _tickInterval = null;
    console.log('[sim] Worker stopped');
  }
}

/**
 * Enable or disable the simulation at runtime without stopping the interval.
 * Called by POST /api/dev/sim { enabled: true|false }.
 *
 * Paused: inventory changes only via dispatch/accept/admin edits.
 * Enabled: normal Poisson ticks (skipping resources with active reservations).
 *
 * @param {boolean} enabled
 */
function setEnabled(enabled) {
  _simEnabled = Boolean(enabled);
  console.log(`[sim] setEnabled=${_simEnabled} (runtime toggle)`);
}

/** Returns current enabled state (for health endpoint / dev UI). */
function isEnabled() {
  return _simEnabled;
}

module.exports = { start, stop, setEnabled, isEnabled, runTick, poissonDraw, LAMBDA, TICK_MINUTES };
