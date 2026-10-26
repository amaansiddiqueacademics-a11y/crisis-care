import pool, { withTransaction } from "../config/db.js";
import { badRequest, conflict, notFound } from "../utils/AppError.js";
import { etaMinutes, metersToKm } from "../utils/geo.js";
import { recordAudit } from "./auditService.js";
import { getEmergencyView, publishEmergency } from "./emergencyService.js";
import { reserveIcuBed } from "./inventoryService.js";
import { assessFit, requirementsFor } from "./matching.js";
import { notifyAudit, notifyInventory } from "../realtime/socket.js";

const MAX_STOCK = 100000;

// ---------------------------------------------------------------------------
// Public directory
// ---------------------------------------------------------------------------

/**
 * Hospitals with their *available* stock (quantity minus reserved), the time hospital staff
 * last confirmed it, and whether it was ever confirmed (otherwise it is seeded sample data).
 */
export const listHospitals = async ({ city } = {}) => {
  const { rows } = await pool.query(
    `
    SELECT h.hospital_id, h.name, h.city, h.address, h.phone, h.latitude, h.longitude, h.tier,
           h.zone, h.ownership, h.er_status, h.er_status_note, h.er_status_updated_at,
           COALESCE((SELECT array_agg(service_code::text ORDER BY service_code) FROM hospital_services hs
                     WHERE hs.hospital_id = h.hospital_id AND hs.available), '{}') AS services,
           COALESCE(
             jsonb_object_agg(r.resource_code, hi.quantity - hi.reserved_quantity)
               FILTER (WHERE r.resource_code IS NOT NULL),
             '{}'::jsonb
           ) AS available,
           MAX(hi.last_updated) FILTER (WHERE hi.source = 'HOSPITAL_REPORTED') AS confirmed_at,
           bool_or(hi.source = 'HOSPITAL_REPORTED') AS is_confirmed,
           (SELECT s.full_name FROM hospital_surgeons hs JOIN surgeons s USING (surgeon_id)
             WHERE hs.hospital_id = h.hospital_id AND hs.status = 'AVAILABLE'
             ORDER BY hs.updated_at DESC LIMIT 1) AS surgeon_name
    FROM hospitals h
    LEFT JOIN hospital_inventory hi ON hi.hospital_id = h.hospital_id
    LEFT JOIN resources r ON r.resource_id = hi.resource_id
    WHERE h.status = 'ACTIVE' AND ($1::text IS NULL OR h.city = $1)
    GROUP BY h.hospital_id
    ORDER BY h.zone, h.name
    `,
    [city || null]
  );

  return rows.map((h) => ({
    id: h.hospital_id,
    name: h.name,
    city: h.city,
    address: h.address,
    phone: h.phone,
    lat: h.latitude,
    lng: h.longitude,
    tier: h.tier,
    zone: h.zone,
    ownership: h.ownership,
    erStatus: h.er_status,
    erStatusNote: h.er_status_note,
    erStatusUpdatedAt: h.er_status_updated_at,
    services: h.services,
    available: h.available,
    inventoryConfirmedAt: h.confirmed_at,
    inventoryConfirmed: Boolean(h.is_confirmed),
    onDutySurgeon: h.surgeon_name
  }));
};

/**
 * Public "which hospital should I go to" for a condition at a location, using the same
 * matching rules the ambulance crews see.
 */
