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
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  let admin;
  try {
    const { rows } = await db.query(
      `SELECT id, hospital_id, username, hashed_password
       FROM admin_users
       WHERE username = $1
       LIMIT 1`,
      [username],
    );
    admin = rows[0] ?? null;
  } catch (err) {
    console.error('[auth] DB error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Always run bcrypt.compare — constant-time even when no user found —
  // to prevent username-enumeration via timing differences.
  const hashToCompare = admin?.hashed_password ?? '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
  const passwordMatch = await bcrypt.compare(password, hashToCompare);

  if (!admin || !passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
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

  console.log(`[auth] login success: username=${admin.username} hospital_id=${admin.hospital_id}`);

  return res.json({
    token,
    hospital_id: admin.hospital_id,
  });
});

module.exports = router;
