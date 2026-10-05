import React, { useState, useEffect } from 'react';
import {
  Building2, BedDouble, Wind, Plus, Minus, Clock, CheckCircle2,
  AlertCircle, Truck, HeartHandshake, Shield, Activity, Save,
  LogOut, XCircle, KeyRound, Stethoscope, Scan, HeartPulse,
  Radio, UserCheck, Edit2, RefreshCw, Wifi, ChevronDown, ChevronUp,
  Droplets, Package, AlertTriangle,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

// ── Resource label map ────────────────────────────────────────────────────────
const RESOURCE_LABELS = {
  icu_bed:                       { label: 'ICU Beds',                  icon: BedDouble,    unit: 'beds',    color: 'red' },
  ventilator:                    { label: 'Ventilators',               icon: Wind,         unit: 'units',   color: 'amber' },
  oxygen_cylinder:               { label: 'Oxygen Cylinders',          icon: Wind,         unit: 'units',   color: 'sky' },
  blood_a_pos:                   { label: 'Blood A+',                  icon: Droplets,     unit: 'units',   color: 'rose' },
  blood_a_neg:                   { label: 'Blood A−',                  icon: Droplets,     unit: 'units',   color: 'rose' },
  blood_b_pos:                   { label: 'Blood B+',                  icon: Droplets,     unit: 'units',   color: 'rose' },
  blood_b_neg:                   { label: 'Blood B−',                  icon: Droplets,     unit: 'units',   color: 'rose' },
  blood_o_pos:                   { label: 'Blood O+',                  icon: Droplets,     unit: 'units',   color: 'rose' },
  blood_o_neg:                   { label: 'Blood O−',                  icon: Droplets,     unit: 'units',   color: 'rose' },
  blood_ab_pos:                  { label: 'Blood AB+',                 icon: Droplets,     unit: 'units',   color: 'rose' },
  blood_ab_neg:                  { label: 'Blood AB−',                 icon: Droplets,     unit: 'units',   color: 'rose' },
  specialist_trauma_surgeon:     { label: 'Trauma Surgeons',           icon: Stethoscope,  unit: 'on-duty', color: 'emerald' },
  specialist_cardiologist:       { label: 'Cardiologists',             icon: HeartPulse,   unit: 'on-duty', color: 'emerald' },
  specialist_neurologist:        { label: 'Neurologists',              icon: Activity,     unit: 'on-duty', color: 'emerald' },
  specialist_pediatric_er:       { label: 'Pediatric ER',              icon: UserCheck,    unit: 'on-duty', color: 'emerald' },
  specialist_orthopedic_surgeon: { label: 'Orthopedic Surgeons',       icon: Stethoscope,  unit: 'on-duty', color: 'emerald' },
  specialist_obstetrician:       { label: 'Obstetricians',             icon: UserCheck,    unit: 'on-duty', color: 'emerald' },
  specialist_pediatrician:       { label: 'Pediatricians',             icon: UserCheck,    unit: 'on-duty', color: 'emerald' },
  equipment_ct_scanner:          { label: 'CT Scanners',               icon: Scan,         unit: 'units',   color: 'blue' },
  equipment_mri_trauma_ready:    { label: 'MRI (Trauma-Ready)',         icon: Scan,         unit: 'units',   color: 'blue' },
  equipment_dialysis:            { label: 'Dialysis Machines',         icon: Activity,     unit: 'units',   color: 'blue' },
  antivenom:                     { label: 'Antivenom',                 icon: Package,      unit: 'vials',   color: 'amber' },
  labor_delivery_bed:            { label: 'Labor & Delivery Beds',     icon: BedDouble,    unit: 'beds',    color: 'pink' },
  pediatric_icu_bed:             { label: 'Pediatric ICU Beds',        icon: BedDouble,    unit: 'beds',    color: 'pink' },
};

const COLOR_MAP = {
  red:     'text-red-400 bg-red-950/20 border-red-900/30',
  amber:   'text-amber-400 bg-amber-950/20 border-amber-900/30',
  emerald: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30',
  sky:     'text-sky-400 bg-sky-950/20 border-sky-900/30',
  blue:    'text-blue-400 bg-blue-950/20 border-blue-900/30',
  rose:    'text-rose-400 bg-rose-950/20 border-rose-900/30',
  pink:    'text-pink-400 bg-pink-950/20 border-pink-900/30',
  slate:   'text-slate-400 bg-slate-900/20 border-slate-700/30',
};

// ── Resource inventory row ────────────────────────────────────────────────────
const ResourceRow = ({ resource, onAdjust, saving }) => {
  const meta = RESOURCE_LABELS[resource.resource_type] || {
    label: resource.resource_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: Package, unit: 'units', color: 'slate',
  };
  const Icon = meta.icon;
  const colors = COLOR_MAP[meta.color] || COLOR_MAP.slate;
  const qty = resource.quantity_available;
  const isLow = qty <= 2;
  const isZero = qty === 0;

  return (
    <div className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all
      ${isZero ? 'bg-red-950/15 border-red-900/30' : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.12)]'}
    `}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${colors}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-xs font-semibold text-white block truncate">{meta.label}</span>
          <span className="text-[10px] text-[rgba(255,255,255,0.3)]">{meta.unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onAdjust(resource.id, qty - 1)}
          disabled={qty === 0 || saving}
          className="w-7 h-7 rounded-lg bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] text-white font-bold flex items-center justify-center transition disabled:opacity-30"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className={`font-black text-sm w-6 text-center ${isZero ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white'}`}>
          {qty}
        </span>
        <button
          onClick={() => onAdjust(resource.id, qty + 1)}
          disabled={saving}
          className="w-7 h-7 rounded-lg bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] text-white font-bold flex items-center justify-center transition disabled:opacity-30"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// ── Incoming proposal card ────────────────────────────────────────────────────
const IncomingProposalCard = ({ proposal, onAccept, onDecline }) => {
  const [declining, setDeclining] = useState(false);
  const reservationId = proposal.reservation_ids?.[0];

  return (
    <div className="rounded-2xl border border-red-800/60 bg-red-950/20 p-5 space-y-4 animate-scale-in glow-red">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-xs font-black uppercase text-red-300 tracking-wider">Incoming Ambulance Request</span>
          </div>
          <span className="badge badge-red">
            {proposal.triage_category?.replace(/_/g, ' ') || 'Emergency'}
          </span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] text-[rgba(255,255,255,0.4)]">Incident</span>
          <p className="text-xs font-mono font-bold text-white">#{proposal.incident_id}</p>
        </div>
      </div>

      {/* Scene info */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-2.5">
          <span className="text-[rgba(255,255,255,0.35)] block">ETA to Your ER</span>
          <strong className="text-amber-300">{proposal.selected_hospital?.eta_minutes ?? '?'} min</strong>
        </div>
        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-2.5">
          <span className="text-[rgba(255,255,255,0.35)] block">Resources Needed</span>
          <strong className="text-white">{(proposal.required_resources || []).join(', ').replace(/_/g, ' ') || 'ICU Bed'}</strong>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onDecline(reservationId)}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-sm font-bold text-white transition"
        >
          <XCircle className="w-4 h-4 text-red-400" />
          Decline
        </button>
        <button
          onClick={() => onAccept(reservationId)}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-sm font-black text-white transition"
        >
          <CheckCircle2 className="w-4 h-4" />
          Accept Patient
        </button>
      </div>
    </div>
  );
};

// ── Main portal ──────────────────────────────────────────────────────────────
export const HospitalPortal = () => {
  const {
    hospitals, hospitalAuth, loginHospital, logoutHospital,
    emergencies, citizenIncident, respondToAmbulance,
    updateHospitalInventory, updateSurgeonAvailability,
    myInventory, inventoryLoading, loadInventory,
    incomingProposal, confirmReservation, releaseReservation,
    showToast, backendOnline,
  } = useCrisisCare();

  const [selectedHospId, setSelectedHospId] = useState(hospitals[0]?.id || 1);
  const [username, setUsername]             = useState(hospitals[0]?.seed_key || 'kem_mumbai');
  const [password, setPassword]             = useState('CareHosp@001');
  const [saving, setSaving]                 = useState(false);
  const [showBlood, setShowBlood]           = useState(false);

  // ── Login screen ─────────────────────────────────────────────────────────
  if (!hospitalAuth) {
    return (
      <div className="max-w-md mx-auto py-8 animate-fade-in">
        <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.1)] p-6 sm:p-8 space-y-6 shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center mx-auto mb-3 shadow-glow-red">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">Hospital ER Staff Login</h1>
            <p className="text-xs text-[rgba(255,255,255,0.4)] mt-1">
              Select your facility and authenticate to manage inventory
            </p>
          </div>

          <form
            onSubmit={e => { e.preventDefault(); loginHospital(username, password); }}
            className="space-y-4"
          >
            {/* Hospital selector */}
            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Select Medical Facility
              </label>
              <select
                value={selectedHospId}
                onChange={e => {
                  const hosp = hospitals.find(h => String(h.id) === String(e.target.value));
                  setSelectedHospId(e.target.value);
                  setUsername(hosp?.seed_key || '');
                }}
                className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-red-600/60"
                style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
              >
                {hospitals.map(h => (
                  <option key={h.id} value={h.id} style={{ background: '#111827', color: '#fff' }}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Email / username */}
            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Staff Email / Clinician ID
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-red-600/60 placeholder-[rgba(255,255,255,0.25)]"
                style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Access Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-red-600/60"
                style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                required
              />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[11px] text-[rgba(255,255,255,0.4)]">
              <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Username auto-fills from hospital selector. Passwords in <strong className="text-white font-mono">hospital_admin_credentials.csv</strong>
            </div>

            <button type="submit" className="btn-emergency w-full py-3 rounded-xl text-xs font-black">
              AUTHENTICATE EMERGENCY DESK
            </button>
          </form>

          {/* Quick-login shortcuts */}
          <div className="pt-2 border-t border-[rgba(255,255,255,0.07)]">
            <p className="text-[11px] text-[rgba(255,255,255,0.3)] text-center mb-2">Quick demo access:</p>
            <div className="grid grid-cols-2 gap-2">
              {hospitals.slice(0, 4).map((h, idx) => (
                <button
                  key={h.id}
                  onClick={() => loginHospital(h.seed_key, `CareHosp@${String(idx + 1).padStart(3, '0')}`)}
                  className="text-[11px] font-semibold text-[rgba(255,255,255,0.6)] hover:text-white bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] py-2 px-3 rounded-xl border border-[rgba(255,255,255,0.07)] transition text-left truncate"
                >
                  🏥 {h.name.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated view ───────────────────────────────────────────────────
  const currentHospital = hospitals.find(h => h.id === hospitalAuth.hospitalId) || hospitals[0];
  // Prefer real inventory from API, fallback to hospital.resources from mock
  const displayResources = myInventory?.resources || currentHospital?.resources || [];
  const surgeon = currentHospital?.surgeon || { isAvailable: true, name: 'Dr. Sharma (Trauma)', specialty: 'Trauma Surgery' };

  // Incoming emergencies targeting this hospital (from mock/context)
  const incomingEmergencies = emergencies.filter(e => e.targetHospitalId === currentHospital?.id);

  const handleAdjust = async (resourceId, newQty) => {
    if (newQty < 0) return;
    setSaving(true);
    try {
      await updateHospitalInventory(resourceId, newQty);
    } finally {
      setSaving(false);
    }
  };

  // Split resources into categories
  const bedResources       = displayResources.filter(r => ['icu_bed', 'labor_delivery_bed', 'pediatric_icu_bed'].includes(r.resource_type));
  const bloodResources     = displayResources.filter(r => r.resource_type.startsWith('blood_'));
  const specialistRes      = displayResources.filter(r => r.resource_type.startsWith('specialist_'));
  const equipmentRes       = displayResources.filter(r => r.resource_type.startsWith('equipment_'));
  const otherRes           = displayResources.filter(r => ['ventilator', 'oxygen_cylinder', 'antivenom'].includes(r.resource_type));

  const ResourceSection = ({ title, resources }) => {
    if (!resources.length) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-[rgba(255,255,255,0.35)] px-1">{title}</h4>
        {resources.map(r => (
          <ResourceRow key={r.id} resource={r} onAdjust={handleAdjust} saving={saving} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1a0a0a] to-[#0d1117] border border-red-900/40 rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-900/40 border border-red-800/40 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="badge badge-emerald">ER Authenticated</span>
              {backendOnline && <span className="badge badge-slate flex items-center gap-1"><Wifi className="w-2.5 h-2.5" />Live SSE</span>}
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white">{currentHospital?.name}</h1>
            <p className="text-xs text-[rgba(255,255,255,0.4)]">
              Logged in as <strong className="text-[rgba(255,255,255,0.7)]">{hospitalAuth.username}</strong> — {hospitalAuth.role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {backendOnline && (
            <button
              onClick={loadInventory}
              disabled={inventoryLoading}
              className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${inventoryLoading ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}
          <button
            onClick={logoutHospital}
            className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-300 hover:text-red-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </div>

      {/* ── Real SSE incoming proposal (highest priority) ──────────────── */}
      {incomingProposal && (
        <IncomingProposalCard
          proposal={incomingProposal}
          onAccept={reservationId => confirmReservation(reservationId)}
          onDecline={reservationId => releaseReservation(reservationId)}
        />
      )}

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: incoming ambulances (mock/context-based) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.07)] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                <h2 className="font-black text-white text-sm">Ambulance Requests</h2>
              </div>
              <span className="badge badge-red">{incomingEmergencies.length} Active</span>
            </div>

            <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed">
              Check available ICU beds & surgeons on the right. Click <strong className="text-white">Accept</strong> to reserve, or <strong className="text-white">Decline</strong> to re-route.
            </p>

            {incomingEmergencies.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                <Radio className="w-6 h-6 text-[rgba(255,255,255,0.15)] mx-auto mb-2" />
                <p className="text-xs text-[rgba(255,255,255,0.25)]">No active ambulances targeting this facility</p>
                <p className="text-[10px] text-[rgba(255,255,255,0.15)] mt-0.5">SSE channel listening…</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingEmergencies.map(inc => {
                  const isAcc = inc.hospitalResponse === 'accepted';
                  const isDec = inc.hospitalResponse === 'declined';
                  return (
                    <div key={inc.id} className={`p-4 rounded-2xl border space-y-3 transition
                      ${isAcc ? 'border-emerald-800/50 bg-emerald-950/20' : isDec ? 'border-[rgba(255,255,255,0.06)] opacity-60' : 'border-red-800/50 bg-red-950/15'}
                    `}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-white block">{inc.assignedAmbulanceCallsign || 'Delta-101 ALS'}</span>
                          <span className="text-[10px] text-[rgba(255,255,255,0.4)]">Paramedic: {inc.paramedicName || 'En route'}</span>
                        </div>
                        <span className="badge badge-red">ETA ~{inc.etaMinutes || 4}m</span>
                      </div>

                      {/* Clinical telemetry */}
                      {inc.assessment && (
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 border border-[rgba(255,255,255,0.07)] text-[11px] grid grid-cols-2 gap-1.5">
                          <div><span className="text-[rgba(255,255,255,0.4)]">Conscious:</span> <strong className="text-white">{inc.assessment.isConscious}</strong></div>
                          <div><span className="text-[rgba(255,255,255,0.4)]">Breathing:</span> <strong className="text-white">{inc.assessment.isBreathingProperly}</strong></div>
                          <div><span className="text-[rgba(255,255,255,0.4)]">Pulse:</span> <strong className="text-white">{inc.assessment.pulseBpm} bpm</strong></div>
                          <div><span className="text-[rgba(255,255,255,0.4)]">SpO₂:</span> <strong className="text-white">{inc.assessment.spo2}%</strong></div>
                        </div>
                      )}

                      {/* Actions */}
                      {!isAcc && !isDec && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => respondToAmbulance(inc.id, 'declined')}
                            className="py-2.5 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-xs font-bold text-[rgba(255,255,255,0.7)] flex items-center justify-center gap-1.5 transition"
                          >
                            <XCircle className="w-3.5 h-3.5 text-red-400" /> Decline
                          </button>
                          <button
                            onClick={() => respondToAmbulance(inc.id, 'accepted')}
                            className="py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-xs font-black text-white flex items-center justify-center gap-1.5 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                          </button>
                        </div>
                      )}
                      {isAcc && <div className="badge badge-emerald w-full justify-center py-2">✓ Accepted — Trauma Bay Reserved</div>}
                      {isDec && <div className="badge badge-slate w-full justify-center py-2">✗ Declined — Ambulance Rerouted</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Surgeon availability */}
          <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.07)] p-5 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-emerald-400" />
              On-Duty Surgeon Status
            </h3>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-white">{surgeon.name}</h4>
                <p className="text-[11px] text-[rgba(255,255,255,0.4)]">{surgeon.specialty}</p>
              </div>
              <button
                onClick={() => updateSurgeonAvailability(currentHospital?.id, !surgeon.isAvailable, surgeon.name, surgeon.specialty)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2
                  ${surgeon.isAvailable
                    ? 'bg-amber-950/40 border border-amber-800/40 text-amber-300 hover:bg-amber-900/50'
                    : 'bg-emerald-700 text-white hover:bg-emerald-600'
                  }
                `}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                {surgeon.isAvailable ? 'Mark In Surgery' : 'Mark Available'}
              </button>
            </div>
            <div className={`rounded-xl border p-3 flex items-center gap-2.5 ${surgeon.isAvailable ? 'border-emerald-800/30 bg-emerald-950/20' : 'border-red-800/30 bg-red-950/20'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${surgeon.isAvailable ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className={`text-xs font-bold ${surgeon.isAvailable ? 'text-emerald-300' : 'text-red-300'}`}>
                {surgeon.isAvailable ? 'Surgeon Available & Ready for Emergency' : 'In Surgery / Currently Unavailable'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: inventory management */}
        <div className="lg:col-span-7">
          <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.07)] p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] pb-3">
              <div>
                <h2 className="font-black text-white text-sm">Live Inventory Management</h2>
                <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-0.5">
                  {backendOnline
                    ? 'Changes sync to DB via Gateway PUT /admin/inventory/:id + SSE broadcast'
                    : 'Demo mode — changes are local only'}
                </p>
              </div>
              {saving && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold">
                  <div className="w-3 h-3 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                  Saving…
                </div>
              )}
            </div>

            {inventoryLoading ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-12 rounded-xl border border-[rgba(255,255,255,0.06)] animate-shimmer" />
                ))}
              </div>
            ) : displayResources.length === 0 ? (
              <div className="text-center py-10 text-xs text-[rgba(255,255,255,0.3)]">
                No inventory loaded. Connect to backend or log out and back in.
              </div>
            ) : (
              <div className="space-y-5 max-h-[600px] overflow-y-auto pr-1">
                <ResourceSection title="Beds" resources={bedResources} />
                <ResourceSection title="Respiratory & Gases" resources={otherRes} />
                <ResourceSection title="Specialists On Duty" resources={specialistRes} />
                <ResourceSection title="Equipment" resources={equipmentRes} />

                {/* Blood bank toggle */}
                <div>
                  <button
                    onClick={() => setShowBlood(v => !v)}
                    className="w-full flex items-center justify-between px-1 py-2 text-[10px] font-black uppercase tracking-wider text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.6)] transition"
                  >
                    <span>Blood Bank ({bloodResources.length} types)</span>
                    {showBlood ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showBlood && <div className="space-y-2 mt-1">{bloodResources.map(r => (
                    <ResourceRow key={r.id} resource={r} onAdjust={handleAdjust} saving={saving} />
                  ))}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