export const recommendHospitals = async ({ type, lat, lng }) => {
  const { rows } = await pool.query(
    `
    SELECT h.hospital_id, h.name, h.zone, h.ownership, h.address, h.phone, h.latitude, h.longitude,
           h.er_status, h.er_status_note,
           ST_Distance(h.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS dist,
           COALESCE((SELECT jsonb_object_agg(rs.resource_code, hi.quantity - hi.reserved_quantity)
                     FROM hospital_inventory hi JOIN resources rs USING (resource_id)
                     WHERE hi.hospital_id = h.hospital_id), '{}') AS available,
           (SELECT MAX(hi.last_updated) FILTER (WHERE hi.source = 'HOSPITAL_REPORTED')
              FROM hospital_inventory hi WHERE hi.hospital_id = h.hospital_id) AS confirmed_at,
           COALESCE((SELECT array_agg(service_code::text) FROM hospital_services hs
                     WHERE hs.hospital_id = h.hospital_id AND hs.available), '{}') AS services
    FROM hospitals h
    WHERE h.status = 'ACTIVE'
    ORDER BY dist
    LIMIT 30
    `,
    [lat, lng]
  );

  const requirements = requirementsFor({ type });

  const ranked = rows
    .map((h) => ({
      id: h.hospital_id,
      name: h.name,
      zone: h.zone,
      ownership: h.ownership,
      address: h.address,
      phone: h.phone,
      lat: h.latitude,
      lng: h.longitude,
      erStatus: h.er_status,
      erStatusNote: h.er_status_note,
      distanceKm: metersToKm(h.dist),
      etaMinutes: etaMinutes(h.dist),
      inventoryConfirmedAt: h.confirmed_at,
      fit: assessFit(requirements, {
        services: h.services,
        available: h.available,
        erStatus: h.er_status,
        erStatusNote: h.er_status_note,
        inventoryConfirmed: Boolean(h.confirmed_at)
      })
    }))
    .sort(
      (a, b) =>
        (a.erStatus === "DIVERSION") - (b.erStatus === "DIVERSION") ||
        a.fit.missing.length - b.fit.missing.length ||
        a.etaMinutes + (a.erStatus === "LIMITED" ? 15 : 0) - (b.etaMinutes + (b.erStatus === "LIMITED" ? 15 : 0))
    );

  return { needs: requirements.map((r) => r.label), hospitals: ranked.slice(0, 8) };
};

export const listCities = async () => {
  const { rows } = await pool.query(
    `SELECT city, COUNT(*)::int AS hospitals FROM hospitals
     WHERE status = 'ACTIVE' AND city IS NOT NULL GROUP BY city ORDER BY hospitals DESC, city`
  );

  return rows;
};

// ---------------------------------------------------------------------------
// Own hospital (staff)
// ---------------------------------------------------------------------------

const getSurgeon = async (db, hospitalId) => {
  const { rows } = await db.query(
    `SELECT hs.hospital_surgeon_id, s.surgeon_id, s.full_name, s.specialization, hs.status,
            hs.updated_at
     FROM hospital_surgeons hs JOIN surgeons s ON s.surgeon_id = hs.surgeon_id
     WHERE hs.hospital_id = $1 ORDER BY hs.updated_at DESC LIMIT 1`,
    [hospitalId]
  );

  const s = rows[0];

  return s
    ? {
        id: s.surgeon_id,
        fullName: s.full_name,
        specialization: s.specialization,
        status: s.status,
        updatedAt: s.updated_at
      }
    : null;
};

export const getOwnHospital = async (hospitalId) => {
  const { rows } = await pool.query(
    `SELECT hospital_id, name, city, address, phone, latitude, longitude, tier,
            zone, ownership, er_status, er_status_note, er_status_updated_at
     FROM hospitals WHERE hospital_id = $1`,
    [hospitalId]
  );

  const h = rows[0];

  if (!h) throw notFound("Hospital not found");

  const inventory = await pool.query(
    `SELECT r.resource_code, r.resource_name, r.resource_category, r.unit,
            hi.quantity, hi.reserved_quantity, hi.last_updated, hi.source
     FROM hospital_inventory hi JOIN resources r ON r.resource_id = hi.resource_id
     WHERE hi.hospital_id = $1 AND r.is_active
     ORDER BY r.resource_category, r.resource_id`,
    [hospitalId]
  );

  const services = await pool.query(
    `SELECT service_code, available, source, updated_at FROM hospital_services
     WHERE hospital_id = $1 ORDER BY service_code`,
    [hospitalId]
  );

  return {
    hospital: {
      id: h.hospital_id,
      name: h.name,
      city: h.city,
      address: h.address,
      phone: h.phone,
      lat: h.latitude,
      lng: h.longitude,
      tier: h.tier,
      zone: h.zone,
      ownership: h.ownership,
      erStatus: h.er_status,
      erStatusNote: h.er_status_note,
      erStatusUpdatedAt: h.er_status_updated_at
    },
    inventory: inventory.rows.map(toInventoryItem),
    services: services.rows.map((r) => ({
      code: r.service_code,
      available: r.available,
      confirmed: r.source === "HOSPITAL_REPORTED",
      updatedAt: r.updated_at
    })),
    surgeon: await getSurgeon(pool, hospitalId)
  };
};

