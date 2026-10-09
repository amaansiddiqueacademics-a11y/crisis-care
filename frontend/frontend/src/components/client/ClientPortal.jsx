import React, { useState, useEffect } from 'react';
import {
  AlertCircle, MapPin, PhoneCall, Users, Car, UserX, Droplet, Wind,
  HeartCrack, HelpCircle, LocateFixed, SendHorizontal, CheckCircle2,
  Clock, Truck, Stethoscope, Building2, ShieldCheck, ChevronRight,
  RotateCcw, UserCheck, AlertTriangle, Brain, Zap, Flame, Activity,
  Baby, Skull, Navigation, Wifi,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { FirstAidGuidance } from './FirstAidGuidance';
import { MapView } from '../common/MapView';

// ── Emergency categories (17 — PRD v5 §3) ───────────────────────────────────
const CATEGORIES = [
  { id: 'Traffic Accident',       label: 'Traffic & Road Accident',      icon: Car,          desc: 'Vehicle collision, bike crash, pedestrian hit', color: 'red' },
  { id: 'Cardiac / Chest Pain',   label: 'Cardiac Arrest / Chest Pain',  icon: HeartCrack,   desc: 'Heart attack symptoms, severe tightness, collapse', color: 'red' },
  { id: 'Breathing Difficulty',   label: 'Breathing / Choking',          icon: Wind,         desc: 'Severe asthma, choking airway, acute dyspnea', color: 'amber' },
  { id: 'Severe Bleeding',        label: 'Severe Bleeding & Trauma',     icon: Droplet,      desc: 'Arterial blood loss, stab wound, hemorrhage', color: 'red' },
  { id: 'Unconscious Person',     label: 'Unconscious / Fainted',        icon: UserX,        desc: 'Unresponsive to voice or shaking, coma', color: 'red' },
  { id: 'Suspected Stroke',       label: 'Suspected Stroke (FAST)',      icon: Brain,        desc: 'Face drooping, slurred speech, arm weakness', color: 'red' },
  { id: 'Seizure / Convulsion',   label: 'Seizure / Epileptic Fit',      icon: Zap,          desc: 'Violent convulsions, foaming, loss of control', color: 'amber' },
  { id: 'Severe Burns',           label: 'Severe Burns / Fire',          icon: Flame,        desc: 'Thermal flame burns, boiling oil, chemical burns', color: 'amber' },
  { id: 'Fall from Height',       label: 'Fall / Spinal Trauma',         icon: Activity,     desc: 'Roof/stairs fall, suspected spinal cord injury', color: 'amber' },
  { id: 'Bone Fracture',          label: 'Fracture / Crush Injury',      icon: AlertTriangle, desc: 'Open compound fracture, crushed or deformed limb', color: 'amber' },
  { id: 'Poisoning',              label: 'Poison / Toxic Ingestion',     icon: Skull,        desc: 'Toxic ingestion, chemical hazard, drug overdose', color: 'red' },
  { id: 'Snakebite & Animal Bite', label: 'Snakebite / Animal Attack',   icon: AlertCircle,  desc: 'Venomous snakebite, rabies risk, severe bite', color: 'amber' },
  { id: 'Pregnancy Emergency',    label: 'Pregnancy / Labor Emergency',  icon: Baby,         desc: 'Imminent labor, severe obstetric hemorrhage', color: 'amber' },
  { id: 'Pediatric Emergency',    label: 'Pediatric / Infant Distress',  icon: Users,        desc: 'Child respiratory failure, high febrile seizure', color: 'amber' },
  { id: 'Allergic Anaphylaxis',   label: 'Severe Allergic Reaction',     icon: ShieldCheck,  desc: 'Throat swelling, anaphylactic shock, acute hives', color: 'red' },
  { id: 'Electric Shock',         label: 'Electric Shock / Electrocution', icon: Zap,        desc: 'High voltage electrocution, electrical burns', color: 'red' },
  { id: 'Other Emergency',        label: 'Other Acute Emergency',        icon: HelpCircle,   desc: 'Unspecified life-threatening critical condition', color: 'slate' },
];

const Stage = ({ num, label, desc, status, icon: Icon }) => {
  const isDone    = status === 'done';
  const isActive  = status === 'active';
  const isPending = status === 'pending';
  return (
    <div className={`p-5 rounded-[1.5rem] border space-y-3 transition-all relative overflow-hidden group
      ${isDone    ? 'bg-emerald-950/20 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : ''}
      ${isActive  ? 'bg-red-950/20 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : ''}
      ${isPending ? 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.04)] opacity-60' : ''}
    `}>
      {isActive && <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full blur-2xl -mr-5 -mt-5 pointer-events-none" />}
      
      <div className="flex items-center justify-between relative z-10">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black
          ${isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
            isActive ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
            'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.3)]'}
        `}>
          {isDone ? <CheckCircle2 className="w-4 h-4" /> : num}
        </div>
        <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded-full
          ${isDone ? 'text-emerald-400 bg-emerald-500/10' : isActive ? 'text-red-400 bg-red-500/10 animate-pulse' : 'text-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.05)]'}
        `}>
          {isDone ? 'Done' : isActive ? 'In Progress' : 'Pending'}
        </span>
      </div>
      <div className="relative z-10 pt-1">
        <h4 className={`text-sm font-black tracking-tight ${isDone || isActive ? 'text-white' : 'text-[rgba(255,255,255,0.3)]'}`}>{label}</h4>
        <p className={`text-[11px] mt-1 leading-relaxed font-medium ${isDone ? 'text-[rgba(255,255,255,0.5)]' : isActive ? 'text-[rgba(255,255,255,0.6)]' : 'text-[rgba(255,255,255,0.2)]'}`}>
          {desc}
        </p>
      </div>
    </div>
  );
};

// ── Category button ──────────────────────────────────────────────────────────
const CategoryBtn = ({ cat, selected, onClick }) => {
  const Icon = cat.icon;
  const isSelected = selected === cat.id;
  return (
    <button
      type="button"
      onClick={() => onClick(cat.id)}
      className={`
        relative p-3 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between gap-2 card-press
        ${isSelected
          ? 'ring-2 ring-[var(--primary)] bg-[var(--primary-soft)] border-[var(--primary)] shadow-sm'
          : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]'
        }
      `}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-muted)] text-[var(--text-secondary)]'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <span className="block text-xs font-bold text-[var(--text-primary)] line-clamp-1">{cat.label}</span>
        <span className="text-[10px] text-[var(--text-secondary)] leading-tight line-clamp-2 mt-0.5">{cat.desc}</span>
      </div>
      {isSelected && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
      )}
    </button>
  );
};

