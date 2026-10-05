/**
 * Crisis Care — POST /admin/dispatch-incident  (PRD §10)
 *
 * Full SSE handshake orchestration loop:
 *
 *   1. Call FastAPI POST /route-incident → get ranked feasible candidates.
 *   2. Select winner (rank 1).
 *   3. Push `route_proposed` SSE event to that hospital's admin channel.
 *   4. Wait up to HANDSHAKE_TIMEOUT_MS (default 90 s) for the hospital
 *      admin to call:
 *        POST /admin/reservations/:id/confirm  → outcome = 'accepted'
 *        POST /admin/reservations/:id/release  → outcome = 'rejected'
 *   5a. accepted  → push `route_confirmed` SSE; return 200 to caller.
 *   5b. rejected  → push `route_rejected` SSE; release reservation if not
 *      already released; add hospital to exclusion list; re-run from step 1.
 *   5c. timeout   → same as rejected (auto-release via reservations API).
 *
 * The loop terminates when:
 *   - A hospital accepts              → status 200, routing_mode=accepted
 *   - No more feasible candidates     → status 503, routing_mode=exhausted
 *   - MAX_REROUT_ATTEMPTS is reached  → status 503, routing_mode=exhausted
 *
 * Architecture note (AGENTS.md):
 *   The gateway orchestrates the SSE handshake; FastAPI is a stateless
 *   routing math service called over HTTP. No routing logic lives here —
 *   only the handshake state machine and SSE push.
 *
 * Security:
 *   This endpoint is patient-facing (unauthenticated) because:
 *   - The *caller* is the triage coordinator/EMS dispatcher, not a hospital.
 *   - The confirm/release actions that require auth are in /admin/reservations.
 *   If you want to protect it, add requireAuth and pass the token through.
 */

'use strict';

const http    = require('http');
const { Router } = require('express');
const sse     = require('../sse');
const handshake = require('../handshake');
const db      = require('../db');

const router = Router();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FASTAPI_BASE = process.env.FASTAPI_URL || 'http://localhost:8000';

// Safety valve: don't loop more than this many re-route attempts per incident.
const MAX_REROUTE_ATTEMPTS = parseInt(process.env.MAX_REROUTE_ATTEMPTS || '5', 10);

// Handshake timeout per attempt — honour the env override used in tests.
const HANDSHAKE_TIMEOUT_MS = parseInt(process.env.HANDSHAKE_TIMEOUT_MS || '90000', 10);

// ---------------------------------------------------------------------------
// Idempotency key cache (in-memory, single-server only, 5-min TTL)
// Prevents double-dispatch if the client sends the same request twice.
// ---------------------------------------------------------------------------

