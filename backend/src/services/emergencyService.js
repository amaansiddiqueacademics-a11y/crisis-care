import crypto from "node:crypto";

import pool, { withTransaction } from "../config/db.js";
import { config } from "../config/env.js";
import { badRequest, conflict, notFound } from "../utils/AppError.js";
import { etaMinutes, isValidCoordinate, metersToKm } from "../utils/geo.js";
import { buildEta, buildNavigation, gpsState, PHASES } from "../utils/tracking.js";
import { notifyAudit, notifyEmergency, notifyInventory } from "../realtime/socket.js";
import { releaseIcuBed } from "./inventoryService.js";
import { recordAudit } from "./auditService.js";
import { assessFit, computeTriage, reportPriority, requirementsFor } from "./matching.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateCode = () => {
  const bytes = crypto.randomBytes(8);
  let suffix = "";
  for (const b of bytes) suffix += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `CC-${suffix}`;
};

const SYSTEM_ACTOR = { actorName: "System", actorRole: "SYSTEM" };

const OPEN_STATUSES = [
  "SEARCHING",
  "AMBULANCE_ASSIGNED",
  "AT_SCENE",
  "HOSPITAL_PENDING",
  "HOSPITAL_ACCEPTED",
  "HOSPITAL_DECLINED",
  "TRANSPORTING",
  "ARRIVED"
];

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const statusStep = (e, hasAssessment) => {
  if (["SEARCHING", "REPORTED"].includes(e.status)) return 1;
  if (e.selected_hospital_id) return 4;
  if (hasAssessment || e.status === "AT_SCENE") return 3;
  return 2;
};

const toPatient = (p, withContact) =>
  p
    ? {
        fullName: p.full_name,
        ageGroup: p.age_group,
        sex: p.sex,
        bloodGroup: p.blood_group,
        knownConditions: p.known_conditions,
        allergies: p.allergies,
        medications: p.medications,
        ...(withContact
          ? { emergencyContactName: p.emergency_contact_name, emergencyContactPhone: p.emergency_contact_phone }
          : {}),
        updatedByRole: p.updated_by_role
      }
    : null;

/**
 * Build the JSON view of an emergency.
 *   forCrew   adds caller and emergency-contact phone numbers (assigned crew, dispatch)
 *   clinical  adds the photo, patient profile and what the patient needs (crew, hospital, dispatch)
 * The public tracking page gets neither.
 */
