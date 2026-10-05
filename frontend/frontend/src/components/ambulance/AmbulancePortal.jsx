import React, { useState } from 'react';
import {
  Truck, User, KeyRound, Stethoscope, Navigation, Building2,
  LogOut, CheckCircle2, XCircle, Clock, Radio, ChevronRight,
  ShieldCheck, AlertTriangle, Activity, Heart, Wind, Droplet,
  ArrowRight, MapPin,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { MapView } from '../common/MapView';

// ── Option group buttons ──────────────────────────────────────────────────────
const OptionGroup = ({ options, value, onChange }) => (
  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
    {options.map(opt => (
      <button
        key={opt.id}
        type="button"
        onClick={() => onChange(opt.id)}
        className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition text-center
          ${value === opt.id
            ? 'border-red-700/70 bg-red-950/40 text-red-300'
            : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white'
          }
        `}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ── Vital row ─────────────────────────────────────────────────────────────────
const VitalRow = ({ label, icon: Icon, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[rgba(255,255,255,0.4)] mb-1.5">
      <Icon className="w-3 h-3" />
      {label} <span className="text-red-500">*</span>
    </label>
    {children}
  </div>
);

// ── Hospital row ──────────────────────────────────────────────────────────────
const HospitalRow = ({ hosp, isSelected, decision, onSelect }) => {
  const isDec = decision === 'declined';
  const isAcc = decision === 'accepted';
  return (
    <div
      onClick={() => onSelect(hosp)}
      className={`flex items-center justify-between gap-3 p-4 rounded-2xl border cursor-pointer transition-all
        ${isSelected
          ? isAcc  ? 'border-emerald-700/70 bg-emerald-950/20 ring-1 ring-emerald-600/30'
          : isDec  ? 'border-red-700/60 bg-red-950/15 ring-1 ring-red-600/30'
                   : 'border-red-700/60 bg-red-950/15 ring-1 ring-red-500/30'
          : isDec  ? 'border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] opacity-55'
                   : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.05)]'
        }
      `}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border
          ${isSelected && isAcc ? 'bg-emerald-800/40 border-emerald-700/50 text-emerald-300'
          : isSelected && isDec ? 'bg-red-900/40 border-red-800/50 text-red-300'
          : isSelected          ? 'bg-red-900/40 border-red-800/50 text-red-300'
                                : 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)]'}
        `}>
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-sm text-white truncate">{hosp.name}</h4>
          <div className="flex items-center gap-2 text-[10px] text-[rgba(255,255,255,0.4)] mt-0.5">
            <span>{hosp.distanceKm ?? '?'} km</span>
            <span>•</span>
            <span>ETA ~{hosp.estimatedMinutes ?? '?'}m</span>
            {hosp.tier && <><span>•</span><span>Tier {hosp.tier}</span></>}
          </div>
        </div>
      </div>
      <div className="shrink-0">
        {isDec ? <span className="badge badge-red"><XCircle className="w-2.5 h-2.5" />Declined</span>
        : isAcc ? <span className="badge badge-emerald"><CheckCircle2 className="w-2.5 h-2.5" />Accepted</span>
        : isSelected ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-300">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> Querying
          </span>
        ) : <ChevronRight className="w-4 h-4 text-[rgba(255,255,255,0.25)]" />}
      </div>
    </div>
  );
};

