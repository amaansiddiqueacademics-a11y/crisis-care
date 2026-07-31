/**
 * Crisis Care — SSE stream router  GET /stream/hospital/:hospitalId  (FR-4)
 *
 * Opens a Server-Sent Events connection for a given hospital.
 * Any admin dashboard tab subscribed here will receive real-time
 * inventory_update events whenever PUT /admin/inventory/:id succeeds
 * for that hospital.
 *
 * This endpoint is intentionally unauthenticated in the current design:
 *   - The hospital ID in the URL is not a secret (it's in the admin's JWT).
 *   - Events contain only aggregate inventory data, no PII.
 *   - Adding JWT auth here would require clients to embed the token in the
 *     URL (EventSource doesn't support custom headers), which is worse for
 *     security than the current approach.
 *   - If tighter access control is needed later, switch to a cookie-based
 *     session token or a short-lived SSE ticket.
 *
 * Protocol:
 *   On connect → send a `connected` event with the hospital ID and timestamp.
 *   On inventory change → send an `inventory_update` event (via sse.broadcast).
 *   Heartbeat every 30 s to keep the connection alive through proxies/firewalls.
 *   On client disconnect → deregister from the SSE registry.
 */

'use strict';

const express = require('express');
const sse     = require('../sse');

const router = express.Router();

const HEARTBEAT_INTERVAL_MS = 30_000;

router.get('/hospital/:hospitalId', (req, res) => {
  const hospitalId = parseInt(req.params.hospitalId, 10);

  if (isNaN(hospitalId) || hospitalId <= 0) {
    return res.status(400).json({ error: 'hospitalId must be a positive integer' });
  }

  // Set SSE headers — disable buffering (Nginx/express-compress need these)
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');   // disable Nginx proxy buffering
  res.flushHeaders();                          // flush headers immediately

  // Register this response with the SSE registry
  sse.register(hospitalId, res);

  // Send an initial `connected` event so the client knows the stream is live
  res.write(
    `event: connected\n` +
    `data: ${JSON.stringify({ hospital_id: hospitalId, ts: new Date().toISOString() })}\n\n`,
  );

  // Heartbeat — keeps the TCP connection alive through idle-timeout proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');   // SSE comment — ignored by EventSource
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sse.unregister(hospitalId, res);
  });
});

module.exports = router;
