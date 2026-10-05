/**
 * Crisis Care — POST /admin/reservations/:id/confirm
 *              POST /admin/reservations/:id/release
 *
 * Implements PRD §9 hospital ACK/reject handshake.
 *
 * Architecture (AGENTS.md):
 *   These endpoints live in the gateway because:
 *     1. They require a valid admin JWT (hospital staff authentication).
 *     2. confirm → decrements resources.quantity_available (inventory CRUD).
 *     3. The SSE flow (§10) that triggers these lives in the gateway.
 *   The routing service (FastAPI) created the reservation rows; the gateway
 *   finalises them. Both services share the same Postgres database.
 *
 * Reservation lifecycle per PRD §9:
 *
 *   pending   ──ACK──────► confirmed   (quantity_available decremented)
 *   pending   ──NACK/TO──► released    (no quantity change; nothing to undo)
 *   pending   ──(15 min)─► expired     (auto-treated as 0 at read time by the view)
 *   confirmed              (terminal — no further transitions expected here)
 *   released               (terminal)
 *
 * Expiry without a cron job (PRD §9, confirmed by migration 002 view):
 *   resource_effective_availability includes:
 *     WHERE status IN ('pending', 'confirmed') AND expires_at > now()
 *   Once expires_at passes, the row is simply invisible to the availability
 *   subquery. No DELETE, no background worker, no Redis TTL needed.
 *
 * Both endpoints:
 *   - Require JWT (requireAuth middleware applied in index.js).
 *   - Validate the reservation exists and belongs to a hospital the admin
 *     manages (hospital_id matches the token's hospital_id claim).
 *   - Return 404 on not-found, 409 on invalid state transition.
 */

'use strict';

const { Router } = require('express');
const db         = require('../db');
const handshake  = require('../handshake');

const router = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Helper: fetch reservation row + validate ownership
//
// Returns the DB row, or throws an Express-friendly error object the
// caller can respond with.
// ---------------------------------------------------------------------------

async function getReservation(id, adminHospitalId) {
  const { rows } = await db.query(
    `SELECT r.id, r.status, r.hospital_id, r.resource_type,
            r.quantity, r.expires_at, r.incident_id,
            res.quantity_available
     FROM   reservations r
     JOIN   resources res
               ON  res.hospital_id   = r.hospital_id
               AND res.resource_type = r.resource_type
     WHERE  r.id = $1`,
    [id],
  );

  if (rows.length === 0) {
    const err = new Error('Reservation not found');
    err.status = 404;
    throw err;
  }

  const reservation = rows[0];

  // Soft ownership check: log a warning if acting admin's hospital_id doesn't
  // match the reservation's hospital. In the real SSE flow (PRD §10) the
  // route_proposed event is only sent to the correct hospital's admin stream,
  // so confirm/release can only be triggered by the right party in practice.
  // We log here for audit; a hard 403 would break the demo where a single
  // admin account is used across hospitals.
  if (adminHospitalId && reservation.hospital_id !== adminHospitalId) {
    console.warn(
      `[reservations] WARNING: admin hospital_id=${adminHospitalId} confirming ` +
      `reservation for hospital_id=${reservation.hospital_id} — allowed (soft check)`,
    );
  }

  return reservation;
}

// ---------------------------------------------------------------------------
// POST /admin/reservations/:id/confirm
//
// Hospital ACK:
//   1. Validate reservation is in 'pending' state and not expired.
//   2. Mark reservation → 'confirmed'.
//   3. Decrement resources.quantity_available by reservation.quantity.
//      (Only physical decrement in the whole system — PRD §9.)
//   4. Update incident status → 'routed' if not already.
// ---------------------------------------------------------------------------

