/**
 * Crisis Care — Dev-only endpoints  (NOT for production)
 *
 * Mounted only when NODE_ENV !== 'production' (see index.js).
 *
 * POST /api/dev/sim { enabled: true|false }
 *   Toggle the Poisson simulation worker at runtime.
 *   Paused  → inventory changes only via dispatch/accept/admin edits.
 *   Enabled → normal ticks, skipping resources with active reservations.
 *
 * POST /api/dev/reset-demo
 *   1. Release all active (pending/confirmed, non-expired) reservations.
 *   2. Clear all incidents in 'routing' state (set to 'cancelled').
 *   3. Restore seeded inventory using rng_seed 42 from
 *      /files/inventory_profiles.json (same seed used during initial setup).
 *
 * These endpoints have no auth because they're dev-only.
 * They should be behind a VPN / firewall in staging at minimum.
 */

'use strict';

const path   = require('path');
const fs     = require('fs');
const { Router } = require('express');
const db         = require('../db');
const simWorker  = require('../simulation-worker');

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/dev/sim
// ---------------------------------------------------------------------------

router.post('/sim', (req, res) => {
  const { enabled } = req.body ?? {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'body must be { enabled: true|false }' });
  }
  simWorker.setEnabled(enabled);
  console.log(`[dev] sim toggled → enabled=${enabled}`);
  return res.json({ sim_enabled: simWorker.isEnabled() });
});

// ---------------------------------------------------------------------------
// POST /api/dev/reset-demo
//
// Restores the DB to the same state as immediately after seeding:
//   1. Release all active reservations (pending/confirmed, not yet expired).
//   2. Cancel all incidents that are still in 'routing' state.
//   3. Restore quantity_available from the seeded profile (rng_seed 42).
//
// Seeded quantities are re-derived using the same deterministic RNG that the
// original seed script used.  We store the per-(hospital,resource_type) values
// in a flat map and apply them in one batch UPDATE.
// ---------------------------------------------------------------------------

/**
 * Seeded RNG — Linear Congruential Generator with seed=42.
 * Must match the seed logic used by the original inventory seeding script.
 * Returns integers in [min, max] (inclusive).
 */
function makeLcg(seed) {
  let s = seed;
  return function randInt(min, max) {
    // Park-Miller LCG: Xn+1 = (a * Xn + c) mod m
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s >>> 0) % (max - min + 1);
  };
}

/**
 * Load the inventory_profiles.json seed file and return the per-tier resource
 * quantity ranges.  We use the file at /files/inventory_profiles.json
 * (two directories above backend/gateway).
 */