export const getEmergencyView = async (db, where, value, { forCrew = false, clinical = forCrew } = {}) => {
  const { rows } = await db.query(
    `
    SELECT e.*,
           a.callsign, a.status AS ambulance_status, a.latitude AS amb_lat, a.longitude AS amb_lng,
           a.last_location_update AS amb_gps_at,
           EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.last_location_update)) AS amb_gps_age,
           ST_Distance(a.location, e.location) AS amb_dist,
           ST_Distance(a.location, h.location) AS amb_h_dist,
           h.name AS h_name, h.address AS h_address, h.phone AS h_phone,
           h.latitude AS h_lat, h.longitude AS h_lng,
           ST_Distance(h.location, e.location) AS h_dist,
           (SELECT c.full_name FROM ambulance_crew c
             WHERE c.ambulance_id = e.ambulance_id
             ORDER BY (c.role = 'PARAMEDIC') DESC, c.crew_id LIMIT 1) AS paramedic_name,
           r.status AS response_status, r.reason AS response_reason
    FROM emergency_requests e
    LEFT JOIN ambulances a ON a.ambulance_id = e.ambulance_id
    LEFT JOIN hospitals h ON h.hospital_id = e.selected_hospital_id
    LEFT JOIN hospital_emergency_responses r
           ON r.request_id = e.request_id AND r.hospital_id = e.selected_hospital_id
    WHERE ${where}
    `,
    [value]
  );

  const e = rows[0];

  if (!e) return null;

  const [vitals, surgeon, declined, patientRows] = await Promise.all([
    db.query(
      "SELECT * FROM patient_vitals WHERE request_id = $1 ORDER BY recorded_at DESC LIMIT 1",
      [e.request_id]
    ),
    e.selected_hospital_id
      ? db.query(
          `SELECT s.full_name, s.specialization, hs.status
           FROM hospital_surgeons hs JOIN surgeons s ON s.surgeon_id = hs.surgeon_id
           WHERE hs.hospital_id = $1 ORDER BY hs.updated_at DESC LIMIT 1`,
          [e.selected_hospital_id]
        )
      : { rows: [] },
    db.query(
      `SELECT h.hospital_id, h.name, r.reason
       FROM hospital_emergency_responses r JOIN hospitals h ON h.hospital_id = r.hospital_id
       WHERE r.request_id = $1 AND r.status = 'DECLINED' ORDER BY r.responded_at`,
      [e.request_id]
    ),
    db.query("SELECT * FROM patients WHERE request_id = $1", [e.request_id])
  ]);

  const patient = patientRows.rows[0];

  const v = vitals.rows[0];
  const s = surgeon.rows[0];
  const isOpen = OPEN_STATUSES.includes(e.status);
  const hospitalAccepted = e.response_status === "ACCEPTED";

  // Live tracking only makes sense while the call is open; a finished call keeps the unit's name
  // but not its (now unrelated) position.
  const phase = isOpen && e.ambulance_id ? PHASES[e.ambulance_status] ?? null : null;
  const gps = gpsState({
    lat: e.amb_lat,
    lng: e.amb_lng,
    lastUpdate: e.amb_gps_at,
    ageSeconds: e.amb_gps_age == null ? null : Number(e.amb_gps_age)
  });
  const shownPosition = isOpen && gps !== "INVALID" && e.amb_lat != null;
  const eta = buildEta({
    phase,
    gps,
    ageSeconds: Number(e.amb_gps_age),
    distanceM: phase === "TO_HOSPITAL" ? e.amb_h_dist : e.amb_dist
  });
  const navigation = buildNavigation({
    phase,
    patient: { lat: e.latitude, lng: e.longitude },
    hospital: e.selected_hospital_id ? { name: e.h_name, lat: e.h_lat, lng: e.h_lng } : null,
    hospitalAccepted
  });

  return {
    id: e.request_id,
    code: e.emergency_code,
    type: e.emergency_type,
    description: e.description,
    patientCount: e.patient_count,
    locationText: e.location_text,
    lat: e.latitude,
    lng: e.longitude,
    status: e.status,
    statusStep: statusStep(e, Boolean(v)),
    isOpen,
    priority: e.priority,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    closedAt: e.closed_at,
    report: {
      problemKind: e.problem_kind,
      bodyArea: e.body_area,
      symptoms: e.symptoms || [],
      painLevel: e.pain_level,
      reporterRelation: e.reporter_relation,
      hasPhoto: Boolean(e.photo_data)
    },
    ...(forCrew ? { callerName: e.caller_name, callerPhone: e.caller_phone } : {}),
    ...(clinical
      ? {
          photo: e.photo_data,
          patient: toPatient(patient, forCrew),
          needs: requirementsFor({
            type: e.emergency_type,
            assessment: v ? { consciousness: v.consciousness, breathing: v.breathing, severeBleeding: v.severe_bleeding } : null,
            patient: patient ? { ageGroup: patient.age_group, knownConditions: patient.known_conditions } : null
          }).map((r) => r.label)
        }
      : {}),
    ambulance: e.ambulance_id
      ? {
          id: e.ambulance_id,
          callsign: e.callsign,
          paramedicName: e.paramedic_name,
          status: isOpen ? e.ambulance_status : null,
          phase,
          lat: shownPosition ? e.amb_lat : null,
          lng: shownPosition ? e.amb_lng : null,
          gps: {
            state: isOpen ? gps : "NONE",
            lastUpdate: e.amb_gps_at,
            ageSeconds: e.amb_gps_age == null ? null : Math.round(Number(e.amb_gps_age))
          },
          distanceKm: shownPosition ? metersToKm(e.amb_dist) : null,
          eta,
          etaMinutes: eta.minutes
        }
      : null,
    navigation,
    assessment: v
      ? {
          consciousness: v.consciousness,
          breathing: v.breathing,
          pulseStatus: v.pulse_status,
          severeBleeding: v.severe_bleeding,
          heartRate: v.heart_rate,
          spo2: v.spo2,
          systolicBp: v.systolic_bp,
          diastolicBp: v.diastolic_bp,
          notes: v.notes,
          findings: v.category_findings,
          triage: v.triage_level,
          recordedAt: v.recorded_at
        }
      : null,
    hospital: e.selected_hospital_id
      ? {
          id: e.selected_hospital_id,
          name: e.h_name,
          address: e.h_address,
          phone: e.h_phone,
          lat: e.h_lat,
          lng: e.h_lng,
          distanceKm: metersToKm(e.h_dist),
          etaMinutes: etaMinutes(e.h_dist),
          response: e.response_status?.toLowerCase() ?? null,
          declineReason: e.response_status === "DECLINED" ? e.response_reason : null,
          surgeon: s
            ? {
                name: s.full_name,
                specialization: s.specialization,
                available: s.status === "AVAILABLE"
              }
            : null
        }
      : null,
    declinedHospitals: declined.rows.map((d) => ({
      id: d.hospital_id,
      name: d.name,
      reason: d.reason
    }))
  };
};

export const getEmergencyByCode = async (code, options) =>
  getEmergencyView(pool, "e.emergency_code = $1", code, options);

/**
 * Tell every interested room that an emergency changed (call after commit).
 */