/** @type {Map<string, { result: object, expiresAt: number }>} */
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Prune expired entries (called lazily on each new request). */
function pruneIdempotency() {
  const now = Date.now();
  for (const [k, v] of idempotencyCache) {
    if (v.expiresAt <= now) idempotencyCache.delete(k);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** POST to FastAPI as a raw HTTP call (avoids importing axios). */
function callFastAPI(path, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const url = new URL(path, FASTAPI_BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port:     url.port || 8000,
        path:     url.pathname,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': payload.length,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/** POST /admin/reservations/:id/release via internal HTTP — used for auto-release. */
async function autoRelease(reservationIds, token) {
  for (const id of reservationIds) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port:     process.env.PORT || 4000,
          path:     `/admin/reservations/${id}/release`,
          method:   'POST',
          headers: {
            'Content-Type':  'application/json',
            'Content-Length': 0,
            'Authorization': token || '',
          },
        }, (res) => {
          res.resume(); // drain response
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.end();
      });
      console.log(`[dispatch] auto-released reservation id=${id}`);
    } catch (err) {
      console.error(`[dispatch] auto-release failed id=${id}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// POST /admin/dispatch-incident
// ---------------------------------------------------------------------------

router.post('/', async (req, res) => {
  const { triage_category, scene_lat, scene_lng, idempotency_key } = req.body || {};

  // Validate required fields
  if (!triage_category || scene_lat == null || scene_lng == null) {
    return res.status(400).json({
      error: 'Required fields: triage_category, scene_lat, scene_lng',
    });
  }

  // Idempotency: if we've already processed this key, return the cached result.
  pruneIdempotency();
  if (idempotency_key) {
    const cached = idempotencyCache.get(idempotency_key);
    if (cached) {
      console.log(`[dispatch] idempotency hit key=${idempotency_key}`);
      return res.json({ ...cached.result, idempotency_replayed: true });
    }
  }

  // Internal auth token for auto-releasing reservations via HTTP
  const internalToken = req.headers['authorization'] || '';

  console.log(
    `[dispatch] incident triage=${triage_category} scene=(${scene_lat},${scene_lng})`,
  );

  // Track state across re-route attempts
  let incidentId      = null;    // set after first FastAPI call
  let excludedIds     = [];      // hospital_ids rejected so far
  let attempt         = 0;
  let finalResult     = null;

  // ── Orchestration loop ────────────────────────────────────────────────────
  while (attempt < MAX_REROUTE_ATTEMPTS) {
    attempt++;
    console.log(`[dispatch] attempt=${attempt} excluded=${JSON.stringify(excludedIds)}`);

    // ── Step 1: Call FastAPI /route-incident ───────────────────────────────
    const routeBody = {
      triage_category,
      scene_lat,
      scene_lng,
      ...(incidentId       ? { incident_id: incidentId }            : {}),
      ...(excludedIds.length ? { exclude_hospital_ids: excludedIds } : {}),
    };

    let routeResp;
    try {
      routeResp = await callFastAPI('/route-incident', routeBody);
    } catch (err) {
      console.error('[dispatch] FastAPI call failed:', err.message);
      return res.status(502).json({ error: 'Routing service unreachable', detail: err.message });
    }

    if (routeResp.status !== 200) {
      console.error('[dispatch] FastAPI error:', routeResp.body);
      return res.status(routeResp.status).json({
        error: 'Routing service error',
        detail: routeResp.body,
      });
    }

    const route = routeResp.body;
    incidentId = route.incident_id;   // capture on first pass

    // ── Step 2: Check if routing found any feasible candidates ─────────────
    // Tier B fallback means no feasible candidates existed — treat as no
    // candidates for the handshake loop (can't get hospital ACK from Tier B).
    if (route.routing_mode === 'tier_b_fallback' && attempt === 1) {
      // Special case: immediately return the Tier B result — no handshake needed.
      console.log(`[dispatch] Tier B fallback at attempt=${attempt} — returning immediately`);
      return res.json({
        outcome:        'tier_b_fallback',
        incident_id:    incidentId,
        attempts:       attempt,
        route,
      });
    }

    if (!route.selected || !route.selected.is_feasible) {
      console.log(`[dispatch] no feasible candidates at attempt=${attempt}`);
      break;
    }

    const selected       = route.selected;
    const hospitalId     = selected.id;
    const hospitalName   = selected.name;
    // The reservation IDs were created by FastAPI — fetch them from DB.
    const { rows: resvRows } = await db.query(
      `SELECT id, resource_type FROM reservations
       WHERE incident_id = $1 AND status = 'pending'
       ORDER BY id`,
      [incidentId],
    );
    const reservationIds = resvRows.map(r => r.id);

    // ── Step 3.5: Pre-register handshake BEFORE broadcasting ───────────────
    // CRITICAL ordering: waitForHandshake must be called BEFORE sse.broadcast.
    // If we broadcast first, the hospital admin could call confirm/release and
    // resolveHandshake before the pending map entry exists → dispatch falls
    // back to the full HANDSHAKE_TIMEOUT instead of resolving immediately.
    const primaryResvId = reservationIds[0];
    if (!primaryResvId) {
      console.error('[dispatch] no reservation rows found for incident — aborting');
      break;
    }
    const handshakePromise = handshake.waitForHandshake(primaryResvId, HANDSHAKE_TIMEOUT_MS);

    // ── Step 3: Push route_proposed SSE to hospital ────────────────────────
    const ssePayload = {
      incident_id:      incidentId,
      triage_category,
      scene_lat,
      scene_lng,
      required_resources: route.required_resources,
      selected_hospital: {
        id:           hospitalId,
        name:         hospitalName,
        eta_minutes:  selected.eta_minutes,
        cost:         selected.cost,
      },
      reservation_ids:  reservationIds,
      confirm_url:      reservationIds.map(id => `/admin/reservations/${id}/confirm`),
      release_url:      reservationIds.map(id => `/admin/reservations/${id}/release`),
      expires_in_seconds: Math.floor(HANDSHAKE_TIMEOUT_MS / 1000),
      ts:               new Date().toISOString(),
    };

    sse.broadcast(hospitalId, 'route_proposed', ssePayload);

    // Also broadcast to the global dispatch channel (hospital_id=0) so
    // monitoring dashboards and test clients can subscribe without knowing
    // which hospital will be selected in advance.
    sse.broadcast(0, 'route_proposed', ssePayload);
    console.log(
      `[dispatch] route_proposed → hospital=${hospitalId} (${hospitalName}) ` +
      `incident=${incidentId} reservations=${JSON.stringify(reservationIds)}`,
    );

    const outcome = await handshakePromise;

    console.log(
      `[dispatch] handshake outcome=${outcome} hospital=${hospitalId} attempt=${attempt}`,
    );

    // ── Step 5a: Accepted ──────────────────────────────────────────────────
    if (outcome === 'accepted') {
      sse.broadcast(hospitalId, 'route_confirmed', {
        incident_id:  incidentId,
        hospital_id:  hospitalId,
        hospital_name: hospitalName,
        reservation_ids: reservationIds,
        ts: new Date().toISOString(),
      });
      sse.broadcast(0, 'route_confirmed', {
        incident_id:  incidentId,
        hospital_id:  hospitalId,
        hospital_name: hospitalName,
        reservation_ids: reservationIds,
        ts: new Date().toISOString(),
      });

      finalResult = {
        outcome:       'accepted',
        incident_id:   incidentId,
        hospital_id:   hospitalId,
        hospital_name: hospitalName,
        eta_minutes:   selected.eta_minutes,
        attempts:      attempt,
        route,
      };
      break;
    }

    // ── Step 5b/c: Rejected or timeout ────────────────────────────────────
    const reason = outcome === 'timeout' ? 'timeout (90 s)' : 'rejected by hospital';
    console.log(`[dispatch] ${reason} — releasing reservations and re-routing`);

    sse.broadcast(hospitalId, 'route_rejected', {
      incident_id:     incidentId,
      hospital_id:     hospitalId,
      reason:          outcome,
      reservation_ids: reservationIds,
      ts:              new Date().toISOString(),
    });
    sse.broadcast(0, 'route_rejected', {
      incident_id:     incidentId,
      hospital_id:     hospitalId,
      reason:          outcome,
      reservation_ids: reservationIds,
      ts:              new Date().toISOString(),
    });

    // Auto-release ALL pending reservations for this attempt.
    // The confirm/release endpoint resolves the handshake for the primary resv;
    // remaining pending ones (other resources) need explicit release.
    const pendingIds = resvRows
      .filter(r => r.id !== primaryResvId)  // primary already resolved above
      .map(r => r.id);
    if (pendingIds.length) {
      await autoRelease(pendingIds, internalToken);
    }

    // Add hospital to exclusion list for the next attempt
    excludedIds.push(hospitalId);
    // Small pause to avoid hammering FastAPI in immediate succession
    await new Promise(r => setTimeout(r, 200));
  }

  // ── Loop finished ─────────────────────────────────────────────────────────
  if (finalResult) {
    return res.json(finalResult);
  }

  // Exhausted all feasible candidates
  console.log(
    `[dispatch] exhausted all candidates after ${attempt} attempts, incident=${incidentId}`,
  );
  return res.status(503).json({
    outcome:      'exhausted',
    incident_id:  incidentId,
    attempts:     attempt,
    excluded_ids: excludedIds,
    error:        'No feasible hospital accepted the routing proposal within constraints',
  });
});

module.exports = router;