const toInventoryItem = (row) => ({
  code: row.resource_code,
  name: row.resource_name,
  category: row.resource_category,
  unit: row.unit,
  quantity: row.quantity,
  reserved: row.reserved_quantity,
  available: row.quantity - row.reserved_quantity,
  lastUpdated: row.last_updated,
  confirmed: row.source === "HOSPITAL_REPORTED"
});

/**
 * Set a resource's stock (`quantity`) or adjust it (`delta`). Stock can't drop below reserved beds.
 */
export const updateInventory = async (user, resourceCode, { quantity, delta }) => {
  const item = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT hi.inventory_id, hi.quantity, hi.reserved_quantity, r.resource_name
       FROM hospital_inventory hi JOIN resources r ON r.resource_id = hi.resource_id
       WHERE hi.hospital_id = $1 AND r.resource_code = $2
       FOR UPDATE OF hi`,
      [user.hospitalId, resourceCode]
    );

    const current = rows[0];

    if (!current) throw notFound("Unknown resource");

    const next = quantity !== undefined ? quantity : current.quantity + delta;

    if (next < 0 || next > MAX_STOCK) {
      throw badRequest(`Quantity must be between 0 and ${MAX_STOCK}`);
    }

    if (next < current.reserved_quantity) {
      throw conflict(
        `${current.reserved_quantity} unit(s) are reserved for incoming emergencies; stock cannot go lower`
      );
    }

    await client.query(
      `UPDATE hospital_inventory
       SET quantity = $2, last_updated = CURRENT_TIMESTAMP, updated_by = $3,
           source = 'HOSPITAL_REPORTED'
       WHERE inventory_id = $1`,
      [current.inventory_id, next, user.userId]
    );

    await recordAudit(client, {
      actorId: user.userId,
      actorName: user.name,
      actorRole: user.role,
      hospitalId: user.hospitalId,
      action: next >= current.quantity ? "Stock increased" : "Stock decreased",
      entityType: "hospital_inventory",
      entityId: current.inventory_id,
      oldValues: { resource: current.resource_name, quantity: current.quantity },
      newValues: { resource: current.resource_name, quantity: next },
      ...user.meta
    });

    const updated = await client.query(
      `SELECT r.resource_code, r.resource_name, r.resource_category, r.unit,
              hi.quantity, hi.reserved_quantity, hi.last_updated, hi.source
       FROM hospital_inventory hi JOIN resources r ON r.resource_id = hi.resource_id
       WHERE hi.inventory_id = $1`,
      [current.inventory_id]
    );

    return toInventoryItem(updated.rows[0]);
  });

  notifyInventory(user.hospitalId);
  notifyAudit();

  return item;
};

/**
 * Set the hospital's on-duty trauma surgeon (name, specialization and availability).
 */
export const updateSurgeon = async (user, { fullName, specialization, status }) => {
  const surgeon = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT hs.hospital_surgeon_id, s.surgeon_id, s.full_name, s.specialization, hs.status
       FROM hospital_surgeons hs JOIN surgeons s ON s.surgeon_id = hs.surgeon_id
       WHERE hs.hospital_id = $1 ORDER BY hs.updated_at DESC LIMIT 1 FOR UPDATE OF hs`,
      [user.hospitalId]
    );

    const current = rows[0];

    if (!current && !fullName) {
      throw badRequest("Enter the surgeon's name to set the on-duty surgeon");
    }

    let entityId;

    if (current) {
      entityId = current.hospital_surgeon_id;

      await client.query(
        `UPDATE surgeons SET full_name = COALESCE($2, full_name),
                specialization = COALESCE($3, specialization)
         WHERE surgeon_id = $1`,
        [current.surgeon_id, fullName ?? null, specialization ?? null]
      );
      await client.query(
        "UPDATE hospital_surgeons SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE hospital_surgeon_id = $1",
        [entityId, status]
      );
    } else {
      const created = await client.query(
        "INSERT INTO surgeons (full_name, specialization) VALUES ($1, $2) RETURNING surgeon_id",
        [fullName, specialization || "Trauma Surgeon"]
      );
      const link = await client.query(
        `INSERT INTO hospital_surgeons (hospital_id, surgeon_id, status)
         VALUES ($1, $2, $3) RETURNING hospital_surgeon_id`,
        [user.hospitalId, created.rows[0].surgeon_id, status]
      );
      entityId = link.rows[0].hospital_surgeon_id;
    }

    await recordAudit(client, {
      actorId: user.userId,
      actorName: user.name,
      actorRole: user.role,
      hospitalId: user.hospitalId,
      action: "On-duty surgeon updated",
      entityType: "hospital_surgeons",
      entityId,
      oldValues: current
        ? { resource: "On-duty surgeon", status: current.status, name: current.full_name }
        : null,
      newValues: {
        resource: "On-duty surgeon",
        status,
        name: fullName ?? current?.full_name
      },
      ...user.meta
    });

    return getSurgeon(client, user.hospitalId);
  });

  notifyInventory(user.hospitalId);
  notifyAudit();

  return surgeon;
};