// ── Main portal ──────────────────────────────────────────────────────────────
export const ClientPortal = () => {
  const {
    citizenIncident, reportEmergency, cancelCitizenIncident, startNewCitizenReport,
    userLocation, requestGpsLocation, hospitals, showToast,
  } = useCrisisCare();

  const [selectedCategory, setSelectedCategory] = useState('Traffic Accident');
  const [patientDetails, setPatientDetails]     = useState('');
  const [patientCount, setPatientCount]         = useState(1);
  const [incidentAddress, setIncidentAddress]   = useState(userLocation.address || 'BKC Bandra East, Mumbai');
  const [selectedLoc, setSelectedLoc]           = useState(null);
  const [isLocating, setIsLocating]             = useState(false);
  const [isSubmitting, setIsSubmitting]         = useState(false);

  // Sync address if GPS updates externally
  useEffect(() => {
    if (userLocation.isGpsActive) setIncidentAddress(userLocation.address);
  }, [userLocation.address, userLocation.isGpsActive]);

  const handleCaptureGps = async () => {
    setIsLocating(true);
    try {
      const loc = await requestGpsLocation();
      setIncidentAddress(loc.address);
    } catch (_) { /* toast already shown in context */ }
    finally { setIsLocating(false); }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCategory) {
      showToast('Required', 'Please select an emergency category.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      await reportEmergency({
        emergencyType: selectedCategory,
        patientDetails: patientDetails.trim() || `${selectedCategory} reported at scene`,
        patientCount,
        locationName: incidentAddress,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const destHospital     = citizenIncident?.destinationHospital || hospitals.find(h => h.id === citizenIncident?.targetHospitalId) || hospitals[0];
  const isAccepted       = citizenIncident?.hospitalResponse === 'accepted';
  const isDeclined       = citizenIncident?.hospitalResponse === 'declined';
  const step             = citizenIncident?.statusStep || 1;

  // ── Tracking view ───────────────────────────────────────────────────────────
  if (citizenIncident) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Active incident bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 glass-dark rounded-2xl border border-[rgba(255,255,255,0.08)] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-semibold text-white">
              Active: <strong>{citizenIncident.patientCategory || citizenIncident.type}</strong>
              {' '}— {citizenIncident.locationName}
            </span>
          </div>
          <button
            onClick={startNewCitizenReport}
            className="btn-ghost flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Report New Emergency
          </button>
        </div>

        {/* Status hero */}
        <div className={`rounded-3xl p-7 sm:p-10 relative overflow-hidden border
          ${isAccepted
            ? 'bg-gradient-to-br from-emerald-950 via-emerald-900 to-[#0a1a0f] border-emerald-800/50'
            : 'bg-gradient-to-br from-[#1a0505] via-[#200a0a] to-[#0a0b10] border-red-900/40'
          }
        `}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.1),transparent)]" />
          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-3
                  ${isAccepted ? 'bg-emerald-800/60 text-emerald-300 border border-emerald-700/50' : 'bg-red-950/60 text-red-300 border border-red-800/50'}
                `}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  {isAccepted ? 'Hospital Bed Reserved — En Route' : isDeclined ? 'Re-routing: Finding Hospital' : 'Ambulance Dispatched'}
                </span>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {isAccepted ? `Heading to\n${destHospital?.name}` : 'Ambulance Rushing\nTo Your Location'}
                </h1>
                <p className="text-xs sm:text-sm text-[rgba(255,255,255,0.6)] mt-2 max-w-md">
                  {isAccepted
                    ? `Emergency room confirmed. On-duty surgeon (${destHospital?.surgeon?.name || 'Trauma Lead'}) is prepared.`
                    : 'Keep your phone available. An ambulance attendant is en route to examine the patient.'}
                </p>
              </div>

              {/* ETA badge */}
              <div className="glass rounded-2xl px-6 py-4 text-center border border-[rgba(255,255,255,0.1)] shrink-0">
                <span className="text-[10px] uppercase font-bold text-[rgba(255,255,255,0.5)] block tracking-wider mb-1">
                  {isAccepted ? 'Hospital ETA' : 'Ambulance ETA'}
                </span>
                <span className="text-4xl font-black text-amber-300">
                  ~{isAccepted ? (citizenIncident.etaToHospital || 6) : (citizenIncident.etaMinutes || 4)}
                  <span className="text-base font-normal text-amber-400/70"> min</span>
                </span>
              </div>
            </div>

            
            {/* Assigned Paramedic Info */}
            {!isAccepted && citizenIncident.paramedicName && (
              <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.1)] flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <User className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[rgba(255,255,255,0.5)] tracking-wider">Assigned Paramedic</p>
                  <p className="text-sm font-bold text-white">{citizenIncident.paramedicName}</p>
                </div>
                <div className="ml-auto flex flex-col items-end">
                  <p className="text-[10px] uppercase font-bold text-[rgba(255,255,255,0.5)] tracking-wider">Badge ID / Unit</p>
                  <div className="flex gap-2">
                    <span className="font-mono text-xs font-bold text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/30">{citizenIncident.paramedicBadge || 'PARA-409'}</span>
                    <span className="text-xs font-semibold text-white/70">{citizenIncident.assignedAmbulanceCallsign}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Location + emergency contact */}

            <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.1)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.6)]">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Scene: <strong className="text-white">{citizenIncident.locationName}</strong></span>
              </div>
              <a
                href="tel:112"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Call 112 — National Emergency
              </a>
            </div>
          </div>
        </div>

        {/* 4-stage timeline */}
        <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.07)] p-6 space-y-4">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" />
            Emergency Response Lifecycle
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Stage
              num="1" label="Emergency Reported"
              desc={`${citizenIncident.patientCategory} — ${citizenIncident.patientCount} patient(s)`}
              status="done"
            />
            <Stage
              num="2" label="Ambulance Dispatched"
              desc={`${citizenIncident.paramedicName || 'Paramedic en route'}`}
              status={step >= 2 ? 'done' : 'active'}
            />
            <Stage
              num="3" label="On-Scene Assessment"
              desc={citizenIncident.assessment ? `Conscious: ${citizenIncident.assessment.isConscious}` : 'Paramedic evaluating patient vitals'}
              status={step >= 3 ? 'done' : step === 2 ? 'active' : 'pending'}
            />
            <Stage
              num="4" label="Hospital Verification"
              desc={`Target: ${destHospital?.name || 'Searching...'}`}
              status={isAccepted ? 'done' : isDeclined ? 'active' : step >= 3 ? 'active' : 'pending'}
            />
          </div>
          <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] flex justify-end">
            <button
              onClick={cancelCitizenIncident}
              className="text-xs text-[rgba(255,255,255,0.4)] hover:text-red-400 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3 h-3" />
              Cancel this report
            </button>
          </div>
        </div>

        <FirstAidGuidance />
      </div>
    );
  }

  // ── Report form ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="glass-dark rounded-[2rem] border border-[rgba(255,255,255,0.06)] p-6 sm:p-10 space-y-10 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        
        {/* Soft background glow */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-600/5 rounded-full blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="border-b border-[rgba(255,255,255,0.06)] pb-8 relative z-10 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-[0_0_15px_rgba(220,38,38,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]" />
            Live Emergency Dispatch
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
            Request Ambulance
          </h1>
          <p className="text-sm text-[rgba(255,255,255,0.4)] max-w-lg mx-auto leading-relaxed font-medium">
            No medical knowledge required. Tap your emergency, pinpoint your location, and we'll instantly route the closest verified ambulance.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-10 relative z-10">
          
          {/* Category grid */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
              <span className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[10px]">1</span>
              What happened?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {CATEGORIES.map(cat => (
                <CategoryBtn
                  key={cat.id}
                  cat={cat}
                  selected={selectedCategory}
                  onClick={setSelectedCategory}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Description */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                <span className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[10px]">2</span>
                Brief Details
              </label>
              <textarea
                value={patientDetails}
                onChange={e => setPatientDetails(e.target.value)}
                placeholder="e.g. Fell off two-wheeler, bleeding..."
                rows={4}
                maxLength={200}
                className="w-full p-4 text-sm text-white bg-[rgba(255,255,255,0.03)] rounded-2xl border border-[rgba(255,255,255,0.07)] focus:border-red-500/50 focus:bg-[rgba(255,255,255,0.05)] outline-none resize-none transition-all placeholder-[rgba(255,255,255,0.2)]"
              />
            </div>

            {/* Patients count */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                <span className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[10px]">3</span>
                Patients Affected
              </label>
              <div className="bg-[rgba(255,255,255,0.03)] p-6 rounded-2xl border border-[rgba(255,255,255,0.07)] flex items-center justify-between h-[116px]">
                <div>
                  <span className="text-sm font-bold text-white block mb-1">Total count</span>
                  <span className="text-xs text-[rgba(255,255,255,0.4)]">Needing immediate care</span>
                </div>
                <div className="flex items-center gap-4 bg-[rgba(0,0,0,0.3)] p-1.5 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <button type="button" onClick={() => setPatientCount(p => Math.max(1, p - 1))}
                    className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white font-bold flex items-center justify-center transition active:scale-95">
                    −
                  </button>
                  <span className="font-black text-2xl text-white w-6 text-center">{patientCount}</span>
                  <button type="button" onClick={() => setPatientCount(p => Math.min(10, p + 1))}
                    className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white font-bold flex items-center justify-center transition active:scale-95">
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Map Location */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                <span className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[10px]">4</span>
                Confirm Scene Location
              </label>
              
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isLocating}
                className="text-[11px] font-bold bg-white text-black px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-200 transition shadow-[0_4px_15px_rgba(255,255,255,0.15)] disabled:opacity-50 active:scale-95"
              >
                <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? 'Acquiring...' : 'Use My Exact GPS'}
              </button>
            </div>

            <div className="bg-[rgba(255,255,255,0.02)] p-2 rounded-[1.5rem] border border-[rgba(255,255,255,0.06)] relative group">
              <div className="relative h-64 w-full rounded-[1.2rem] overflow-hidden border border-[rgba(255,255,255,0.05)] z-10 mb-3 bg-[#0a0a0f] cursor-crosshair">
                <MapView 
                  userLocation={selectedLoc || userLocation} 
                  allHospitals={hospitals} 
                  activeRouteTarget={null}
                  onMapClick={async (latlng) => {
                    setSelectedLoc({ lat: latlng.lat, lng: latlng.lng });
                    setIncidentAddress('Resolving address...');
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`);
                      const data = await res.json();
                      if (data && data.display_name) {
                        // Keep it relatively short
                        const parts = data.display_name.split(', ');
                        setIncidentAddress(parts.slice(0, 3).join(', '));
                      } else {
                        setIncidentAddress(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
                      }
                    } catch (e) {
                      setIncidentAddress(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
                    }
                  }}
                />
              </div>

              <div className="px-2 pb-2">
                <div className="flex items-center bg-[rgba(0,0,0,0.3)] rounded-xl border border-[rgba(255,255,255,0.08)] shadow-inner overflow-hidden transition-all focus-within:border-red-500/60 focus-within:bg-[rgba(255,255,255,0.05)]">
                  <div className="pl-4 pr-2 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-red-500" />
                  </div>
                  <input
                    type="text"
                    value={incidentAddress}
                    onChange={e => setIncidentAddress(e.target.value)}
                    placeholder="Tap on the map or type your location..."
                    required
                    className="w-full py-3.5 pr-4 text-sm font-semibold text-white bg-transparent outline-none placeholder-[rgba(255,255,255,0.3)]"
                  />
                </div>
              </div>
              {userLocation.isGpsActive && (
                <div className="px-4 pb-2 mt-2">
                  <p className="text-[10px] font-medium text-emerald-400 flex items-center gap-1.5">
                    <Wifi className="w-3 h-3 animate-pulse" />
                    High-precision GPS captured (±{userLocation.accuracyMeters}m)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full relative group overflow-hidden flex items-center justify-center gap-3 py-5 rounded-[1.5rem] text-base font-black disabled:opacity-60 disabled:cursor-not-allowed transition-transform active:scale-[0.98] border border-red-500/30 shadow-[0_10px_40px_rgba(220,38,38,0.3)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-700 via-red-600 to-red-800 transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
              
              <div className="cc-emergency-cta relative z-10 flex items-center gap-3 text-white">
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-[3px] border-white/40 border-t-white rounded-full animate-spin" />
                    <span className="tracking-widest">DISPATCHING AMBULANCE...</span>
                  </>
                ) : (
                  <>
                    <SendHorizontal className="w-6 h-6" />
                    <span className="tracking-widest">DISPATCH AMBULANCE NOW</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