export const publishEmergency = async (requestId) => {
  const { rows } = await pool.query(
    `
    SELECT e.emergency_code, e.ambulance_id,
           COALESCE(array_agg(r.hospital_id) FILTER (WHERE r.hospital_id IS NOT NULL), '{}')
             AS hospital_ids
    FROM emergency_requests e
    LEFT JOIN hospital_emergency_responses r ON r.request_id = e.request_id
    WHERE e.request_id = $1
    GROUP BY e.request_id
    `,
    [requestId]
  );

  if (rows[0]) {
    notifyEmergency({
      code: rows[0].emergency_code,
      ambulanceId: rows[0].ambulance_id,
      hospitalIds: rows[0].hospital_ids.map(Number)
    });
  }
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Assign the nearest AVAILABLE ambulance (PostGIS) to an emergency that is still SEARCHING.
 * Returns the ambulance id, or null when none is within range.
 */
const assignNearestAmbulance = async (client, emergency) => {
  const { rows } = await client.query(
    `
    SELECT ambulance_id
    FROM ambulances
    WHERE status = 'AVAILABLE'
      AND current_emergency_id IS NULL
      AND location IS NOT NULL
      AND ST_DWithin(location, $1::geography, $2)
    -- Urgent calls prefer an Advanced Life Support unit unless a basic one is much closer.
    ORDER BY ST_Distance(location, $1::geography)
             * CASE WHEN $3 = 'URGENT' AND ambulance_type = 'BLS' THEN 1.5 ELSE 1 END
    LIMIT 1
    FOR UPDATE SKIP LOCKED
    `,
    [emergency.location, config.dispatchRadiusKm * 1000, emergency.priority || "STANDARD"]
  );

  const ambulanceId = rows[0]?.ambulance_id;

  if (!ambulanceId) return null;

  await client.query(
    "UPDATE ambulances SET status = 'DISPATCHED', current_emergency_id = $2 WHERE ambulance_id = $1",
    [ambulanceId, emergency.request_id]
  );

  await client.query(
    "UPDATE emergency_requests SET status = 'AMBULANCE_ASSIGNED', ambulance_id = $2 WHERE request_id = $1",
    [emergency.request_id, ambulanceId]
  );

  return ambulanceId;
};

/**
 * Ambulances around an open emergency for the citizen's map: the assigned unit plus the nearest free
 * ones, with straight-line estimates from their last known (or base-station) position. Public data
 * only: call sign, type and position, never crew names.
 */
export const listNearbyUnits = async (code) => {
  const { rows } = await pool.query(
    `
    SELECT a.ambulance_id, a.callsign, a.ambulance_type, a.status, a.latitude, a.longitude,
           a.last_location_update, COALESCE(a.current_emergency_id = e.request_id, false) AS assigned,
           ST_Distance(a.location, e.location) AS dist
    FROM emergency_requests e
    JOIN ambulances a ON a.location IS NOT NULL
      AND (a.current_emergency_id = e.request_id
           OR (a.status = 'AVAILABLE' AND ST_DWithin(a.location, e.location, $2)))
    WHERE e.emergency_code = $1 AND e.status = ANY($3)
    ORDER BY assigned DESC, dist
    LIMIT 6
    `,
    [code, config.dispatchRadiusKm * 1000, OPEN_STATUSES]
  );

  return rows.map((a) => ({
    id: a.ambulance_id,
    callsign: a.callsign,
    type: a.ambulance_type,
    status: a.status,
    lat: a.latitude,
    lng: a.longitude,
    assigned: Boolean(a.assigned),
    liveGps: a.last_location_update != null,
    distanceKm: metersToKm(a.dist),
    etaMinutes: etaMinutes(a.dist)
  }));
};

/**
 * Try to dispatch every SEARCHING emergency (oldest first). Call whenever an ambulance frees up.
 */
export const dispatchPending = async () => {
  const assigned = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT request_id, location, priority FROM emergency_requests
       WHERE status = 'SEARCHING' ORDER BY (priority = 'URGENT') DESC, created_at
       FOR UPDATE SKIP LOCKED`
    );

    const done = [];

    for (const emergency of rows) {
      if (await assignNearestAmbulance(client, emergency)) done.push(emergency.request_id);
    }

    return done;
  });

  await Promise.all(assigned.map(publishEmergency));
};

// ---------------------------------------------------------------------------
// Citizen operations
// ---------------------------------------------------------------------------

const savePatient = async (client, requestId, p, role) => {
  await client.query(
    `
    INSERT INTO patients
      (request_id, full_name, age_group, sex, blood_group, known_conditions, allergies,
       medications, emergency_contact_name, emergency_contact_phone, updated_by_role)
    VALUES ($1, $2, $3, $4, $5, COALESCE($6::text[], '{}'), COALESCE($7::text[], '{}'), $8, $9, $10, $11)
    ON CONFLICT (request_id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, patients.full_name),
      age_group = COALESCE(EXCLUDED.age_group, patients.age_group),
      sex = COALESCE(EXCLUDED.sex, patients.sex),
      blood_group = COALESCE(EXCLUDED.blood_group, patients.blood_group),
      known_conditions = COALESCE($6::text[], patients.known_conditions),
      allergies = COALESCE($7::text[], patients.allergies),
      medications = COALESCE(EXCLUDED.medications, patients.medications),
      emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, patients.emergency_contact_name),
      emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, patients.emergency_contact_phone),
      updated_by_role = EXCLUDED.updated_by_role
    `,
    [
      requestId,
      p.fullName || null,
      p.ageGroup || null,
      p.sex || null,
      p.bloodGroup || null,
      p.knownConditions ?? null,
      p.allergies ?? null,
      p.medications || null,
      p.emergencyContactName || null,
      p.emergencyContactPhone || null,
      role
    ]
  );
};

export const createEmergency = async (input) => {
  const priority = reportPriority(input);

  const requestId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `
      INSERT INTO emergency_requests
        (emergency_code, latitude, longitude, location, emergency_type, patient_count,
         description, caller_name, caller_phone, location_text, status,
         problem_kind, body_area, symptoms, pain_level, photo_data, reporter_relation, priority)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
              $4, $5, $6, $7, $8, $9, 'SEARCHING', $10, $11, $12, $13, $14, $15, $16)
      RETURNING request_id, location, priority
      `,
      [
        generateCode(),
        input.lat,
        input.lng,
        input.type,
        input.patientCount,
        input.description || null,
        input.callerName || null,
        input.callerPhone || null,
        input.locationText || null,
        input.problemKind || null,
        input.bodyArea || null,
        input.symptoms?.length ? input.symptoms : null,
        input.painLevel ?? null,
        input.photo || null,
        input.reporterRelation || null,
        priority
      ]
    );

    if (input.patient && Object.values(input.patient).some((x) => x && x.length !== 0)) {
      await savePatient(client, rows[0].request_id, input.patient, "REPORTER");
    }

    await assignNearestAmbulance(client, rows[0]);

    return rows[0].request_id;
  });

  await publishEmergency(requestId);
  notifyAudit();

  return getEmergencyView(pool, "e.request_id = $1", requestId);
};

/**
 * Close out an emergency: free its ambulance and release/consume any ICU reservation.
 * Returns the hospitals whose stock changed, so the caller can tell them after commit.
 */
const finishEmergency = async (client, emergency, finalStatus, actor) => {
  const { rows } = await client.query(
    `SELECT hospital_id FROM hospital_emergency_responses
     WHERE request_id = $1 AND status = 'ACCEPTED' AND icu_reserved`,
    [emergency.request_id]
  );

  for (const { hospital_id: hospitalId } of rows) {
    await releaseIcuBed(client, hospitalId, actor, emergency.emergency_code, {
      consume: finalStatus === "CLOSED"
    });
  }

  await client.query(
    "UPDATE emergency_requests SET status = $2, closed_at = CURRENT_TIMESTAMP WHERE request_id = $1",
    [emergency.request_id, finalStatus]
  );

  // Only a unit that is still bound to THIS call is released, and only back to AVAILABLE when it
  // was busy with the call. A unit that was meanwhile taken off duty keeps that status.
  if (emergency.ambulance_id) {
    await client.query(
      `UPDATE ambulances
       SET current_emergency_id = NULL,
           status = CASE WHEN status IN ('DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'AT_HOSPITAL')
                         THEN 'AVAILABLE' ELSE status END
       WHERE ambulance_id = $1 AND current_emergency_id = $2`,
      [emergency.ambulance_id, emergency.request_id]
    );
  }

  return rows.map((r) => Number(r.hospital_id));
};

/** Cancellation is allowed until transport starts. Each refusal says why and what to do. */
const assertCancellable = (emergency) => {
  if (emergency.status === "CANCELLED") throw conflict("This emergency was already cancelled.");
  if (emergency.status === "CLOSED") throw conflict("This emergency is already completed.");
  if (["TRANSPORTING", "ARRIVED"].includes(emergency.status)) {
    throw conflict(
      "The patient is already on the way to the hospital, so the request can no longer be cancelled here. Tell the crew, or call 108."
    );
  }
};

export const cancelEmergency = async (code) => {
  const { requestId, hospitalIds } = await withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM emergency_requests WHERE emergency_code = $1 FOR UPDATE",
      [code]
    );

    const emergency = rows[0];

    if (!emergency) throw notFound("Emergency not found");

    assertCancellable(emergency);

    const actor = { ...SYSTEM_ACTOR, actorName: "Citizen (cancelled)" };
    const released = await finishEmergency(client, emergency, "CANCELLED", actor);

    await recordAudit(client, {
      ...actor,
      action: `Citizen cancelled ${code} (status was ${emergency.status})`,
      entityType: "emergency_requests",
      entityId: emergency.request_id
    });

    return { requestId: emergency.request_id, hospitalIds: released };
  });

  await publishEmergency(requestId);
  hospitalIds.forEach(notifyInventory);
  notifyAudit();
  await dispatchPending();

  return getEmergencyView(pool, "e.request_id = $1", requestId);
};

// ---------------------------------------------------------------------------
// Ambulance crew operations
// ---------------------------------------------------------------------------

export const getAmbulanceOverview = async (ambulanceId) => {
  const { rows } = await pool.query(
    `SELECT ambulance_id, callsign, registration_number, ambulance_type, status,
            latitude, longitude, current_emergency_id, last_location_update
     FROM ambulances WHERE ambulance_id = $1`,
    [ambulanceId]
  );

  const a = rows[0];

  if (!a) throw notFound("Ambulance not found");

  const emergency = a.current_emergency_id
    ? await getEmergencyView(pool, "e.request_id = $1", a.current_emergency_id, {
        forCrew: true
      })
    : null;

  return {
    ambulance: {
      id: a.ambulance_id,
      callsign: a.callsign,
      registration: a.registration_number,
      type: a.ambulance_type,
      status: a.status,
      lat: a.latitude,
      lng: a.longitude,
      lastLocationUpdate: a.last_location_update
    },
    emergency
  };
};

export const updateAmbulanceLocation = async (ambulanceId, lat, lng) => {
  // (0, 0) is what many devices report when they have no fix: never store it as a position.
  if (!isValidCoordinate(lat, lng)) throw badRequest("That is not a valid GPS position");

  const { rows } = await pool.query(
    `UPDATE ambulances
     SET latitude = $2, longitude = $3,
         location = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
         last_location_update = CURRENT_TIMESTAMP
     WHERE ambulance_id = $1
     RETURNING current_emergency_id`,
    [ambulanceId, lat, lng]
  );

  if (rows[0]?.current_emergency_id) await publishEmergency(rows[0].current_emergency_id);
};

export const setAmbulanceAvailability = async (ambulanceId, status) => {
  const { rows } = await pool.query(
    `UPDATE ambulances SET status = $2
     WHERE ambulance_id = $1 AND current_emergency_id IS NULL
     RETURNING ambulance_id`,
    [ambulanceId, status]
  );

  if (rows.length === 0) {
    throw conflict("Cannot change availability while handling an emergency");
  }

  if (status === "AVAILABLE") await dispatchPending();
};

/** Lock and return the emergency currently assigned to this ambulance. */
const lockActiveEmergency = async (client, ambulanceId) => {
  const { rows } = await client.query(
    `SELECT e.* FROM emergency_requests e
     JOIN ambulances a ON a.current_emergency_id = e.request_id
     WHERE a.ambulance_id = $1 FOR UPDATE OF e`,
    [ambulanceId]
  );

  if (!rows[0]) throw conflict("This ambulance has no active emergency");

  return rows[0];
};

export const saveAssessment = async (ambulanceId, crewId, input) => {
  const requestId = await withTransaction(async (client) => {
    const emergency = await lockActiveEmergency(client, ambulanceId);

    const triage = computeTriage(emergency.emergency_type, input);

    await client.query(
      `INSERT INTO patient_vitals
         (request_id, ambulance_id, recorded_by, consciousness, breathing, pulse_status,
          severe_bleeding, heart_rate, spo2, systolic_bp, diastolic_bp, notes,
          category_findings, triage_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        emergency.request_id,
        ambulanceId,
        crewId,
        input.consciousness,
        input.breathing,
        input.pulseStatus,
        input.severeBleeding,
        input.heartRate ?? null,
        input.spo2 ?? null,
        input.systolicBp ?? null,
        input.diastolicBp ?? null,
        input.notes || null,
        JSON.stringify({ ...(input.categoryFindings || {}), triageReasons: triage.reasons }),
        triage.level
      ]
    );

    if (triage.level === "RED") {
      await client.query("UPDATE emergency_requests SET priority = 'URGENT' WHERE request_id = $1", [
        emergency.request_id
      ]);
    }

    return emergency.request_id;
  });

  await publishEmergency(requestId);
};

