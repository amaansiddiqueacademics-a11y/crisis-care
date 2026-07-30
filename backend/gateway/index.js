// Crisis Care — Express Gateway
// Scaffolding only. Business logic implemented in Phase 3.
// See docs/PRD.md §8 FR-3, FR-4, FR-6 and §9 API Specification.
//
// Responsibilities of this service (do not add patient-facing logic here):
//   - POST /admin/auth/login       — JWT issuance (bcrypt password check)
//   - GET  /admin/inventory        — list hospital's resources (JWT required)
//   - PUT  /admin/inventory/:id    — update quantity + last_updated_at, SSE push (JWT required)
//   - GET  /stream/hospital/:id    — SSE stream of inventory change events

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'crisis-care-gateway', phase: 'scaffolding' });
});

// TODO (Phase 3): Mount admin auth router
// const authRouter = require('./routes/auth');
// app.use('/admin/auth', authRouter);

// TODO (Phase 3): Mount inventory router (JWT-protected)
// const inventoryRouter = require('./routes/inventory');
// app.use('/admin/inventory', requireAuth, inventoryRouter);

// TODO (Phase 3): Mount SSE stream router
// const streamRouter = require('./routes/stream');
// app.use('/stream', streamRouter);

app.listen(PORT, () => {
  console.log(`[gateway] Listening on port ${PORT}`);
});
