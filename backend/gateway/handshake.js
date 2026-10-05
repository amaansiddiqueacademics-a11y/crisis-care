/**
 * Crisis Care — Handshake state tracker (PRD §10)
 *
 * In-memory promise map that bridges two independent HTTP request chains:
 *
 *   Chain A (dispatch loop):
 *     POST /admin/dispatch-incident → pushes SSE → waits here
 *
 *   Chain B (hospital admin):
 *     POST /admin/reservations/:id/confirm  ─┐
 *     POST /admin/reservations/:id/release  ─┘ → calls resolveHandshake()
 *
 * When the hospital confirms or rejects, resolveHandshake() resolves the
 * promise that the dispatch loop is awaiting, with 'accepted' or 'rejected'.
 * If neither arrives within HANDSHAKE_TIMEOUT_MS (default 90 s), the promise
 * resolves with 'timeout' and the dispatch loop auto-releases the reservation.
 *
 * Design constraints (PRD §§3, 10):
 *   - No Redis, no external bus — single-process in-memory only.
 *   - If horizontal scaling is ever needed, replace this module with a
 *     Redis pub/sub adapter; the callers (dispatch.js, reservations.js)
 *     don't need to change.
 *
 * Override for testing: set HANDSHAKE_TIMEOUT_MS env var (e.g., 5000 for 5 s).
 */

'use strict';

const HANDSHAKE_TIMEOUT_MS =
  parseInt(process.env.HANDSHAKE_TIMEOUT_MS || '90000', 10);

/**
 * @typedef {{ resolve: (outcome: string) => void, timer: NodeJS.Timeout }} Pending
 * @type {Map<number, Pending>}
 */
const pending = new Map();

/**
 * Wait for a hospital to accept or reject a reservation.
 *
 * @param {number} reservationId
 * @param {number} [timeoutMs]  - override for testing; defaults to HANDSHAKE_TIMEOUT_MS
 * @returns {Promise<'accepted'|'rejected'|'timeout'>}
 */
function waitForHandshake(reservationId, timeoutMs = HANDSHAKE_TIMEOUT_MS) {
  // Normalize to Number — pg returns integer PKs as strings; parseInt makes
  // the Map key consistent regardless of whether the caller passes "37" or 37.
  const id = Number(reservationId);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        console.log(`[handshake] timeout reservation=${id} after ${timeoutMs}ms`);
        resolve('timeout');
      }
    }, timeoutMs);

    pending.set(id, { resolve, timer });
    console.log(
      `[handshake] waiting reservation=${id} timeout=${timeoutMs}ms`,
    );
  });
}

/**
 * Resolve a pending handshake (called from reservations confirm/release handler).
 * Safe to call even if no dispatch loop is waiting (no-op in that case).
 *
 * @param {number} reservationId
 * @param {'accepted'|'rejected'} outcome
 * @returns {boolean} true if a waiting dispatch loop was notified
 */
function resolveHandshake(reservationId, outcome) {
  const id = Number(reservationId);
  const entry = pending.get(id);
  if (!entry) return false;

  clearTimeout(entry.timer);
  pending.delete(id);
  console.log(`[handshake] resolved reservation=${id} outcome=${outcome}`);
  entry.resolve(outcome);
  return true;
}

/**
 * Cancel all pending handshakes (useful for graceful shutdown).
 */
function cancelAll() {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    entry.resolve('timeout');
    pending.delete(id);
  }
}

/** How many handshakes are currently in flight (for observability). */
function pendingCount() {
  return pending.size;
}

module.exports = { waitForHandshake, resolveHandshake, cancelAll, pendingCount };