/**
 * Hospitals near the incident, ranked for THIS patient: hospitals with everything the patient
 * needs and an open emergency room first, then by travel time. Each row says what matches,
 * what is missing and why, so the crew can overrule the ranking with their own judgement.
 */
export const listNearbyHospitals = async (ambulanceId) => {
  const { rows: active } = await pool.query(
    `SELECT e.request_id, e.location, e.emergency_type FROM emergency_requests e
     JOIN ambulances a ON a.current_emergency_id = e.request_id
     WHERE a.ambulance_id = $1`,
    [ambulanceId]
  );

  if (!active[0]) throw conflict("This ambulance has no active emergency");

  const [{ rows }, view] = await Promise.all([
    pool.query(
      `
      SELECT h.hospital_id, h.name, h.city, h.zone, h.ownership, h.address, h.phone,
             h.latitude, h.longitude, h.er_status, h.er_status_note,
             ST_Distance(h.location, $1::geography) AS dist,
             r.status AS response_status, r.reason AS response_reason,
             COALESCE((SELECT jsonb_object_agg(rs.resource_code, hi.quantity - hi.reserved_quantity)
                       FROM hospital_inventory hi JOIN resources rs USING (resource_id)
                       WHERE hi.hospital_id = h.hospital_id), '{}') AS available,
             (SELECT bool_or(hi.source = 'HOSPITAL_REPORTED') FROM hospital_inventory hi
               WHERE hi.hospital_id = h.hospital_id) AS confirmed,
             COALESCE((SELECT array_agg(service_code::text) FROM hospital_services hs
                       WHERE hs.hospital_id = h.hospital_id AND hs.available), '{}') AS services
      FROM hospitals h
      LEFT JOIN hospital_emergency_responses r
             ON r.hospital_id = h.hospital_id AND r.request_id = $2
      WHERE h.status = 'ACTIVE'
        AND ST_DWithin(h.location, $1::geography, $3)
      ORDER BY dist
      LIMIT 25
      `,
      [active[0].location, active[0].request_id, config.hospitalSearchRadiusKm * 1000]
    ),
    getEmergencyView(pool, "e.request_id = $1", active[0].request_id, { clinical: true })
  ]);

  const requirements = requirementsFor({
    type: active[0].emergency_type,
    assessment: view.assessment,
    patient: view.patient
  });

  const ranked = rows.map((h) => {
    const fit = assessFit(requirements, {
      services: h.services,
      available: h.available,
      erStatus: h.er_status,
      erStatusNote: h.er_status_note,
      inventoryConfirmed: Boolean(h.confirmed)
    });

    return {
      id: h.hospital_id,
      name: h.name,
      city: h.city,
      zone: h.zone,
      ownership: h.ownership,
      address: h.address,
      phone: h.phone,
      lat: h.latitude,
      lng: h.longitude,
      distanceKm: metersToKm(h.dist),
      etaMinutes: etaMinutes(h.dist),
      erStatus: h.er_status,
      icuFree: h.available.ICU_BED ?? 0,
      fit,
      response: h.response_status?.toLowerCase() ?? null,
      declineReason: h.response_status === "DECLINED" ? h.response_reason : null
    };
  });

  const order = (h) => [
    h.response === "declined" ? 1 : 0,
    h.erStatus === "DIVERSION" ? 1 : 0,
    h.fit.missing.length,
    // Limited intake costs about 15 minutes of travel: a limited hospital next door still
    // beats a fully open one an hour away.
    h.etaMinutes + (h.erStatus === "LIMITED" ? 15 : 0)
  ];

  ranked.sort((a, b) => {
    const x = order(a);
    const y = order(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  });

  const best = ranked.find((h) => h.fit.fits && h.response !== "declined");
  const nearest = ranked.reduce((n, h) => (!n || h.etaMinutes < n.etaMinutes ? h : n), null);

  return ranked.slice(0, 10).map((h) => ({
    ...h,
    recommended: h === best,
    nearest: h === nearest,
    extraMinutes: nearest ? h.etaMinutes - nearest.etaMinutes : 0
  }));
};

/** Crew corrects or completes the patient's details on scene. */
export const updatePatientByCrew = async (ambulanceId, input) => {
  const requestId = await withTransaction(async (client) => {
    const emergency = await lockActiveEmergency(client, ambulanceId);
    await savePatient(client, emergency.request_id, input, "CREW");
    return emergency.request_id;
  });

  await publishEmergency(requestId);
};

export const selectHospital = async (ambulanceId, hospitalId) => {
  const requestId = await withTransaction(async (client) => {
    const emergency = await lockActiveEmergency(client, ambulanceId);

    if (["TRANSPORTING", "ARRIVED"].includes(emergency.status)) {
      throw conflict("Transport already under way; the destination can no longer change");
    }

    const { rows: hospitals } = await client.query(
      `SELECT hospital_id FROM hospitals
       WHERE hospital_id = $1 AND status = 'ACTIVE' AND ST_DWithin(location, $2::geography, $3)`,
      [hospitalId, emergency.location, config.hospitalSearchRadiusKm * 1000]
    );

    if (hospitals.length === 0) {
      throw badRequest("Hospital is not available for this emergency");
    }

    const { rows: existing } = await client.query(
      "SELECT status FROM hospital_emergency_responses WHERE request_id = $1 AND hospital_id = $2",
      [emergency.request_id, hospitalId]
    );

    if (existing[0]?.status === "DECLINED") {
      throw conflict("This hospital already declined the request. Choose another hospital.");
    }

    if (
      emergency.status === "HOSPITAL_ACCEPTED" &&
      emergency.selected_hospital_id !== hospitalId
    ) {
      throw conflict("A hospital has already accepted this emergency");
    }

    // Withdraw any other still-pending query so only one hospital is asked at a time.
    await client.query(
      `DELETE FROM hospital_emergency_responses
       WHERE request_id = $1 AND status = 'PENDING' AND hospital_id <> $2`,
      [emergency.request_id, hospitalId]
    );

    if (!existing[0]) {
      await client.query(
        "INSERT INTO hospital_emergency_responses (request_id, hospital_id) VALUES ($1, $2)",
        [emergency.request_id, hospitalId]
      );
    }

    await client.query(
      `UPDATE emergency_requests
       SET selected_hospital_id = $2,
           status = CASE WHEN status = 'HOSPITAL_ACCEPTED' THEN status ELSE 'HOSPITAL_PENDING' END
       WHERE request_id = $1`,
      [emergency.request_id, hospitalId]
    );

    return emergency.request_id;
  });

  await publishEmergency(requestId);
};

const STAGES = {
  ARRIVE_SCENE: {
    from: ["AMBULANCE_ASSIGNED", "HOSPITAL_PENDING", "HOSPITAL_DECLINED", "HOSPITAL_ACCEPTED"],
    ambulanceFrom: "DISPATCHED",
    ambulanceTo: "AT_SCENE",
    emergencyTo: "AT_SCENE"
  },
  START_TRANSPORT: {
    from: ["HOSPITAL_ACCEPTED"],
    ambulanceFrom: "AT_SCENE",
    ambulanceTo: "TRANSPORTING",
    emergencyTo: "TRANSPORTING"
  },
  ARRIVE_HOSPITAL: {
    from: ["TRANSPORTING"],
    ambulanceFrom: "TRANSPORTING",
    ambulanceTo: "AT_HOSPITAL",
    emergencyTo: "ARRIVED"
  }
};

/**
 * Move the ambulance/emergency to the next physical stage.
 * `ARRIVE_SCENE` only changes the emergency status if no hospital decision exists yet,
 * so it never overwrites a pending/accepted hospital decision.
 */
export const advanceStage = async (ambulanceId, step, actor) => {
  const requestId = await withTransaction(async (client) => {
    const emergency = await lockActiveEmergency(client, ambulanceId);

    const { rows } = await client.query(
      "SELECT status FROM ambulances WHERE ambulance_id = $1",
      [ambulanceId]
    );
    const ambulanceStatus = rows[0].status;

    if (step === "HANDOVER") {
      if (emergency.status !== "ARRIVED") {
        throw conflict("Patient can only be handed over after arriving at the hospital");
      }

      await finishEmergency(client, emergency, "CLOSED", actor);
      return emergency.request_id;
    }

    const stage = STAGES[step];

    if (!stage) throw badRequest("Unknown stage");

    if (!stage.from.includes(emergency.status) || ambulanceStatus !== stage.ambulanceFrom) {
      throw conflict(
        step === "START_TRANSPORT"
          ? "A hospital must accept the emergency before transport can start"
          : "That step is not available right now"
      );
    }

    const keepStatus = step === "ARRIVE_SCENE" && emergency.status !== "AMBULANCE_ASSIGNED";

    await client.query("UPDATE emergency_requests SET status = $2 WHERE request_id = $1", [
      emergency.request_id,
      keepStatus ? emergency.status : stage.emergencyTo
    ]);
    await client.query("UPDATE ambulances SET status = $2 WHERE ambulance_id = $1", [
      ambulanceId,
      stage.ambulanceTo
    ]);

    return emergency.request_id;
  });

  await publishEmergency(requestId);

  if (step === "HANDOVER") {
    notifyAudit();
    await dispatchPending();
  }
};

// ---------------------------------------------------------------------------
// Dispatch control (admin)
// ---------------------------------------------------------------------------

/** Live board: open emergencies, every unit with its position, hospital pressure per zone. */
export const getDispatchBoard = async () => {
  const [open, fleet, zones] = await Promise.all([
    pool.query(
      `SELECT request_id FROM emergency_requests
       WHERE status NOT IN ('CLOSED', 'CANCELLED')
       ORDER BY (priority = 'URGENT') DESC, created_at`
    ),
    pool.query(`
      SELECT a.ambulance_id, a.callsign, a.ambulance_type, a.status, a.zone, a.latitude, a.longitude,
             a.last_location_update, e.emergency_code, e.emergency_type,
             (SELECT string_agg(c.full_name, ', ') FROM ambulance_crew c
               WHERE c.ambulance_id = a.ambulance_id) AS crew
      FROM ambulances a
      LEFT JOIN emergency_requests e ON e.request_id = a.current_emergency_id
      ORDER BY a.zone, a.callsign
    `),
    pool.query(`
      SELECT h.zone,
             COUNT(*)::int AS hospitals,
             COUNT(*) FILTER (WHERE h.er_status = 'ACCEPTING')::int AS accepting,
             COUNT(*) FILTER (WHERE h.er_status = 'LIMITED')::int AS limited,
             COUNT(*) FILTER (WHERE h.er_status = 'DIVERSION')::int AS diversion,
             COALESCE(SUM(hi.quantity - hi.reserved_quantity), 0)::int AS icu_free
      FROM hospitals h
      LEFT JOIN hospital_inventory hi ON hi.hospital_id = h.hospital_id
        AND hi.resource_id = (SELECT resource_id FROM resources WHERE resource_code = 'ICU_BED')
      WHERE h.status = 'ACTIVE'
      GROUP BY h.zone ORDER BY hospitals DESC
    `)
  ]);

  const emergencies = await Promise.all(
    open.rows.map((r) => getEmergencyView(pool, "e.request_id = $1", r.request_id, { forCrew: true }))
  );

  return {
    emergencies: emergencies.filter(Boolean).map((e) => ({
      ...e,
      waitingMinutes: Math.round((Date.now() - new Date(e.createdAt).getTime()) / 60000)
    })),
    ambulances: fleet.rows.map((a) => ({
      id: a.ambulance_id,
      callsign: a.callsign,
      type: a.ambulance_type,
      status: a.status,
      zone: a.zone,
      lat: a.latitude,
      lng: a.longitude,
      lastLocationUpdate: a.last_location_update,
      crew: a.crew,
      emergencyCode: a.emergency_code,
      emergencyType: a.emergency_type
    })),
    zones: zones.rows.map((z) => ({
      zone: z.zone,
      hospitals: z.hospitals,
      accepting: z.accepting,
      limited: z.limited,
      diversion: z.diversion,
      icuFree: z.icu_free
    }))
  };
};

/**
 * Dispatcher sends a specific unit (overriding the automatic choice). Allowed until the
 * crew reaches the scene; the previous unit is freed and picks up any queued call.
 */
export const dispatcherAssign = async (code, ambulanceId, actor) => {
  const requestId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM emergency_requests WHERE emergency_code = $1 FOR UPDATE",
      [code]
    );
    const emergency = rows[0];

    if (!emergency) throw notFound("Emergency not found");
    if (!["SEARCHING", "AMBULANCE_ASSIGNED"].includes(emergency.status)) {
      throw conflict("The crew is already on scene; the unit can no longer be changed");
    }

    const unit = await client.query(
      "SELECT ambulance_id, callsign, status FROM ambulances WHERE ambulance_id = $1 FOR UPDATE",
      [ambulanceId]
    );
    if (!unit.rows[0]) throw notFound("Ambulance not found");
    if (unit.rows[0].status !== "AVAILABLE") throw conflict(`${unit.rows[0].callsign} is not free`);

    if (emergency.ambulance_id) {
      await client.query(
        "UPDATE ambulances SET status = 'AVAILABLE', current_emergency_id = NULL WHERE ambulance_id = $1",
        [emergency.ambulance_id]
      );
    }

    await client.query(
      "UPDATE ambulances SET status = 'DISPATCHED', current_emergency_id = $2 WHERE ambulance_id = $1",
      [ambulanceId, emergency.request_id]
    );
    await client.query(
      "UPDATE emergency_requests SET status = 'AMBULANCE_ASSIGNED', ambulance_id = $2 WHERE request_id = $1",
      [emergency.request_id, ambulanceId]
    );

    await recordAudit(client, {
      ...actor,
      action: `Dispatcher assigned ${unit.rows[0].callsign} to ${code}`,
      entityType: "emergency_requests",
      entityId: emergency.request_id,
      newValues: { resource: "Ambulance", status: unit.rows[0].callsign }
    });

    return { requestId: emergency.request_id, previous: emergency.ambulance_id };
  });

  await publishEmergency(requestId.requestId);
  if (requestId.previous) {
    notifyEmergency({ code, ambulanceId: requestId.previous });
  }
  notifyAudit();
  await dispatchPending();
};

/** Dispatcher closes a call that needs no ambulance (duplicate, prank, patient left). */
export const dispatcherCancel = async (code, reason, actor) => {
  const { requestId, hospitalIds } = await withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM emergency_requests WHERE emergency_code = $1 FOR UPDATE",
      [code]
    );
    const emergency = rows[0];

    if (!emergency) throw notFound("Emergency not found");
    assertCancellable(emergency);

    const released = await finishEmergency(client, emergency, "CANCELLED", actor);
    await recordAudit(client, {
      ...actor,
      action: `Dispatcher cancelled ${code}: ${reason}`,
      entityType: "emergency_requests",
      entityId: emergency.request_id,
      oldValues: { status: emergency.status },
      newValues: { status: "CANCELLED", reason }
    });

    return { requestId: emergency.request_id, hospitalIds: released };
  });

  await publishEmergency(requestId);
  hospitalIds.forEach(notifyInventory);
  notifyAudit();
  await dispatchPending();
};