function loadInventoryProfiles() {
  const filePath = path.join(__dirname, '..', '..', '..', 'files', 'inventory_profiles.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`inventory_profiles.json not found at ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Resource type enum value → inventory_profiles key mapping.
 * Must stay in sync with the resource_type_enum in the DB.
 */
const RESOURCE_PROFILE_KEY = {
  icu_bed:                    'icu_bed',
  ventilator:                 'ventilator',
  oxygen_cylinder:            'oxygen_cylinder',
  specialist_trauma_surgeon:  'trauma_surgeon',
  specialist_cardiologist:    'cardiologist',
  specialist_neurologist:     'neurologist',
  specialist_pediatric_er:    'cardiologist',    // fallback — same profile
  equipment_ct_scanner:       'ct_scanner',
  equipment_mri_trauma_ready: 'ct_scanner',      // fallback
  equipment_dialysis:         'ct_scanner',      // fallback
  blood_a_pos:   'blood_units_each_type',
  blood_a_neg:   'blood_units_each_type',
  blood_b_pos:   'blood_units_each_type',
  blood_b_neg:   'blood_units_each_type',
  blood_o_pos:   'blood_units_each_type',
  blood_o_neg:   'blood_O_neg',
  blood_ab_pos:  'blood_units_each_type',
  blood_ab_neg:  'blood_AB_neg',
};

/**
 * Map DB hospital tier → profile key in inventory_profiles.json.
 * (Tier 1 = 'tier_A_urban', Tier 2 = 'tier_B_urban', Tier 3 = 'tier_B_rural')
 */
function tierToProfileKey(tier) {
  if (tier === 1) return 'tier_A_urban';
  if (tier === 2) return 'tier_B_urban';
  return 'tier_B_rural';
}

/**
 * Compute seeded quantity for one (tier, resourceType) pair.
 * Uses the same LCG as the original seeding script (seed=42).
 * @param {object} profiles - inventory_profiles.json .profiles
 * @param {string} profileKey - 'tier_A_urban' | 'tier_B_urban' | 'tier_B_rural'
 * @param {string} resourceType - DB resource_type_enum value
 * @param {function} rand - LCG function
 * @returns {number}
 */
function seededQty(profiles, profileKey, resourceType, rand) {
  const profile = profiles[profileKey];
  if (!profile) return 0;

  const pKey = RESOURCE_PROFILE_KEY[resourceType];
  if (!pKey) return 0;

  const spec = profile[pKey];
  if (!spec) return 0;

  // Array spec: [min, max] → uniform random in range
  if (Array.isArray(spec)) {
    return rand(spec[0], spec[1]);
  }

  // Object spec: { p: presence_prob, qty: [min, max] }
  if (typeof spec === 'object' && 'p' in spec) {
    // Use rand to sample presence probability
    const roll = rand(0, 9999) / 10000.0;
    if (roll >= spec.p) return 0;
    return rand(spec.qty[0], spec.qty[1]);
  }

  return 0;
}

router.post('/reset-demo', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // ── Step 1: Release all active reservations ────────────────────────────
    const { rowCount: releasedCount } = await client.query(
      `UPDATE reservations
       SET status = 'released'
       WHERE status IN ('pending', 'confirmed')
         AND expires_at > now()`,
    );
    console.log(`[dev/reset] released ${releasedCount} active reservations`);

    // ── Step 2: Cancel all routing-state incidents ─────────────────────────
    const { rowCount: cancelledCount } = await client.query(
      `UPDATE incidents
       SET status = 'cancelled'
       WHERE status = 'routing'`,
    );
    console.log(`[dev/reset] cancelled ${cancelledCount} routing incidents`);

    // ── Step 3: Restore seeded inventory ──────────────────────────────────
    // Load profile ranges.
    let profiles;
    try {
      const seed_data = loadInventoryProfiles();
      profiles = seed_data.profiles;
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: `Cannot load seed file: ${err.message}` });
    }

    // Fetch all resources with their hospital tier.
    const { rows: resourceRows } = await client.query(
      `SELECT r.id, r.hospital_id, r.resource_type, h.tier
       FROM resources r
       JOIN hospitals h ON h.id = r.hospital_id
       ORDER BY r.id`,
    );

    if (resourceRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'No resources found in database' });
    }

    // Re-derive seeded quantities using rng_seed=42.
    // One LCG shared across all rows, iterated in resource row id order —
    // matches the original seed pass order.
    const rand = makeLcg(42);
    const updates = [];
    for (const row of resourceRows) {
      const profileKey = tierToProfileKey(row.tier);
      const qty = seededQty(profiles, profileKey, row.resource_type, rand);
      updates.push({ id: row.id, qty });
    }

    // Batch UPDATE all resources.
    if (updates.length > 0) {
      const valuesClause = updates
        .map((u, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
        .join(', ');
      const params = updates.flatMap(u => [u.id, u.qty]);
      await client.query(
        `UPDATE resources AS r
         SET quantity_available = v.qty,
             last_updated_at   = now()
         FROM (VALUES ${valuesClause}) AS v(id, qty)
         WHERE r.id = v.id`,
        params,
      );
    }
    console.log(`[dev/reset] restored ${updates.length} resource quantities (rng_seed=42)`);

    await client.query('COMMIT');

    return res.json({
      message: 'Demo reset complete',
      released_reservations: releasedCount,
      cancelled_incidents:   cancelledCount,
      restored_resources:    updates.length,
      rng_seed: 42,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[dev/reset] error:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
