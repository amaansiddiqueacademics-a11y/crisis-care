const fs = require('fs');
let code = fs.readFileSync('backend/gateway/routes/admin.js', 'utf8');

const auditRoute = `
// GET /admin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { rows } = await db.query(
      \`SELECT a.id, a.hospital_id, h.name as hospital_name, u.username as admin_name, a.resource_type, a.previous_qty, a.new_qty, a.action, a.created_at
       FROM resource_audit_logs a
       JOIN hospitals h ON h.id = a.hospital_id
       LEFT JOIN admin_users u ON u.id = a.admin_id
       ORDER BY a.created_at DESC
       LIMIT 200\`
    );
    return res.json({ logs: rows });
  } catch (err) {
    console.error('[admin] audit-logs error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
`;
code = code.replace('module.exports = router;', auditRoute + '\nmodule.exports = router;');
fs.writeFileSync('backend/gateway/routes/admin.js', code);
