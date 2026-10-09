const fs = require('fs');
let code = fs.readFileSync('frontend/frontend/src/components/admin/AdminPortal.jsx', 'utf8');

// 1. Destructure new context values
code = code.replace(
  'fetchLiveAttendants,',
  'fetchLiveAttendants,\n    realAuditLogs,\n    fetchRealAuditLogs,'
);

// 2. Fetch logs on tab change
const fetchEffect = `  useEffect(() => {
    if (adminAuth && activeTab === 'logs') {
      fetchRealAuditLogs();
    }
  }, [adminAuth, activeTab, fetchRealAuditLogs]);`;
code = code.replace('// Live-rotating statuses', fetchEffect + '\n\n  // Live-rotating statuses');

// 3. Update filter logic
const oldFilter = `  // Filtered audit logs (legacy)
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch =
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.adminName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.hospitalName.toLowerCase().includes(auditSearch.toLowerCase());
    return matchesSearch;
  });`;

const newFilter = `  // Filtered real audit logs
  const filteredAuditLogs = (realAuditLogs || []).filter(log => {
    const matchesSearch =
      (log.action || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.admin_name || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.hospital_name || '').toLowerCase().includes(auditSearch.toLowerCase());
    return matchesSearch;
  });`;
code = code.replace(oldFilter, newFilter);

// 4. Update CSV export
const oldCsv = `  const exportAuditCSV = () => {
    const headers = ['Log ID', 'Timestamp', 'Date', 'Hospital', 'Admin', 'Resource', 'Before', 'After', 'Action'];
    const rows = filteredAuditLogs.map(l => [
      l.id, l.timestamp, l.date, \`"\${l.hospitalName}"\`, \`"\${l.adminName}"\`,
      \`"\${l.resourceType}"\`, l.previousQty, l.newQty, \`"\${l.action}"\`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');`;

const newCsv = `  const exportAuditCSV = () => {
    const headers = ['Log ID', 'Timestamp', 'Hospital', 'Admin', 'Resource', 'Before', 'After', 'Action'];
    const rows = filteredAuditLogs.map(l => {
      const dt = new Date(l.created_at);
      return [
        l.id, \`"\${dt.toLocaleString()}"\`, \`"\${l.hospital_name}"\`, \`"\${l.admin_name || 'SYSTEM'}"\`,
        \`"\${l.resource_type}"\`, l.previous_qty, l.new_qty, \`"\${l.action}"\`,
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');`;
code = code.replace(oldCsv, newCsv);

// 5. Update UI mapping
const oldTableRow = `                    filteredAuditLogs.map(log => (
                      <tr key={log.id} className="transition hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400">{log.id}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-white">{log.timestamp}</div>
                          <div className="text-[10px] text-[rgba(255,255,255,0.4)]">{log.date}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-xs">{log.hospitalName}</div>
                          <div className="text-[10px] text-[rgba(255,255,255,0.5)]">Auth: {log.adminName}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-xs text-white">{log.resourceType}</td>
                        <td className="py-3 px-4 font-mono text-center text-[rgba(255,255,255,0.5)]">{log.previousQty}</td>
                        <td className="py-3 px-4 text-center">
                          <ArrowRight className="w-4 h-4 mx-auto text-[rgba(255,255,255,0.2)]" />
                        </td>
                        <td className="py-3 px-4 font-mono text-center font-bold text-white">{log.newQty}</td>
                        <td className="py-3 px-4 text-[11px] text-[rgba(255,255,255,0.7)]">{log.action}</td>
                      </tr>
                    ))`;

const newTableRow = `                    filteredAuditLogs.map(log => (
                      <tr key={log.id} className="transition hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400">#{log.id}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-white">{new Date(log.created_at).toLocaleTimeString()}</div>
                          <div className="text-[10px] text-[rgba(255,255,255,0.4)]">{new Date(log.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-xs">{log.hospital_name}</div>
                          <div className="text-[10px] text-[rgba(255,255,255,0.5)]">Auth: {log.admin_name || 'System Dispatch'}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-xs text-white">{log.resource_type.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-4 font-mono text-center text-[rgba(255,255,255,0.5)]">{log.previous_qty}</td>
                        <td className="py-3 px-4 text-center">
                          <ArrowRight className="w-4 h-4 mx-auto text-[rgba(255,255,255,0.2)]" />
                        </td>
                        <td className="py-3 px-4 font-mono text-center font-bold text-white">{log.new_qty}</td>
                        <td className="py-3 px-4 text-[11px] text-[rgba(255,255,255,0.7)]">{log.action}</td>
                      </tr>
                    ))`;
code = code.replace(oldTableRow, newTableRow);

fs.writeFileSync('frontend/frontend/src/components/admin/AdminPortal.jsx', code);
