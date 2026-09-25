import React, { useState } from 'react';
import { 
  Truck, 
  User, 
  KeyRound, 
  Stethoscope, 
  Navigation, 
  Hospital, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Radio, 
  ChevronRight,
  ShieldCheck,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { MapView } from '../common/MapView';

export const AmbulancePortal = () => {
  const { 
    ambulanceAuth, 
    loginAmbulance, 
    logoutAmbulance, 
    citizenIncident, 
    hospitals, 
    emergencies,
    hospitalDecisions,
    selectedHospitalForAmbulance,
    selectHospitalForAmbulance,
    submitAttendantAssessment,
    showToast,
    theme
  } = useCrisisCare();

  const isRed = theme === 'red';

  // Login form state
  const [badgeId, setBadgeId] = useState('PARA-409');
  const [password, setPassword] = useState('paramedic123');
  const [showPassword, setShowPassword] = useState(false);

  // Clinical assessment questions
  const [isConscious, setIsConscious] = useState('semi-conscious');
  const [isBreathingProperly, setIsBreathingProperly] = useState('labored');
  const [pulseStatus, setPulseStatus] = useState('rapid');
  const [severeBleeding, setSevereBleeding] = useState(true);
  const [pulseBpm, setPulseBpm] = useState(108);
  const [spo2, setSpo2] = useState(91);
  const [bp, setBp] = useState('115/78');

  // If not logged in, show paramedic authentication screen
  if (!ambulanceAuth) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="bg-surface-card rounded-3xl border border-surface-border p-6 sm:p-8 shadow-elevated space-y-6">
          <div className="text-center">
            <div className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center mx-auto shadow-md mb-3 ${
              isRed ? 'bg-[#B71C1C]' : 'bg-amber-500'
            }`}>
              <Truck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Ambulance Attendant Login</h1>
            <p className="text-xs text-surface-muted mt-1">
              Authorized Paramedic CAD Telemetry Portal
            </p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              loginAmbulance(badgeId, password);
            }} 
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Paramedic Badge ID / Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-bold text-slate-900 bg-white rounded-xl border border-slate-300 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Access Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                  className="w-full pl-9 pr-12 py-2.5 text-xs font-bold text-slate-900 bg-white rounded-xl border border-slate-300 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[11px] font-bold text-red-600"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-surface-muted flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Password: <strong>paramedic123</strong> • Secure clinical link</span>
            </div>

            <button
              type="submit"
              className={`w-full text-white font-black text-xs py-3 rounded-xl shadow-sm transition ${
                isRed ? 'bg-[#B71C1C] hover:bg-[#8B0000]' : 'bg-teal-primary hover:bg-teal-hover'
              }`}
            >
              AUTHENTICATE ATTENDANT SESSION
            </button>
          </form>

          <div className="pt-3 border-t border-surface-border text-center">
            <button
              onClick={() => loginAmbulance('PARA-409', 'paramedic123')}
              className="text-xs font-extrabold text-red-700 bg-red-50 hover:bg-red-100 py-2 px-4 rounded-xl border border-red-200 transition"
            >
              ⚡ Quick Demo 1-Click Login (Dr. Ananya Roy - ALS Lead)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentIncident = 
    emergencies.find((e) => e.assignedAmbulanceId === ambulanceAuth.id || e.assignedAmbulanceCallsign === ambulanceAuth.callsign) ||
    (citizenIncident?.assignedAmbulanceId === ambulanceAuth.id ? citizenIncident : null) ||
    citizenIncident ||
    emergencies[0];
  const activeHospital = selectedHospitalForAmbulance || (currentIncident?.destinationHospital ? currentIncident.destinationHospital : null);
  const activeDecision = activeHospital ? hospitalDecisions[activeHospital.id] : null;

  const handleAssessmentSubmit = (e) => {
    e.preventDefault();
    submitAttendantAssessment(currentIncident ? currentIncident.id : 'inc-901', {
      isConscious,
      isBreathingProperly,
      pulseStatus,
      severeBleeding,
      pulseBpm,
      spo2,
      bp
    });
  };

  return (
    <div className="space-y-6">
      {/* Attendant Header Bar */}
      <div className={`text-white p-5 sm:p-6 rounded-3xl shadow-subtle flex flex-wrap items-center justify-between gap-4 ${
        isRed ? 'bg-[#8B0000]' : 'bg-teal-deep'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold shadow-md">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                Active Responder Unit
              </span>
              <h1 className="text-xl sm:text-2xl font-black">{ambulanceAuth.name}</h1>
            </div>
            <p className="text-xs text-white/80 mt-0.5">
              Assigned: <strong>{ambulanceAuth.callsign}</strong> • Badge: <span className="font-mono">{ambulanceAuth.badgeId}</span>
            </p>
          </div>
        </div>

        <button
          onClick={logoutAmbulance}
          className="text-xs font-bold text-red-200 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Logout Session
        </button>
      </div>

      {/* Main Grid: On-Scene Clinical Questions & Nearest Hospital Selector / Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: The 3 Clinical Assessment Questions */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-surface-card rounded-3xl border border-surface-border p-5 sm:p-6 shadow-subtle space-y-4">
            <div className="border-b border-surface-border pb-3">
              <span className="text-xs font-black uppercase text-red-700 tracking-wider">
                Clinical On-Scene Assessment
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">
                Examine Patient & Transmit to Hospital
              </h2>
              <p className="text-xs text-surface-muted">
                Answer these 3 clinical questions. When you click a hospital on the right, your assessment is sent to their ER desk.
              </p>
            </div>

            <form onSubmit={handleAssessmentSubmit} className="space-y-4">
              {/* Question 1 */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1.5">
                  1. Is the person conscious? <span className="text-emergency-red">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'conscious', label: 'Conscious & Alert' },
                    { id: 'semi-conscious', label: 'Semi-conscious' },
                    { id: 'unconscious', label: 'Unconscious' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIsConscious(opt.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                        isConscious === opt.id
                          ? 'border-red-600 bg-red-600 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2 */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1.5">
                  2. Is the person breathing properly? <span className="text-emergency-red">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'labored', label: 'Labored / Gasping' },
                    { id: 'not-breathing', label: 'Not Breathing' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIsBreathingProperly(opt.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                        isBreathingProperly === opt.id
                          ? 'border-red-600 bg-red-600 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 3 */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1.5">
                  3. Is the pulse normal? <span className="text-emergency-red">*</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'rapid', label: 'Rapid (>100)' },
                    { id: 'weak', label: 'Weak (<60)' },
                    { id: 'none', label: 'No Pulse' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPulseStatus(opt.id)}
                      className={`p-2 rounded-xl border text-xs font-bold transition text-center ${
                        pulseStatus === opt.id
                          ? 'border-red-600 bg-red-600 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional vital controls */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Severe Bleeding?</span>
                    <span className="text-[10px] text-surface-muted">Requires transfusion</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSevereBleeding(!severeBleeding)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                      severeBleeding ? 'bg-emergency-red text-white' : 'bg-white border text-slate-700'
                    }`}
                  >
                    {severeBleeding ? 'YES' : 'NO'}
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Pulse & SpO2</span>
                    <span className="text-[10px] text-surface-muted">Oximeter</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800">{pulseBpm} bpm • {spo2}%</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition ${
                  isRed ? 'bg-[#B71C1C] hover:bg-[#8B0000]' : 'bg-teal-primary hover:bg-teal-hover'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>SAVE CLINICAL ASSESSMENT</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: NEAREST HOSPITALS (NAMES ONLY - NO RESOURCES!) & TRACKING MAP */}
        <div className="lg:col-span-6 space-y-4">
          {/* NEAREST HOSPITALS LIST */}
          <div className="bg-surface-card rounded-3xl border border-surface-border p-5 sm:p-6 shadow-subtle space-y-3">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Select Nearest Hospital Destination</h3>
                <p className="text-xs text-surface-muted">
                  Click a hospital name below to start tracking and query their emergency desk:
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {hospitals.length} Nearby Centers
              </span>
            </div>

            {/* List of Hospitals: Names & Distance ONLY (No resource counts!) */}
            <div className="space-y-2.5">
              {hospitals.map((hosp) => {
                const isSelected = activeHospital?.id === hosp.id;
                const decision = hospitalDecisions[hosp.id];
                const isHospDeclined = decision === 'declined';
                const isHospAccepted = decision === 'accepted';

                return (
                  <div
                    key={hosp.id}
                    onClick={() => selectHospitalForAmbulance(hosp, currentIncident?.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? isHospDeclined
                          ? 'border-red-500 bg-red-50/80 ring-2 ring-red-400'
                          : isHospAccepted
                            ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400'
                            : 'border-red-600 bg-red-50/50 ring-2 ring-red-600/30'
                        : isHospDeclined
                          ? 'border-red-200 bg-red-50/30 opacity-70'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected 
                          ? isHospDeclined ? 'bg-red-600 text-white' : isHospAccepted ? 'bg-emerald-600 text-white' : 'bg-red-700 text-white'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">{hosp.name}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span>{hosp.distanceKm} km away</span>
                          <span>•</span>
                          <span>ETA ~{hosp.estimatedMinutes} mins</span>
                          <span>•</span>
                          <span>{hosp.address}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0 text-right">
                      {isHospDeclined ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-white bg-red-600 px-2.5 py-1 rounded-full shadow-xs">
                          <XCircle className="w-3 h-3" />
                          Declined: No Resources
                        </span>
                      ) : isHospAccepted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-white bg-emerald-600 px-2.5 py-1 rounded-full shadow-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Accepted / Reserved
                        </span>
                      ) : isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-700 bg-white px-2.5 py-1 rounded-full border border-red-300">
                          <Radio className="w-3 h-3 text-red-600 animate-pulse" />
                          Tracking & Querying ER
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-600 group-hover:text-red-700 flex items-center gap-1">
                          Select <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clean High Tracking Map (Origin to Selected Hospital) */}
          {activeHospital ? (
            <div className="bg-surface-card rounded-3xl border border-surface-border p-4 shadow-subtle space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emergency-red animate-pulse" />
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm">
                    {activeDecision === 'declined' ? (
                      <span className="text-red-700">Declined by {activeHospital.name} — Please Select Another Hospital!</span>
                    ) : activeDecision === 'accepted' ? (
                      <span className="text-emerald-700">Accepted by {activeHospital.name} — Route Confirmed!</span>
                    ) : (
                      <span>Tracking Route to {activeHospital.name}</span>
                    )}
                  </h3>
                </div>
                <span className="text-[11px] font-black text-emergency-red bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                  ETA ~{activeHospital.estimatedMinutes || 6}m ({activeHospital.distanceKm} km)
                </span>
              </div>

              <MapView
                userLocation={{ lat: 19.0720, lng: 72.8730, address: 'Ambulance Current Position' }}
                activeRouteTarget={activeHospital}
                height="440px"
                originLabel="Ambulance Current Location"
              />
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 text-xs text-surface-muted">
              Click any hospital above to start GPS tracking and query that hospital's ER desk.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
