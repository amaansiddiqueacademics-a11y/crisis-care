/**
 * Crisis Care — Gateway database pool (pg).
 *
 * Single pg.Pool shared across all route handlers.
 * Call db.query() directly; the pool manages connections.
 *
 * Using `pg` (not asyncpg) because this service is Node/Express.
 * DATABASE_URL comes from .env; default targets Docker on host port 5433.
 */

'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Prevent Docker/OS from silently dropping idle TCP connections,
  // which causes "Connection terminated due to connection timeout" on
  // the first request after an idle period.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

module.exports = pool;
