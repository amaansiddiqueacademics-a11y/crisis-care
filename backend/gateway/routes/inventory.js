/**
 * Crisis Care — Inventory router  (FR-3, FR-4)
 *
 * Both routes are protected by the requireAuth middleware (mounted in index.js),
 * so req.admin.hospital_id is always the authenticated admin's hospital.
 *
 * GET  /admin/inventory
 *   Returns all resources rows for the logged-in admin's hospital.
 *   hospital_id comes from the JWT — never from a query/body param.
 *
 * PUT  /admin/inventory/:resourceId
 *   Updates quantity_available and sets last_updated_at = now() for the
 *   specified resource — but ONLY if that resource belongs to the admin's
 *   own hospital. Returns 403 if the resource exists but belongs to a
 *   different hospital (ownership violation).
 *   After a successful update, broadcasts an SSE event to all clients
 *   subscribed to that hospital (FR-4).
 */

'use strict';

const express = require('express');
const db      = require('../db');
const sse     = require('../sse');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /admin/inventory
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  const { hospital_id } = req.admin;

  try {
    const { rows } = await db.query(
      `SELECT
         id,
         hospital_id,
         resource_type,
         quantity_available,
         last_updated_at,
         staleness_threshold_minutes
       FROM resources
       WHERE hospital_id = $1
       ORDER BY resource_type ASC`,
      [hospital_id],
    );
    return res.json({ hospital_id, resources: rows });
  } catch (err) {
    console.error('[inventory] GET error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /admin/inventory/:resourceId
// ---------------------------------------------------------------------------

router.put('/:resourceId', async (req, res) => {
  const { hospital_id } = req.admin;
  const resourceId = parseInt(req.params.resourceId, 10);

  if (isNaN(resourceId)) {
    return res.status(400).json({ error: 'resourceId must be an integer' });
  }

  const { quantity_available } = req.body ?? {};

  if (quantity_available === undefined || quantity_available === null) {
    return res.status(400).json({ error: 'quantity_available is required' });
  }
  if (!Number.isInteger(quantity_available) || quantity_available < 0) {
    return res.status(400).json({ error: 'quantity_available must be a non-negative integer' });
  }

  let updated;
  try {
    const { rows } = await db.query(
      `UPDATE resources
       SET quantity_available = $1,
           last_updated_at   = now()
       WHERE id          = $2
         AND hospital_id = $3        -- ownership guard: only admin's own hospital
       RETURNING
         id,
         hospital_id,
         resource_type,
         quantity_available,
         last_updated_at,
         staleness_threshold_minutes`,
      [quantity_available, resourceId, hospital_id],
    );
    updated = rows[0] ?? null;
  } catch (err) {
    console.error('[inventory] PUT error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Row not found under this hospital — could be wrong id OR wrong hospital.
  // Return 404 in both cases (don't leak whether the resource exists for
  // another hospital).
  if (!updated) {
    // Distinguish 404 vs 403: check if the resource exists at all
    try {
      const { rows } = await db.query(
        'SELECT hospital_id FROM resources WHERE id = $1 LIMIT 1',
        [resourceId],
      );
      if (rows.length > 0 && rows[0].hospital_id !== hospital_id) {
        // Resource exists but belongs to a different hospital
        return res.status(403).json({ error: 'Access denied: resource belongs to a different hospital' });
      }
    } catch (_) { /* swallow — fall through to 404 */ }

    return res.status(404).json({ error: `Resource ${resourceId} not found` });
  }

  // Broadcast SSE event to all clients subscribed to this hospital (FR-4)
  sse.broadcast(hospital_id, 'inventory_update', {
    resource_id:         updated.id,
    resource_type:       updated.resource_type,
    quantity_available:  updated.quantity_available,
    last_updated_at:     updated.last_updated_at,
    hospital_id:         updated.hospital_id,
  });

  console.log(
    `[inventory] updated resource=${resourceId} type=${updated.resource_type} ` +
    `qty=${updated.quantity_available} hospital=${hospital_id}`,
  );

  return res.json({ resource: updated });
});

module.exports = router;
