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

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app  = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// CORS — allow the admin dashboard local dev origin and any deployed origin.
// For production, replace the origin list with the actual dashboard URL.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
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
    res.json({ status: 'ok', service: 'crisis-care-gateway', db: 'connected' });
  } catch (err) {
    res.json({ status: 'degraded', service: 'crisis-care-gateway', db: err.message });
  }
});

// Public: login (issues JWT)
app.use('/admin/auth', authRouter);

// Protected: inventory CRUD — requireAuth middleware runs before invRouter
app.use('/admin/inventory', requireAuth, invRouter);

// SSE stream — unauthenticated by design (see routes/stream.js for rationale)
app.use('/stream', streamRouter);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[gateway] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[gateway] Listening on port ${PORT}`);
  console.log(`[gateway] CORS allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
