'use strict';
const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /admin/resource-changes?resource_type=&hospital_id=&limit=200
// Returns recent resource quantity changes across all hospitals (for Admin panel)
// This pulls from the resources table with last_updated_at and joins with hospitals
router.get('/resource-changes', async (req, res) => {
  try {
    const { resource_type, hospital_id, limit = 200 } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (resource_type && resource_type !== 'ALL') {
      conditions.push(`r.resource_type = $${idx++}`);
      params.push(resource_type);
    }
    if (hospital_id && hospital_id !== 'ALL') {
      conditions.push(`r.hospital_id = $${idx++}`);
      params.push(parseInt(hospital_id, 10));
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(Math.min(parseInt(limit, 10) || 200, 500));

    const { rows } = await db.query(
      `SELECT
         r.id AS resource_id,
         r.hospital_id,
         h.name AS hospital_name,
         r.resource_type,
         r.quantity_available,
         r.last_updated_at,
         r.staleness_threshold_minutes
       FROM resources r
       JOIN hospitals h ON h.id = r.hospital_id
       ${where}
       ORDER BY r.last_updated_at DESC
       LIMIT $${idx}`,
      params
    );
    return res.json({ changes: rows });
  } catch (err) {
    console.error('[admin] resource-changes error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/attendants — list all ambulance attendants with live location stub
//
// Simulated GPS coordinates are sparsely distributed south→north across Mumbai,
// from Colaba (18.906 N) up to Dahisar (19.260 N).  Each attendant is assigned
// to one of 12 named zones in round-robin order; a small seeded jitter keeps
// positions stable between refreshes while staying within the zone's bounds.
router.get('/attendants', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, badge_id, name, email, callsign, assigned_ambulance_id
       FROM ambulance_attendants
       ORDER BY name ASC`
    );

    // 12 real Mumbai zones ordered south → north.
    // lat/lng ranges are tight enough to look realistic on a street map.
    const MUMBAI_ZONES = [
      { name: 'Colaba / Nariman Point', latMin: 18.906, latMax: 18.928, lngMin: 72.815, lngMax: 72.838 },
      { name: 'Fort / Churchgate',      latMin: 18.929, latMax: 18.950, lngMin: 72.826, lngMax: 72.845 },
      { name: 'Mazgaon / Byculla',      latMin: 18.957, latMax: 18.978, lngMin: 72.835, lngMax: 72.858 },
      { name: 'Dadar / Parel',          latMin: 18.993, latMax: 19.018, lngMin: 72.838, lngMax: 72.862 },
      { name: 'Mahim / Worli',          latMin: 19.018, latMax: 19.040, lngMin: 72.835, lngMax: 72.858 },
      { name: 'Bandra / Khar',          latMin: 19.048, latMax: 19.070, lngMin: 72.836, lngMax: 72.860 },
      { name: 'Santacruz / Vile Parle', latMin: 19.072, latMax: 19.100, lngMin: 72.838, lngMax: 72.865 },
      { name: 'Andheri East / Kurla',   latMin: 19.108, latMax: 19.138, lngMin: 72.851, lngMax: 72.886 },
      { name: 'Powai / Ghatkopar',      latMin: 19.118, latMax: 19.148, lngMin: 72.893, lngMax: 72.928 },
      { name: 'Goregaon / Malad',       latMin: 19.158, latMax: 19.188, lngMin: 72.840, lngMax: 72.870 },
      { name: 'Kandivali / Borivali',   latMin: 19.200, latMax: 19.232, lngMin: 72.844, lngMax: 72.872 },
      { name: 'Dahisar / Mira Road',    latMin: 19.238, latMax: 19.262, lngMin: 72.848, lngMax: 72.876 },
    ];

    // Deterministic jitter: use the attendant's DB id as a pseudo-seed so
    // positions don't jump on every refresh, while still looking natural.
    const jitter = (min, max, seed) => {
      const t = ((seed * 9301 + 49297) % 233280) / 233280; // LCG [0,1)
      return parseFloat((min + t * (max - min)).toFixed(6));
    };

    const withLocation = rows.map((a, i) => {
      const zone = MUMBAI_ZONES[i % MUMBAI_ZONES.length];
      // Second jitter seed offset by total count so lat & lng differ
      const latSeed = (a.id * 7 + i * 13) % 10000;
      const lngSeed = (a.id * 11 + i * 17) % 10000;
      return {
        ...a,
        lat: jitter(zone.latMin, zone.latMax, latSeed),
        lng: jitter(zone.lngMin, zone.lngMax, lngSeed),
        zone: zone.name,
        status: i % 3 === 0 ? 'responding' : i % 3 === 1 ? 'available' : 'returning',
        last_seen: new Date(Date.now() - ((a.id * 6271 + i * 3491) % 300000)).toISOString(),
      };
    });

    return res.json({ attendants: withLocation });
  } catch (err) {
    console.error('[admin] attendants error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// GET /admin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.hospital_id, h.name as hospital_name, u.username as admin_name, a.resource_type, a.previous_qty, a.new_qty, a.action, a.created_at
       FROM resource_audit_logs a
       JOIN hospitals h ON h.id = a.hospital_id
       LEFT JOIN admin_users u ON u.id = a.admin_id
       ORDER BY a.created_at DESC
       LIMIT 200`
    );
    return res.json({ logs: rows });
  } catch (err) {
    console.error('[admin] audit-logs error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
