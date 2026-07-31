/**
 * Crisis Care — SSE client registry.
 *
 * Maintains a Map of  hospitalId (number) → Set<res> where each `res`
 * is an active Express response object with SSE headers already sent.
 *
 * Usage (send an event to all clients subscribed to a hospital):
 *   const sse = require('../sse');
 *   sse.broadcast(hospitalId, 'inventory_update', payload);
 *
 * This is an in-process registry — no Redis, no external message bus.
 * That is intentional for Phase 3 (single server instance). If the
 * deployment later needs horizontal scaling, swap this module for a
 * Redis pub/sub adapter without touching the route handlers.
 */

'use strict';

/** @type {Map<number, Set<import('express').Response>>} */
const clients = new Map();

/**
 * Register an SSE response object for a hospital.
 * Called once per GET /stream/hospital/:hospitalId connection.
 */
function register(hospitalId, res) {
  if (!clients.has(hospitalId)) clients.set(hospitalId, new Set());
  clients.get(hospitalId).add(res);
  console.log(
    `[sse] client connected  hospital=${hospitalId} total=${clients.get(hospitalId).size}`,
  );
}

/**
 * Remove an SSE response object (called on 'close' event).
 */
function unregister(hospitalId, res) {
  const set = clients.get(hospitalId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(hospitalId);
  }
  console.log(`[sse] client disconnected hospital=${hospitalId}`);
}

/**
 * Send an SSE event to every client subscribed to a hospital.
 *
 * @param {number} hospitalId
 * @param {string} eventName  - SSE `event:` field
 * @param {object} data       - serialised as JSON in the `data:` field
 */
function broadcast(hospitalId, eventName, data) {
  const set = clients.get(hospitalId);
  if (!set || set.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (err) {
      console.error(`[sse] write error hospital=${hospitalId}:`, err.message);
      set.delete(res);
    }
  }
  console.log(
    `[sse] broadcast event=${eventName} hospital=${hospitalId} clients=${set.size}`,
  );
}

module.exports = { register, unregister, broadcast };
