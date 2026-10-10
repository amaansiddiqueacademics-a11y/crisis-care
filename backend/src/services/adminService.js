import pool from "../config/db.js";
import { connectedClients } from "../realtime/socket.js";

/**
 * Measure a trivial query plus a PostGIS call so the UI shows real latency, not a constant.
 */
export const getSystemHealth = async () => {
  const started = process.hrtime.bigint();
  const { rows } = await pool.query(
    "SELECT PostGIS_Version() AS postgis, ST_Distance('POINT(0 0)'::geography, 'POINT(0 1)'::geography) AS probe"
  );
  const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;

  return {
    status: "healthy",
    database: "up",
    postgis: rows[0].postgis.split(" ")[0],
    dbLatencyMs: Math.round(latencyMs * 10) / 10,
    uptimeSeconds: Math.round(process.uptime()),
    connectedClients: connectedClients(),
    timestamp: new Date().toISOString()
  };
};

/**
 * Aggregates for the public command-center dashboard, all computed from stored emergencies.
 */
export const getPublicStats = async () => {
  const [totals, hourly, byType, response] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM emergency_requests
          WHERE created_at > NOW() - INTERVAL '24 hours') AS last24h,
        (SELECT COUNT(*)::int FROM emergency_requests
          WHERE status NOT IN ('CLOSED', 'CANCELLED')) AS active,
        (SELECT COUNT(*)::int FROM emergency_requests) AS total,
        (SELECT COUNT(*)::int FROM ambulances WHERE status = 'AVAILABLE') AS ambulances_available,
        (SELECT COUNT(*)::int FROM ambulances WHERE status <> 'OFFLINE') AS ambulances_online,
        (SELECT COUNT(*)::int FROM hospitals WHERE status = 'ACTIVE') AS hospitals
    `),
    pool.query(`
      SELECT to_char(h, 'HH24') AS hour, COUNT(e.request_id)::int AS count
      FROM generate_series(
             date_trunc('hour', NOW()) - INTERVAL '23 hours', date_trunc('hour', NOW()),
             INTERVAL '1 hour') AS h
      LEFT JOIN emergency_requests e ON date_trunc('hour', e.created_at) = h
      GROUP BY h ORDER BY h
    `),
    pool.query(`
      SELECT emergency_type AS name, COUNT(*)::int AS count
      FROM emergency_requests
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY emergency_type ORDER BY count DESC LIMIT 5
    `),
    pool.query(`
      SELECT COUNT(*)::int AS samples,
             ROUND(AVG(EXTRACT(EPOCH FROM (r.responded_at - e.created_at)) / 60)::numeric, 1)
               AS avg_minutes
      FROM hospital_emergency_responses r
      JOIN emergency_requests e ON e.request_id = r.request_id
      WHERE r.status = 'ACCEPTED' AND e.created_at > NOW() - INTERVAL '30 days'
    `)
  ]);

  const t = totals.rows[0];

  return {
    emergenciesLast24h: t.last24h,
    activeEmergencies: t.active,
    totalEmergencies: t.total,
    ambulancesAvailable: t.ambulances_available,
    ambulancesOnline: t.ambulances_online,
    hospitals: t.hospitals,
    hourly: hourly.rows,
    byType: byType.rows,
    reportToHospitalAcceptance: {
      samples: response.rows[0].samples,
      avgMinutes:
        response.rows[0].samples > 0 ? Number(response.rows[0].avg_minutes) : null
    }
  };
};

export const getAdminOverview = async () => {
  const [health, stats, recent] = await Promise.all([
    getSystemHealth(),
    getPublicStats(),
    pool.query(`
      SELECT e.emergency_code, e.emergency_type, e.status, e.created_at, e.location_text,
             a.callsign, h.name AS hospital_name
      FROM emergency_requests e
      LEFT JOIN ambulances a ON a.ambulance_id = e.ambulance_id
      LEFT JOIN hospitals h ON h.hospital_id = e.selected_hospital_id
      ORDER BY e.created_at DESC LIMIT 15
    `)
  ]);

  return {
    health,
    stats,
    recentEmergencies: recent.rows.map((e) => ({
      code: e.emergency_code,
      type: e.emergency_type,
      status: e.status,
      createdAt: e.created_at,
      locationText: e.location_text,
      ambulance: e.callsign,
      hospital: e.hospital_name
    }))
  };
};

const AUDIT_SELECT = `
  SELECT a.audit_id, a.created_at, a.actor_name, a.actor_role, a.action, a.entity_type,
         a.old_values, a.new_values, a.hospital_id, h.name AS hospital_name
  FROM audit_logs a
  LEFT JOIN hospitals h ON h.hospital_id = a.hospital_id
  WHERE ($1::bigint IS NULL OR a.hospital_id = $1)
    AND ($2::text IS NULL
         OR a.action ILIKE $2 OR a.actor_name ILIKE $2 OR h.name ILIKE $2
         OR a.new_values->>'resource' ILIKE $2)
  ORDER BY a.created_at DESC, a.audit_id DESC
  LIMIT $3
`;

export const listAuditLogs = async ({ hospitalId, search, limit = 200 }) => {
  const escaped = search ? `%${search.replace(/[%_\\]/g, "\\$&")}%` : null;
  const { rows } = await pool.query(AUDIT_SELECT, [hospitalId || null, escaped, limit]);

  return rows.map((r) => ({
    id: r.audit_id,
    createdAt: r.created_at,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    action: r.action,
    entityType: r.entity_type,
    resource: r.new_values?.resource ?? r.old_values?.resource ?? r.entity_type,
    previous: r.old_values,
    next: r.new_values,
    hospitalId: r.hospital_id,
    hospitalName: r.hospital_name
  }));
};

const describeValue = (v) =>
  v == null ? "" : v.quantity !== undefined ? String(v.quantity) : (v.status ?? "");

// Prefix cells that spreadsheets would treat as formulas.
const csvCell = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportAuditCsv = async (filters) => {
  const logs = await listAuditLogs({ ...filters, limit: 5000 });
  const header = ["id", "timestamp", "hospital", "actor", "role", "resource", "previous", "new", "action"];

  const lines = logs.map((l) =>
    [
      l.id,
      new Date(l.createdAt).toISOString(),
      l.hospitalName,
      l.actorName,
      l.actorRole,
      l.resource,
      describeValue(l.previous),
      describeValue(l.next),
      l.action
    ]
      .map(csvCell)
      .join(",")
  );

  return [header.join(","), ...lines].join("\r\n");
};