// ---------------------------------------------------------------------------
// Incoming ambulance requests
// ---------------------------------------------------------------------------

export const listRequests = async (hospitalId) => {
  const { rows } = await pool.query(
    `
    SELECT r.response_id, r.status, r.reason, r.responded_at, r.created_at, e.emergency_code
    FROM hospital_emergency_responses r
    JOIN emergency_requests e ON e.request_id = r.request_id
    WHERE r.hospital_id = $1
      AND (
        (r.status IN ('PENDING', 'ACCEPTED') AND e.status NOT IN ('CLOSED', 'CANCELLED'))
        -- history; a question that was never answered before the call ended is not history
        OR (r.created_at > NOW() - INTERVAL '24 hours'
            AND (r.status <> 'PENDING' OR e.status NOT IN ('CLOSED', 'CANCELLED')))
      )
    ORDER BY (r.status = 'PENDING') DESC, r.created_at DESC
    LIMIT 20
    `,
    [hospitalId]
  );

  const own = await pool.query(
    `SELECT h.er_status, h.er_status_note,
            COALESCE((SELECT jsonb_object_agg(rs.resource_code, hi.quantity - hi.reserved_quantity)
                      FROM hospital_inventory hi JOIN resources rs USING (resource_id)
                      WHERE hi.hospital_id = h.hospital_id), '{}') AS available,
            COALESCE((SELECT array_agg(service_code::text) FROM hospital_services hs
                      WHERE hs.hospital_id = h.hospital_id AND hs.available), '{}') AS services
     FROM hospitals h WHERE h.hospital_id = $1`,
    [hospitalId]
  );
  const me = own.rows[0];

  return Promise.all(
    rows.map(async (r) => {
      const emergency = await getEmergencyView(
        pool,
        "e.emergency_code = $1",
        r.emergency_code,
        { clinical: true }
      );

      const fit = assessFit(
        requirementsFor({ type: emergency.type, assessment: emergency.assessment, patient: emergency.patient }),
        { services: me.services, available: me.available, erStatus: me.er_status, erStatusNote: me.er_status_note, inventoryConfirmed: true }
      );

      return {
        fit,
        responseId: r.response_id,
        status: r.status.toLowerCase(),
        declineReason: r.reason,
        respondedAt: r.responded_at,
        requestedAt: r.created_at,
        emergency
      };
    })
  );
};