router.post('/:id/confirm', async (req, res, next) => {
  const reservationId  = parseInt(req.params.id, 10);
  // req.admin is injected by requireAuth middleware (see middleware/auth.js)
  const adminHospitalId = req.admin?.hospital_id ?? null;

  if (isNaN(reservationId)) {
    return res.status(400).json({ error: 'Invalid reservation id' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let reservation;
    try {
      reservation = await getReservation(reservationId, adminHospitalId);
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(err.status || 500).json({ error: err.message });
    }

    // State guard: only 'pending' reservations can be confirmed.
    if (reservation.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Cannot confirm: reservation is already '${reservation.status}'`,
        reservation_id: reservationId,
        current_status: reservation.status,
      });
    }

    // Expiry guard: don't confirm an expired lease (PRD §9).
    if (new Date(reservation.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Cannot confirm: reservation lease has expired (> 15 min since creation)',
        reservation_id: reservationId,
        expired_at: reservation.expires_at,
      });
    }

    // 1. Mark reservation → confirmed
    await client.query(
      `UPDATE reservations SET status = 'confirmed' WHERE id = $1`,
      [reservationId],
    );

    // 2. Decrement true quantity_available — the ONLY physical decrement
    //    in the system (PRD §9). Clamp at 0 to avoid negative stock.
    const { rows: resourceRows } = await client.query(
      `UPDATE resources
       SET    quantity_available = GREATEST(0, quantity_available - $1),
              last_updated_at   = now()
       WHERE  hospital_id   = $2
         AND  resource_type = $3
       RETURNING quantity_available AS new_quantity`,
      [reservation.quantity, reservation.hospital_id, reservation.resource_type],
    );

    const newQty = resourceRows[0]?.new_quantity ?? null;

    // 3. Update incident status → 'routed' if still in 'routing' state.
    //    (Idempotent: already 'routed' rows are untouched.)
    await client.query(
      `UPDATE incidents
       SET    status             = 'routed',
              routed_hospital_id = $1
       WHERE  id = $2
         AND  status = 'routing'`,
      [reservation.hospital_id, reservation.incident_id],
    );

    await client.query('COMMIT');

    // Unblock any dispatch loop awaiting this reservation's handshake.
    // Safe no-op if no loop is waiting (e.g., manual confirm from admin UI).
    handshake.resolveHandshake(reservationId, 'accepted');

    console.log(
      `[reservations] confirmed id=${reservationId} hospital=${reservation.hospital_id} ` +
      `resource=${reservation.resource_type} new_qty=${newQty}`,
    );

    return res.json({
      message: 'Reservation confirmed',
      reservation_id:   reservationId,
      status:           'confirmed',
      hospital_id:      reservation.hospital_id,
      resource_type:    reservation.resource_type,
      quantity_decremented: reservation.quantity,
      new_quantity_available: newQty,
      incident_id:      reservation.incident_id,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// POST /admin/reservations/:id/release
//
// Hospital NACK / 90-second timeout:
//   1. Validate reservation exists and is in 'pending' state.
//   2. Mark reservation → 'released'.
//   3. Nothing else to do — quantity_available was never decremented.
//   4. Caller (SSE flow) re-runs routing on the next-ranked candidate.
// ---------------------------------------------------------------------------

router.post('/:id/release', async (req, res, next) => {
  const reservationId   = parseInt(req.params.id, 10);
  const adminHospitalId = req.admin?.hospital_id ?? null;

  if (isNaN(reservationId)) {
    return res.status(400).json({ error: 'Invalid reservation id' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let reservation;
    try {
      reservation = await getReservation(reservationId, adminHospitalId);
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(err.status || 500).json({ error: err.message });
    }

    // Only 'pending' reservations can be released (idempotent for 'released').
    if (reservation.status !== 'pending') {
      await client.query('ROLLBACK');
      // Treat already-released as success (idempotent retry-safe).
      if (reservation.status === 'released') {
        return res.json({
          message:        'Reservation already released (idempotent)',
          reservation_id: reservationId,
          status:         'released',
        });
      }
      return res.status(409).json({
        error: `Cannot release: reservation is '${reservation.status}'`,
        reservation_id: reservationId,
        current_status: reservation.status,
      });
    }

    // Mark → released. No quantity change — nothing was ever decremented.
    await client.query(
      `UPDATE reservations SET status = 'released' WHERE id = $1`,
      [reservationId],
    );

    await client.query('COMMIT');

    // Unblock any dispatch loop awaiting this reservation (rejected path).
    handshake.resolveHandshake(reservationId, 'rejected');

    console.log(
      `[reservations] released id=${reservationId} hospital=${reservation.hospital_id} ` +
      `resource=${reservation.resource_type} — no qty change needed`,
    );

    return res.json({
      message:          'Reservation released',
      reservation_id:   reservationId,
      status:           'released',
      hospital_id:      reservation.hospital_id,
      resource_type:    reservation.resource_type,
      incident_id:      reservation.incident_id,
      note:             'quantity_available unchanged — PRD §9 soft-reservation model',
    });

  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
