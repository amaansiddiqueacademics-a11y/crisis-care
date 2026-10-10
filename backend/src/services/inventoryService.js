import { conflict } from "../utils/AppError.js";
import { recordAudit } from "./auditService.js";

const ICU = "ICU_BED";

/**
 * Reserve one ICU bed for an accepted emergency. Fails if no free bed remains.
 * Reservations do not touch `last_updated`/`source`: only hospital staff edits count as verification.
 */
export const reserveIcuBed = async (client, hospitalId, actor, emergencyCode) => {
  const { rows } = await client.query(
    `
    UPDATE hospital_inventory hi
    SET reserved_quantity = reserved_quantity + 1
    FROM resources r
    WHERE r.resource_id = hi.resource_id
      AND r.resource_code = $2
      AND hi.hospital_id = $1
      AND hi.quantity - hi.reserved_quantity >= 1
    RETURNING hi.inventory_id, hi.quantity, hi.reserved_quantity
    `,
    [hospitalId, ICU]
  );

  if (rows.length === 0) {
    throw conflict(
      "No free ICU bed to reserve. Decline the request so the ambulance can reroute."
    );
  }

  const { inventory_id: id, quantity, reserved_quantity: reserved } = rows[0];

  await recordAudit(client, {
    ...actor,
    hospitalId,
    action: `ICU bed reserved for emergency ${emergencyCode}`,
    entityType: "hospital_inventory",
    entityId: id,
    oldValues: { resource: "ICU Bed", quantity, reserved: reserved - 1 },
    newValues: { resource: "ICU Bed", quantity, reserved }
  });
};

/**
 * Release a reservation (cancelled/rerouted), or consume it when the patient is handed over.
 */
export const releaseIcuBed = async (
  client,
  hospitalId,
  actor,
  emergencyCode,
  { consume = false } = {}
) => {
  const { rows } = await client.query(
    `
    SELECT hi.inventory_id, hi.quantity, hi.reserved_quantity
    FROM hospital_inventory hi
    JOIN resources r ON r.resource_id = hi.resource_id
    WHERE hi.hospital_id = $1 AND r.resource_code = $2
    FOR UPDATE OF hi
    `,
    [hospitalId, ICU]
  );

  const row = rows[0];

  if (!row || row.reserved_quantity < 1) {
    return;
  }

  const next = {
    quantity: consume ? Math.max(0, row.quantity - 1) : row.quantity,
    reserved: row.reserved_quantity - 1
  };

  await client.query(
    "UPDATE hospital_inventory SET quantity = $2, reserved_quantity = $3 WHERE inventory_id = $1",
    [row.inventory_id, next.quantity, next.reserved]
  );

  await recordAudit(client, {
    ...actor,
    hospitalId,
    action: consume
      ? `Patient admitted from emergency ${emergencyCode}: ICU bed consumed`
      : `ICU bed reservation released for emergency ${emergencyCode}`,
    entityType: "hospital_inventory",
    entityId: row.inventory_id,
    oldValues: {
      resource: "ICU Bed",
      quantity: row.quantity,
      reserved: row.reserved_quantity
    },
    newValues: { resource: "ICU Bed", ...next }
  });
};
