/**
 * Append a row to audit_logs using the caller's transaction client.
 */
export const recordAudit = async (client, entry) => {
  const result = await client.query(
    `
    INSERT INTO audit_logs
      (actor_id, actor_name, actor_role, hospital_id, action,
       entity_type, entity_id, old_values, new_values, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING audit_id
    `,
    [
      entry.actorId ?? null,
      entry.actorName ?? null,
      entry.actorRole ?? null,
      entry.hospitalId ?? null,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      entry.newValues ? JSON.stringify(entry.newValues) : null,
      entry.ip ?? null,
      entry.userAgent ?? null
    ]
  );

  return result.rows[0].audit_id;
};

export const requestMeta = (req) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"]?.slice(0, 300)
});
