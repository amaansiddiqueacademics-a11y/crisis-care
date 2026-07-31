/**
 * Crisis Care — JWT authentication middleware (FR-6).
 *
 * Verifies the Bearer token in the Authorization header using JWT_SECRET.
 * On success, attaches `req.admin` = { id, hospital_id, username }.
 * On failure, responds with 401 — never 403, to avoid leaking resource existence.
 *
 * Usage:
 *   const requireAuth = require('../middleware/auth');
 *   router.get('/protected', requireAuth, handler);
 */

'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[auth] FATAL: JWT_SECRET env var is not set');
  process.exit(1);
}

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice(7); // strip 'Bearer '
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Attach decoded claims — route handlers use req.admin.hospital_id
    req.admin = {
      id:          payload.sub,
      hospital_id: payload.hospital_id,
      username:    payload.username,
    };
    next();
  } catch (err) {
    const reason = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: reason });
  }
}

module.exports = requireAuth;