// ── Main portal ──────────────────────────────────────────────────────────────
export const AmbulancePortal = () => {
  const {
    ambulanceAuth, loginAmbulance, logoutAmbulance,
    citizenIncident, hospitals, emergencies, hospitalDecisions,
    selectedHospitalForAmbulance, selectHospitalForAmbulance,
    submitAttendantAssessment, showToast, userLocation,
    recommendedHospitals,
  } = useCrisisCare();

  const [badgeId, setBadgeId]             = useState('PARA-409');
  const [password, setPassword]           = useState('paramedic123');
  const [isConscious, setIsConscious]     = useState('semi-conscious');
  const [isBreathing, setIsBreathing]     = useState('labored');
  const [pulseStatus, setPulseStatus]     = useState('rapid');
  const [bleeding, setBleeding]           = useState(true);
  const [pulseBpm, setPulseBpm]           = useState(108);
  const [spo2, setSpo2]                   = useState(91);
  const [bp, setBp]                       = useState('115/78');
  const [assessSaved, setAssessSaved]     = useState(false);

  // ── Login screen ─────────────────────────────────────────────────────────
  if (!ambulanceAuth) {
    return (
      <div className="max-w-md mx-auto py-8 animate-fade-in">
        <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.1)] p-6 sm:p-8 space-y-6 shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center mx-auto mb-3">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">Ambulance Attendant Login</h1>
            <p className="text-xs text-[rgba(255,255,255,0.4)] mt-1">Ambulance Driver &amp; Paramedic App</p>
          </div>

          <form onSubmit={e => { e.preventDefault(); loginAmbulance(badgeId, password); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Paramedic Badge ID
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] absolute left-3.5 top-3" />
                <input
                  type="text" value={badgeId} onChange={e => setBadgeId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-amber-600/60 placeholder-[rgba(255,255,255,0.25)]"
                  style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Access Password
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] absolute left-3.5 top-3" />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-amber-600/60"
                  style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[11px] text-[rgba(255,255,255,0.4)]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Demo password: <strong className="text-white font-mono">paramedic123</strong>
            </div>

            <button type="submit" className="w-full py-3 rounded-xl font-black text-xs text-white bg-amber-700 hover:bg-amber-600 transition">
              AUTHENTICATE ATTENDANT SESSION
            </button>
          </form>

          <div className="pt-2 border-t border-[rgba(255,255,255,0.07)] text-center">
            <button
              onClick={() => loginAmbulance('PARA-409', 'paramedic123')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
            >
              ⚡ 1-Click Demo Login — Dr. Ananya Roy (ALS Lead)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Logged in view ───────────────────────────────────────────────────────
  const currentIncident =
    emergencies.find(e => e.assignedAmbulanceId === ambulanceAuth.assignedAmbulanceId) ||
    (citizenIncident?.assignedAmbulanceId === ambulanceAuth.assignedAmbulanceId ? citizenIncident : null) ||
    citizenIncident || emergencies[0];

  const activeHospital  = selectedHospitalForAmbulance;
  const activeDecision  = activeHospital ? hospitalDecisions[activeHospital.id] : null;

  const handleAssessmentSubmit = e => {
    e.preventDefault();
    submitAttendantAssessment(currentIncident?.id || 'inc-demo', {
      isConscious, isBreathingProperly: isBreathing, pulseStatus,
      severeBleeding: bleeding, pulseBpm, spo2, bp,
    });
    setAssessSaved(true);
    setTimeout(() => setAssessSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1a1000] to-[#0d1117] border border-amber-900/40 rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-900/40 border border-amber-800/40 flex items-center justify-center">
            <Truck className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="badge badge-amber">Active Responder</span>
            </div>
            <h1 className="text-lg font-black text-white">{ambulanceAuth.name}</h1>
            <p className="text-xs text-[rgba(255,255,255,0.4)]">
              {ambulanceAuth.callsign} • Badge: <span className="font-mono">{ambulanceAuth.badgeId}</span>
            </p>
          </div>
        </div>
        <button
          onClick={logoutAmbulance}
          className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </div>

      {/* ── Current incident banner ───────────────────────────────────────── */}
      {currentIncident && (
        <div className="glass-dark rounded-2xl border border-[rgba(255,255,255,0.07)] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-semibold text-white">
              Active Incident: <strong>{currentIncident.patientCategory || currentIncident.type}</strong>
            </span>
            <span className="text-[10px] text-[rgba(255,255,255,0.4)]">— {currentIncident.locationName}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-300 font-mono">
              {currentIncident.lat?.toFixed(4) ?? '—'}, {currentIncident.lng?.toFixed(4) ?? '—'}
            </span>
          </div>
        </div>
      )}

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Clinical assessment */}
        <div className="lg:col-span-5">
          <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.07)] p-5 space-y-5">
            <div className="border-b border-[rgba(255,255,255,0.07)] pb-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Patient Check — At Scene</span>
              <h2 className="text-sm font-black text-white mt-0.5">How is the Patient Right Now?</h2>
              <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-0.5">
                Answer 3 quick questions — the system will find the best hospital.
              </p>
            </div>

            <form onSubmit={handleAssessmentSubmit} className="space-y-4">
              <VitalRow label="Consciousness" icon={Activity}>
                <OptionGroup
                  options={[{ id: 'conscious', label: 'Alert' }, { id: 'semi-conscious', label: 'Semi-conscious' }, { id: 'unconscious', label: 'Unconscious' }]}
                  value={isConscious} onChange={setIsConscious}
                />
              </VitalRow>

              <VitalRow label="Breathing" icon={Wind}>
                <OptionGroup
                  options={[{ id: 'normal', label: 'Breathing OK' }, { id: 'labored', label: 'Difficulty' }, { id: 'not-breathing', label: 'Not Breathing' }]}
                  value={isBreathing} onChange={setIsBreathing}
                />
              </VitalRow>

              <VitalRow label="Pulse" icon={Heart}>
                <OptionGroup
                  options={[{ id: 'normal', label: 'Normal' }, { id: 'rapid', label: 'Rapid >100' }, { id: 'weak', label: 'Weak <60' }, { id: 'none', label: 'No Pulse' }]}
                  value={pulseStatus} onChange={setPulseStatus}
                />
              </VitalRow>

              {/* Numeric vitals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[rgba(255,255,255,0.03)] rounded-xl border border-[rgba(255,255,255,0.07)] p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-white block">Severe Bleeding?</span>
                    <span className="text-[9px] text-[rgba(255,255,255,0.3)]">Needs transfusion</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBleeding(v => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${bleeding ? 'bg-red-600 text-white' : 'bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.6)]'}`}
                  >
                    {bleeding ? 'YES' : 'NO'}
                  </button>
                </div>
                <div className="bg-[rgba(255,255,255,0.03)] rounded-xl border border-[rgba(255,255,255,0.07)] p-3">
                  <span className="text-[10px] font-bold text-white block mb-1">Pulse / Blood Oxygen</span>
                  <span className="text-xs font-mono font-bold text-amber-300">{pulseBpm} bpm • SpO₂ {spo2}%</span>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition
                  ${assessSaved
                    ? 'bg-emerald-800 text-emerald-100 border border-emerald-700/60'
                    : 'bg-amber-700 hover:bg-amber-600 text-white'
                  }
                `}
              >
                {assessSaved ? <><CheckCircle2 className="w-4 h-4" /> Assessment Saved!</> : <><Stethoscope className="w-4 h-4" /> Save Clinical Assessment</>}
              </button>
            </form>
          </div>
        </div>

        {/* Hospital selector + map */}
        <div className="lg:col-span-7 space-y-4">
          {/* Hospital list */}
          <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.07)] p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3">
              <div>
                <h3 className="font-black text-white text-sm">Best Hospitals for This Patient</h3>
                <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-0.5">Ranked by available beds, distance &amp; ambulance time</p>
              </div>
              {recommendedHospitals?.length > 0 && (
                <span className="badge badge-emerald">{recommendedHospitals.length} matches</span>
              )}
            </div>
          <div className="space-y-2">
              {(!recommendedHospitals || recommendedHospitals.length === 0) ? (
                <div className="text-center py-4 text-xs text-[rgba(255,255,255,0.4)]">
                  Submit clinical assessment to calculate best routes.
                </div>
              ) : (
                recommendedHospitals.map((hosp, idx) => (
                  <div key={hosp.id}>
                    {idx === 0 && (
                      <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                        <span className="badge badge-emerald text-[10px]">
                          ✦ ML Recommended
                        </span>
                        {hosp.estimatedMinutes != null && (
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">
                            ETA ~{hosp.estimatedMinutes} min · {hosp.distanceKm ?? '?'} km
                          </span>
                        )}
                      </div>
                    )}
                    {idx === 1 && (
                      <p className="text-[10px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider font-bold mt-3 mb-1 ml-1">
                        Other options
                      </p>
                    )}
                    <HospitalRow
                      hosp={hosp}
                      isSelected={activeHospital?.id === hosp.id}
                      decision={hospitalDecisions[hosp.id]}
                      onSelect={h => selectHospitalForAmbulance(h, currentIncident?.id)}
                    />
                  </div>
                ))
              )}
            </div>

          </div>

          {/* Map */}
          {activeHospital ? (
            <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.07)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className={`w-4 h-4 animate-pulse ${activeDecision === 'accepted' ? 'text-emerald-400' : activeDecision === 'declined' ? 'text-red-400' : 'text-amber-400'}`} />
                  <span className="text-xs font-bold text-white">
                    {activeDecision === 'accepted' ? `Accepted by ${activeHospital.name} ✓`
                    : activeDecision === 'declined' ? `Declined by ${activeHospital.name} — Choose Another`
                    : `Routing to ${activeHospital.name}…`}
                  </span>
                </div>
                <span className="badge badge-amber font-mono">ETA ~{activeHospital.estimatedMinutes ?? '?'}m ({activeHospital.distanceKm ?? '?'} km)</span>
              </div>
              <MapView
                userLocation={userLocation}
                activeRouteTarget={activeHospital}
                height="420px"
                originLabel="Ambulance Location"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 glass-dark rounded-3xl border border-[rgba(255,255,255,0.06)] text-center gap-2">
              <Navigation className="w-6 h-6 text-[rgba(255,255,255,0.15)]" />
              <p className="text-xs text-[rgba(255,255,255,0.3)]">Select a hospital above to view GPS route</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
