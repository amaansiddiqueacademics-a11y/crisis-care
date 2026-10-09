/**
 * Crisis Care — Express Gateway  (FR-3, FR-4, FR-6)
 *
 * Responsibilities (AGENTS.md — do NOT add patient-facing logic here):
 *   POST /admin/auth/login          — bcrypt verify + JWT issuance
 *   GET  /admin/inventory           — list hospital resources (JWT required)
 *   PUT  /admin/inventory/:id       — update quantity + SSE push (JWT required)
 *   GET  /stream/hospital/:id       — SSE stream of inventory changes
 *
 * This service never touches /match or any routing logic.
 * That lives exclusively in services/routing (Python/FastAPI).
 */

'use strict';

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const db          = require('./db');
const requireAuth = require('./middleware/auth');
const authRouter  = require('./routes/auth');
const invRouter   = require('./routes/inventory');
const streamRouter = require('./routes/stream');
const resRouter    = require('./routes/reservations');
const dispatchRouter = require('./routes/dispatch');
const devRouter   = require('./routes/dev');
const adminRouter = require('./routes/admin');
const handshake   = require('./handshake');
const simWorker   = require('./simulation-worker');

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app  = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// CORS — allow the admin dashboard local dev origin and any deployed origin.
// For production, replace the origin list with the actual dashboard URL.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Public: health check
app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok', service: 'crisis-care-gateway', db: 'connected',
      handshakes_in_flight: handshake.pendingCount(),
    });
  } catch (err) {
    res.json({ status: 'degraded', service: 'crisis-care-gateway', db: err.message });
  }
});

// Public: login (issues JWT)
app.use('/admin/auth', authRouter);

// Public: dispatch incident (triage coordinator sends scene + triage_category)
// POST /dispatch-incident  — unauthenticated (patient/EMS facing)
app.use('/dispatch-incident', dispatchRouter);

// Protected: inventory CRUD
app.use('/admin/inventory', requireAuth, invRouter);

// Protected: reservation confirm/release
app.use('/admin/reservations', requireAuth, resRouter);
app.use('/admin', adminRouter);

// SSE stream
app.use('/stream', streamRouter);

// Dev-only: sim control + demo reset (never mount in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRouter);
  console.log('[gateway] Dev endpoints mounted at /api/dev (NODE_ENV!=production)');
}

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Log the full error for operators, but never send it to the client.
  console.error('[gateway] Unhandled error:', err.stack || err.message);

  // Guard: if headers are already sent, delegate to Express's default handler.
  if (res.headersSent) return;

  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[gateway] Listening on port ${PORT}`);
  console.log(`[gateway] CORS allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);

  // Start Poisson inventory simulation worker (PRD §12).
  // Controlled by SIM_ENABLED env var (default: 'true').
  // Set SIM_ENABLED=false to start paused; toggle at runtime via POST /api/dev/sim.
  // Legacy SIM_DISABLED=1 is also honoured for backwards compat.
  if (process.env.SIM_DISABLED !== '1') {
    simWorker.start();
  } else {
    console.log('[gateway] Simulation worker not started (SIM_DISABLED=1)');
  }
});
