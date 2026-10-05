/**
 * Crisis Care — Frontend API Client
 *
 * All calls go through Vite's dev proxy:
 *   /api/gateway/*  → http://localhost:4000/*  (Node/Express gateway)
 *   /api/routing/*  → http://localhost:8000/*  (FastAPI routing service)
 *
 * In production, set VITE_GATEWAY_URL and VITE_ROUTING_URL env vars.
 *
 * Token management: JWT is stored in memory (not localStorage) to prevent XSS.
 * A refresh on tab close logs the user out — acceptable for this use-case.
 */

const GATEWAY = import.meta.env.VITE_GATEWAY_URL  || '/api/gateway';
const ROUTING  = import.meta.env.VITE_ROUTING_URL  || '/api/routing';

// In-memory token store — never persisted to localStorage
let _token = null;
let _onUnauthorized = null;

// ── Token management ────────────────────────────────────────────────────────

export const setToken = (t)  => { _token = t; };
export const clearToken = ()  => { _token = null; };
export const getToken   = ()  => _token;
export const onUnauthorized = (cb) => { _onUnauthorized = cb; };

// ── Internal helpers ────────────────────────────────────────────────────────

function authHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  return h;
}

async function parseResponse(res) {
  if (res.status === 401) {
    _onUnauthorized?.();
    throw new Error('Unauthorized — session expired');
  }
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const detail = body?.detail || body?.error || body || `HTTP ${res.status}`;
    const msg = Array.isArray(detail)
      ? detail.map(d => d.msg || JSON.stringify(d)).join('; ')
      : String(detail);
    throw new Error(msg);
  }
  return body;
}

async function gatewayFetch(path, opts = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...opts,
    headers: authHeaders(opts.headers || {}),
  });
  return parseResponse(res);
}

async function routingFetch(path, opts = {}) {
  const res = await fetch(`${ROUTING}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return parseResponse(res);
}

// ── Gateway — Auth ───────────────────────────────────────────────────────────

/**
 * POST /admin/auth/login
 * @returns {{ token: string, hospital_id: number, hospital_name: string }}
 */
export async function login(username, password) {
  const res = await fetch(`${GATEWAY}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  // Handle 401 directly here — do NOT invoke the global onUnauthorized handler,
  // because a 401 during login means "wrong credentials", not "session expired".
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Invalid credentials');
  }
  return parseResponse(res);
}

// ── Gateway — Inventory ─────────────────────────────────────────────────────

/**
 * GET /admin/inventory
 * @returns {{ hospital_id: number, resources: Resource[] }}
 */
export async function fetchInventory() {
  return gatewayFetch('/admin/inventory');
}

/**
 * PUT /admin/inventory/:resourceId
 * @returns {{ resource: Resource }}
 */
export async function updateResource(resourceId, quantityAvailable) {
  return gatewayFetch(`/admin/inventory/${resourceId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity_available: quantityAvailable }),
  });
}

// ── Gateway — Reservations ──────────────────────────────────────────────────

/** POST /admin/reservations/:id/confirm */
export async function confirmReservation(reservationId) {
  return gatewayFetch(`/admin/reservations/${reservationId}/confirm`, { method: 'POST', body: '{}' });
}

/** POST /admin/reservations/:id/release */
export async function releaseReservation(reservationId) {
  return gatewayFetch(`/admin/reservations/${reservationId}/release`, { method: 'POST', body: '{}' });
}

// ── Gateway — Dispatch ──────────────────────────────────────────────────────

/**
 * POST /dispatch-incident
 * Full SSE handshake — gateway calls FastAPI, waits for hospital ACK.
 * @param {{ triage_category, scene_lat, scene_lng, idempotency_key? }} payload
 */
export async function dispatchIncident(payload) {
  return gatewayFetch('/dispatch-incident', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Gateway — Health ────────────────────────────────────────────────────────

export async function gatewayHealth() {
  return gatewayFetch('/health');
}

// ── Gateway — SSE ───────────────────────────────────────────────────────────

/**
 * Build SSE EventSource URL for a given hospital ID.
 * Pass hospitalId=0 for the global monitoring channel.
 */
export function sseUrl(hospitalId) {
  return `${GATEWAY}/stream/hospital/${hospitalId}`;
}

/**
 * Connect to SSE stream for a hospital.
 * Returns an EventSource instance. Caller is responsible for closing it.
 *
 * @param {number} hospitalId
 * @param {Record<string, (data: object) => void>} handlers  — { event_name: handler }
 * @returns {EventSource}
 */
export function connectSSE(hospitalId, handlers = {}) {
  const url = sseUrl(hospitalId);
  const es = new EventSource(url);

  es.addEventListener('connected', (e) => {
    try { handlers.connected?.(JSON.parse(e.data)); } catch (_) {}
  });

  ['inventory_update', 'route_proposed', 'route_confirmed', 'route_rejected'].forEach(ev => {
    es.addEventListener(ev, (e) => {
      try { handlers[ev]?.(JSON.parse(e.data)); } catch (_) {}
    });
  });

  es.onerror = (err) => {
    console.warn('[SSE] connection error — will auto-reconnect', err);
    handlers.error?.(err);
  };

  return es;
}

// ── FastAPI Routing Service ─────────────────────────────────────────────────

/**
 * POST /route-incident  (preview=true — read-only, no reservations)
 */
export async function routeIncidentPreview(payload) {
  return routingFetch('/route-incident', {
    method: 'POST',
    body: JSON.stringify({ ...payload, preview: true }),
  });
}

/**
 * POST /route-incident  (full commit — creates incident + reservations)
 */
export async function routeIncident(payload) {
  return routingFetch('/route-incident', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * GET /hospitals-summary
 * Returns all hospitals with availability_score, resource counts, lat/lng.
 */
export async function fetchHospitalsSummary() {
  return routingFetch('/hospitals-summary');
}

/**
 * GET /resource-types
 * Returns all valid resource_type_enum values from the DB.
 */
export async function fetchResourceTypes() {
  return routingFetch('/resource-types');
}

/** FastAPI health check */
export async function routingHealth() {
  return routingFetch('/health');
}

// ── Dev endpoints ───────────────────────────────────────────────────────────

/** POST /api/dev/reset-demo — reset all inventory to seed state */
export async function resetDemo() {
  return gatewayFetch('/api/dev/reset-demo', { method: 'POST', body: '{}' });
}
