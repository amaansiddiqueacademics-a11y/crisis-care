import React, { useState } from 'react';
import { 
  ShieldCheck, 
  History, 
  Server, 
  Activity, 
  Users, 
  Database, 
  CheckCircle2, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Lock, 
  Cpu,
  KeyRound,
  UserCheck,
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

export const AdminPortal = () => {
  const { 
    adminAuth, 
    loginAdmin, 
    logoutAdmin, 
    auditLogs, 
    hospitals, 
    showToast,
  } = useCrisisCare();
  const [adminIdInput, setAdminIdInput] = useState('adm_shivam_027');
  const [passwordInput, setPasswordInput] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('ALL');

  // If Admin is NOT logged in, show the Admin Authentication screen
  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto py-8 animate-fade-in">
        <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.1)] p-6 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.6)] space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-700 to-indigo-900 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">Admin Operations Login</h1>
            <p className="text-xs text-[rgba(255,255,255,0.4)] mt-1">
              Control panel for system managers only
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginAdmin(adminIdInput, passwordInput);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Admin Username
              </label>
              <div className="relative">
                <UserCheck className="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-bold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-indigo-600/60"
                  placeholder="adm_shivam_027"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Admin Master Password
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                  className="w-full pl-9 pr-16 py-2.5 text-xs font-bold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-indigo-600/60"
                  placeholder="••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[11px] text-[rgba(255,255,255,0.4)]">
              <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                Demo: <strong className="text-white font-mono">adm_shivam_027</strong> / <strong className="text-white font-mono">admin123</strong>
              </span>
            </div>

            <button
              type="submit"
              className="w-full text-white font-black text-xs py-3 rounded-xl transition bg-indigo-700 hover:bg-indigo-600"
            >
              LOGIN TO ADMIN PANEL
            </button>
          </form>

          <div className="pt-3 border-t border-[rgba(255,255,255,0.07)] space-y-2">
            <span className="text-[11px] font-bold text-[rgba(255,255,255,0.3)] block text-center">Fast Demo Authentication:</span>
            <button
              type="button"
              onClick={() => loginAdmin('adm_shivam_027', 'admin123')}
              className="w-full text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/50 py-2.5 px-3 rounded-xl border border-indigo-800/40 transition flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>⚡ 1-Click: Super Admin (Shivam Mishra)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter logs for authenticated admin
  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.hospitalName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesHosp = 
      selectedHospitalFilter === 'ALL' || String(log.hospitalId) === String(selectedHospitalFilter);

    return matchesSearch && matchesHosp;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Admin Operations Banner */}
      <div className="glass-dark border border-indigo-900/40 rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-900/40 border border-indigo-800/40 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="badge border border-indigo-800/40 bg-indigo-900/30 text-indigo-300">Admin Panel</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white">Admin Control Centre</h1>
            <p className="text-xs text-[rgba(255,255,255,0.4)]">
              Logged in as <strong className="text-white">{adminAuth.name}</strong> ({adminAuth.adminId})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="glass-dark px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.07)] text-xs flex items-center gap-2 text-white">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Database: <strong className="text-emerald-400">Connected</strong></span>
          </div>
          
          <button
            onClick={logoutAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600 border border-red-500/50 text-xs font-bold text-red-200 hover:text-white transition"
            title="Log out of Super Admin Console"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out Admin</span>
          </button>
        </div>
      </div>

      {/* System Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-dark rounded-2xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider">System Uptime</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <div className="text-2xl font-black text-white mt-2">99.98%</div>
          <div className="text-[11px] text-[rgba(255,255,255,0.35)] mt-1">SLA target: &gt; 99.9% uptime</div>
        </div>

        <div className="glass-dark rounded-2xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider">Hospital Search Speed</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">28 ms</div>
          <div className="text-[11px] text-[rgba(255,255,255,0.35)] mt-1">Hospital search speed (target &lt; 500ms)</div>
        </div>

        <div className="glass-dark rounded-2xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider">Live Update Speed</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2">42 ms</div>
          <div className="text-[11px] text-[rgba(255,255,255,0.35)] mt-1">Live updates to all users</div>
        </div>

        <div className="glass-dark rounded-2xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider">Access Level</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">Super</div>
          <div className="text-[11px] text-[rgba(255,255,255,0.35)] mt-1">Admin: {adminAuth.adminId}</div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-dark rounded-2xl border border-[rgba(255,255,255,0.07)] overflow-hidden">
        <div className="p-5 border-b border-[rgba(255,255,255,0.07)] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base sm:text-lg flex items-center gap-2 text-white">
              <History className="w-5 h-5 text-indigo-500" />
              Change History — Hospital Resources
            </h3>
            <p className="text-xs text-[rgba(255,255,255,0.4)]">
              Full history of all bed, oxygen, and equipment changes across hospitals
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter logs by keyword..."
                style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                className="pl-8 pr-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 text-slate-900 bg-white outline-none focus:border-red-500 w-48 sm:w-60 shadow-xs"
              />
            </div>

            {/* Hospital Filter */}
            <select
              value={selectedHospitalFilter}
              onChange={(e) => setSelectedHospitalFilter(e.target.value)}
              style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
              className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none text-slate-900 bg-white focus:border-red-500 shadow-xs"
            >
              <option value="ALL" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-bold">
                All Facilities
              </option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id} style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-bold">
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b font-bold uppercase tracking-wider text-[11px] bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.5)]">
              <tr>
                <th className="py-3 px-4">Log ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Facility</th>
                <th className="py-3 px-4">Administrator</th>
                <th className="py-3 px-4">Resource Target</th>
                <th className="py-3 px-4">Change (Before → After)</th>
                <th className="py-3 px-4">Reason / System Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-[rgba(255,255,255,0.4)] font-semibold">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">{log.id}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-white font-medium">{log.timestamp}</div>
                      <div className="text-[10px] text-[rgba(255,255,255,0.4)]">{log.date}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{log.hospitalName}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-white">{log.adminName}</span>
                      <span className="block text-[10px] font-mono text-[rgba(255,255,255,0.4)]">{log.adminId}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">{log.resourceType}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold bg-[rgba(255,255,255,0.05)] text-white border border-[rgba(255,255,255,0.1)]">
                        <span className="line-through text-[rgba(255,255,255,0.4)]">{log.previousQty}</span>
                        <span>→</span>
                        <span className="text-emerald-400 font-black">{log.newQty}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[rgba(255,255,255,0.8)]">{log.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t flex items-center justify-between text-[11px] px-4 bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.5)]">
          <span className="font-medium">Showing {filteredLogs.length} change records</span>
          <button
            onClick={() => showToast('Audit Export', 'Encrypted CSV audit export downloaded to local machine.', 'info')}
            className="flex items-center gap-1 font-bold text-indigo-400 hover:text-indigo-300 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Download Change History (CSV)
          </button>
        </div>
      </div>
    </div>
  );
};
