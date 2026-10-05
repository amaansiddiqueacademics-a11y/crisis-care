/**
 * Crisis Care — Auth router  POST /admin/auth/login  (FR-3, FR-6)
 *
 * Validates username + password against admin_users.hashed_password using
 * bcrypt, then issues a signed JWT containing hospital_id.
 *
 * JWT payload:
 *   sub          — admin_users.id  (string, per JWT spec)
 *   hospital_id  — integer
 *   username     — string
 *   iat / exp    — issued-at / expires (24 h)
 *
 * Security notes (FR-6):
 *   - bcrypt.compare is constant-time; never short-circuit on username miss.
 *   - Always return 401 with the same message for wrong username OR wrong
 *     password — don't reveal which one failed.
 *   - Parameterised query — no string interpolation.
 */

'use strict';

const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const router = express.Router();

// ---------------------------------------------------------------------------
// Fail-fast: JWT_SECRET must be set before the server starts handling
// requests.  Checked at module-load time so a missing secret crashes on
// startup with a clear message, not mid-request with a cryptic jwt error.
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    '[auth] FATAL: JWT_SECRET is not set. ' +
    'Add JWT_SECRET=<your-secret> to backend/gateway/.env and restart.',
  );
  process.exit(1);
}

const JWT_EXPIRES_IN = '24h';

// A real bcrypt hash that will never match any password.  The previous
// dummy string ('$2b$12$invalidhashpadding0000...') used characters outside
// bcrypt's base64 alphabet, causing bcrypt.compare to throw instead of
// returning false — which surfaced as a 500 "Internal server error".
//
// This hash was generated with:  bcrypt.hashSync('__never_match__', 12)
// It is a structurally valid bcrypt hash so compare() will always succeed
// (return false) without throwing.
const DUMMY_HASH = '$2b$12$HHhycnUdpbyMJDv1X7zwwuitQ2IZ2wkAlGBQ4hQMGeBwQAjvyf66O';

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  // ── 1. Look up the admin row ──────────────────────────────────────────
  let admin;
  try {
    const { rows } = await db.query(
      `SELECT au.id, au.hospital_id, au.username, au.hashed_password,
              h.name AS hospital_name, h.city AS hospital_city
       FROM admin_users au
       JOIN hospitals h ON h.id = au.hospital_id
       WHERE au.username = $1
       LIMIT 1`,
      [username],
    );
    admin = rows[0] ?? null;
  } catch (err) {
    console.error('[auth] DB error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // ── 2. bcrypt.compare — constant-time even when no user found ─────────
  //    Use a valid dummy hash when the user doesn't exist so the timing
  //    is indistinguishable from a real compare.
  let passwordMatch = false;
  try {
    const hashToCompare = admin?.hashed_password ?? DUMMY_HASH;
    passwordMatch = await bcrypt.compare(password, hashToCompare);
  } catch (err) {
    // bcrypt can throw on truly malformed hashes stored in the DB.
    // Treat it as a non-match — never leak the internal error to the client.
    console.error('[auth] bcrypt error:', err.message);
    passwordMatch = false;
  }

  if (!admin || !passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // ── 3. Issue JWT ──────────────────────────────────────────────────────
  let token;
  try {
    token = jwt.sign(
      {
        hospital_id: admin.hospital_id,
        username:    admin.username,
      },
      JWT_SECRET,
      {
        subject:   String(admin.id),
        expiresIn: JWT_EXPIRES_IN,
      },
    );
  } catch (err) {
    console.error('[auth] JWT signing error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  console.log(`[auth] login success: username=${admin.username} hospital_id=${admin.hospital_id} hospital=${admin.hospital_name}`);

  return res.json({
    token,
    hospital_id:   admin.hospital_id,
    hospital_name: admin.hospital_name ?? null,
    hospital_city: admin.hospital_city ?? null,
  });
});

module.exports = router;