export const respondToRequest = async (user, responseId, { decision, reason }) => {
  const requestId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT r.response_id, r.request_id, r.status, e.emergency_code, e.status AS emergency_status,
              e.selected_hospital_id
       FROM hospital_emergency_responses r
       JOIN emergency_requests e ON e.request_id = r.request_id
       WHERE r.response_id = $1 AND r.hospital_id = $2
       FOR UPDATE OF r, e`,
      [responseId, user.hospitalId]
    );

    const response = rows[0];

    if (!response) throw notFound("Request not found");

    if (response.status !== "PENDING") {
      throw conflict(`This request was already ${response.status.toLowerCase()}`);
    }

    if (
      ["CLOSED", "CANCELLED"].includes(response.emergency_status) ||
      response.selected_hospital_id !== user.hospitalId
    ) {
      throw conflict("This request is no longer active");
    }

    const actor = {
      actorId: user.userId,
      actorName: user.name,
      actorRole: user.role,
      ...user.meta
    };

    // Reserve an ICU bed only for patients who need one: a snakebite or a delivery can be
    // accepted by a hospital without a free ICU bed.
    let icuReserved = false;

    if (decision === "ACCEPT") {
      const view = await getEmergencyView(pool, "e.request_id = $1", response.request_id, { clinical: true });
      const needsIcu = requirementsFor({ type: view.type, assessment: view.assessment, patient: view.patient })
        .some((r) => r.code === "ICU_BED");

      if (needsIcu) {
        await reserveIcuBed(client, user.hospitalId, actor, response.emergency_code);
        icuReserved = true;
      } else {
        await recordAudit(client, {
          ...actor,
          hospitalId: user.hospitalId,
          action: `Accepted emergency ${response.emergency_code} (no ICU bed needed)`,
          entityType: "hospital_emergency_responses",
          entityId: response.response_id
        });
      }
    } else {
      await recordAudit(client, {
        ...actor,
        hospitalId: user.hospitalId,
        action: `Declined emergency ${response.emergency_code}: ${reason}`,
        entityType: "hospital_emergency_responses",
        entityId: response.response_id
      });
    }

    await client.query(
      `UPDATE hospital_emergency_responses
       SET status = $2, reason = $3, responded_by = $4, responded_at = CURRENT_TIMESTAMP,
           icu_reserved = $5
       WHERE response_id = $1`,
      [
        response.response_id,
        decision === "ACCEPT" ? "ACCEPTED" : "DECLINED",
        decision === "DECLINE" ? reason : null,
        user.userId,
        icuReserved
      ]
    );

    await client.query("UPDATE emergency_requests SET status = $2 WHERE request_id = $1", [
      response.request_id,
      decision === "ACCEPT" ? "HOSPITAL_ACCEPTED" : "HOSPITAL_DECLINED"
    ]);

    return response.request_id;
  });

  await publishEmergency(requestId);
  notifyInventory(user.hospitalId);
  notifyAudit();
};

// ---------------------------------------------------------------------------
// Emergency-room status and services (staff)
// ---------------------------------------------------------------------------

export const updateErStatus = async (user, { status, note }) => {
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT er_status, er_status_note FROM hospitals WHERE hospital_id = $1 FOR UPDATE",
      [user.hospitalId]
    );

    await client.query(
      `UPDATE hospitals SET er_status = $2, er_status_note = $3, er_status_updated_at = CURRENT_TIMESTAMP
       WHERE hospital_id = $1`,
      [user.hospitalId, status, note || null]
    );

    await recordAudit(client, {
      actorId: user.userId,
      actorName: user.name,
      actorRole: user.role,
      hospitalId: user.hospitalId,
      action: `Emergency room set to ${status}${note ? `: ${note}` : ""}`,
      entityType: "hospitals",
      entityId: user.hospitalId,
      oldValues: { resource: "ER status", status: rows[0].er_status },
      newValues: { resource: "ER status", status },
      ...user.meta
    });
  });

  notifyInventory(user.hospitalId);
  notifyAudit();
};

export const updateService = async (user, serviceCode, available) => {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO hospital_services (hospital_id, service_code, available, source, updated_by, updated_at)
       VALUES ($1, $2, $3, 'HOSPITAL_REPORTED', $4, CURRENT_TIMESTAMP)
       ON CONFLICT (hospital_id, service_code) DO UPDATE SET
         available = EXCLUDED.available, source = 'HOSPITAL_REPORTED',
         updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
      [user.hospitalId, serviceCode, available, user.userId]
    );

    await recordAudit(client, {
      actorId: user.userId,
      actorName: user.name,
      actorRole: user.role,
      hospitalId: user.hospitalId,
      action: `Service ${serviceCode} ${available ? "available" : "unavailable"}`,
      entityType: "hospital_services",
      entityId: user.hospitalId,
      newValues: { resource: serviceCode, status: available ? "AVAILABLE" : "UNAVAILABLE" },
      ...user.meta
    });
  });

  notifyInventory(user.hospitalId);
  notifyAudit();
};
