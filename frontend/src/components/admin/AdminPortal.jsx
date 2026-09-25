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
    theme 
  } = useCrisisCare();
  
  const isRed = theme === 'red';
  const [adminIdInput, setAdminIdInput] = useState('adm_shivam_027');
  const [passwordInput, setPasswordInput] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('ALL');

  // If Admin is NOT logged in, show the Admin Authentication screen
  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-elevated space-y-6">
          <div className="text-center">
            <div className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center mx-auto shadow-md mb-3 ${
              isRed ? 'bg-[#B71C1C]' : 'bg-indigo-600'
            }`}>
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Admin Operations Login</h1>
            <p className="text-xs text-slate-500 mt-1">
              National Dispatch Infrastructure & Cryptographic Audit Console
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
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Super Admin ID / Clearance ID
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-bold text-slate-900 bg-white rounded-xl border border-slate-300 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
                  placeholder="adm_shivam_027"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Admin Master Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                  className="w-full pl-9 pr-12 py-2.5 text-xs font-bold text-slate-900 bg-white rounded-xl border border-slate-300 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
                  placeholder="••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[11px] font-bold text-red-600 hover:text-red-800"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Demo Admin ID: <strong>adm_shivam_027</strong> • Password: <strong>admin123</strong>
              </span>
            </div>

            <button
              type="submit"
              className={`w-full text-white font-black text-xs py-3 rounded-xl shadow-sm transition ${
                isRed ? 'bg-[#B71C1C] hover:bg-[#8B0000]' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              AUTHENTICATE SUPER ADMIN ACCESS
            </button>
          </form>

          {/* Quick 1-click Demo shortcut */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 block text-center">Fast 1-Click Authentication:</span>
            <button
              type="button"
              onClick={() => loginAdmin('adm_shivam_027', 'admin123')}
              className="w-full text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 py-2.5 px-3 rounded-xl border border-red-200 transition text-center flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Log In as Super Admin (Shivam Mishra)</span>
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
      selectedHospitalFilter === 'ALL' || log.hospitalId === selectedHospitalFilter;

    return matchesSearch && matchesHosp;
  });

  return (
    <div className="space-y-6">
      {/* Admin Operations Banner */}
      <div className={`${
        isRed 
          ? 'bg-[#0e0f14] border border-red-900/40 text-white shadow-xl' 
          : 'bg-teal-deep text-white shadow-subtle'
      } p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <div className="flex items-center gap-2">
            <span className={`${
              isRed ? 'bg-red-700 text-white' : 'bg-indigo-600 text-white'
            } text-[10px] font-extrabold uppercase px-2 py-0.5 rounded`}>
              Super Admin Console
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold">System Audit & Architectural Resilience</h1>
          </div>
          <p className={`text-xs sm:text-sm mt-1 ${isRed ? 'text-slate-300' : 'text-teal-light/80'}`}>
            Logged in as <strong className="text-white">{adminAuth.name}</strong> ({adminAuth.adminId}) • {adminAuth.clearanceLevel}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 text-xs flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>PostGIS: <strong>Optimal (32ms)</strong></span>
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
        <div className={`${
          isRed ? 'bg-[#111218] border-red-950/70 text-slate-100' : 'bg-surface-card border-surface-border text-teal-deep'
        } rounded-2xl border p-4 shadow-subtle`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Uptime</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <div className={`text-2xl font-black ${isRed ? 'text-white' : 'text-teal-deep'} mt-2`}>99.98%</div>
          <div className="text-[11px] text-slate-400 mt-1">SRS SLA target: &gt; 99.9% uptime</div>
        </div>

        <div className={`${
          isRed ? 'bg-[#111218] border-red-950/70 text-slate-100' : 'bg-surface-card border-surface-border text-teal-deep'
        } rounded-2xl border p-4 shadow-subtle`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Spatial Query Latency</span>
            <Database className={`w-4 h-4 ${isRed ? 'text-red-400' : 'text-teal-primary'}`} />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">28 ms</div>
          <div className="text-[11px] text-slate-400 mt-1">PostGIS ST_DWithin (target &lt; 500ms)</div>
        </div>

        <div className={`${
          isRed ? 'bg-[#111218] border-red-950/70 text-slate-100' : 'bg-surface-card border-surface-border text-teal-deep'
        } rounded-2xl border p-4 shadow-subtle`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sync Latency</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className={`text-2xl font-black ${isRed ? 'text-white' : 'text-teal-deep'} mt-2`}>42 ms</div>
          <div className="text-[11px] text-slate-400 mt-1">Real-time WebSocket & localStorage sync</div>
        </div>

        <div className={`${
          isRed ? 'bg-[#111218] border-red-950/70 text-slate-100' : 'bg-surface-card border-surface-border text-teal-deep'
        } rounded-2xl border p-4 shadow-subtle`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Clearance</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-2xl font-black text-emerald-400 mt-2`}>Level 5</div>
          <div className="text-[11px] text-slate-400 mt-1">Super Admin: {adminAuth.adminId}</div>
        </div>
      </div>

      {/* Audit Log Table (Figure B.2 in SRS: AuditLog) */}
      <div className={`${
        isRed ? 'bg-[#111218] border-red-950/70 text-slate-100' : 'bg-surface-card border-surface-border'
      } rounded-2xl border shadow-subtle overflow-hidden`}>
        <div className={`p-5 border-b ${isRed ? 'border-red-950/60' : 'border-surface-border'} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <h3 className={`font-black text-base sm:text-lg flex items-center gap-2 ${isRed ? 'text-white' : 'text-teal-deep'}`}>
              <History className={`w-5 h-5 ${isRed ? 'text-red-500' : 'text-teal-primary'}`} />
              Cryptographic Audit Trails & Inventory Mutations
            </h3>
            <p className={`text-xs ${isRed ? 'text-slate-300' : 'text-slate-500'}`}>
              Immutable logging of all hospital bed, oxygen, and blood modifications per SRS Section 5.3 & 5.5
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
            <thead className={`border-b font-bold uppercase tracking-wider text-[11px] ${
              isRed 
                ? 'bg-[#181922] border-red-950/60 text-slate-200' 
                : 'bg-slate-50 border-surface-border text-slate-600'
            }`}>
              <tr>
                <th className="py-3 px-4">Log ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Facility</th>
                <th className="py-3 px-4">Administrator</th>
                <th className="py-3 px-4">Resource Target</th>
                <th className="py-3 px-4 text-center">Delta (Old → New)</th>
                <th className="py-3 px-4">Reason / System Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isRed ? 'divide-slate-800' : 'divide-surface-border'}`}>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400 font-semibold">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className={`transition ${isRed ? 'hover:bg-red-950/20' : 'hover:bg-slate-50/80'}`}>
                    <td className={`py-3 px-4 font-mono font-bold ${isRed ? 'text-red-400' : 'text-teal-deep'}`}>{log.id}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className={isRed ? 'text-slate-200' : 'text-slate-700 font-medium'}>{log.timestamp}</div>
                      <div className="text-[10px] text-slate-400">{log.date}</div>
                    </td>
                    <td className={`py-3 px-4 font-semibold ${isRed ? 'text-white' : 'text-slate-900'}`}>{log.hospitalName}</td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${isRed ? 'text-slate-200' : 'text-slate-800'}`}>{log.adminName}</span>
                      <span className="block text-[10px] font-mono text-slate-400">{log.adminId}</span>
                    </td>
                    <td className={`py-3 px-4 font-bold ${isRed ? 'text-red-400' : 'text-teal-primary'}`}>{log.resourceType}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold ${
                        isRed ? 'bg-[#181922] text-slate-200 border border-slate-700' : 'bg-slate-100 text-slate-800'
                      }`}>
                        <span className="line-through text-slate-400">{log.previousQty}</span>
                        <span>→</span>
                        <span className="text-emerald-400 font-black">{log.newQty}</span>
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-medium ${isRed ? 'text-slate-200' : 'text-slate-700'}`}>{log.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={`p-3 border-t flex items-center justify-between text-[11px] px-4 ${
          isRed ? 'bg-[#181922] border-red-950/60 text-slate-300' : 'bg-slate-50 border-surface-border text-slate-600'
        }`}>
          <span className="font-medium">Showing {filteredLogs.length} verified administrative audit trails</span>
          <button
            onClick={() => showToast('Audit Export', 'Encrypted CSV audit export downloaded to local machine.', 'info')}
            className="flex items-center gap-1 font-bold text-red-400 hover:text-red-300 hover:underline"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Encrypted Audit Trail (CSV)
          </button>
        </div>
      </div>
    </div>
  );
};
