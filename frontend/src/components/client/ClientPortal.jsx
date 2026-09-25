import React, { useState } from 'react';
import { 
  AlertCircle, 
  MapPin, 
  PhoneCall, 
  Users, 
  Car, 
  UserX, 
  Droplet, 
  Wind, 
  HeartCrack, 
  HelpCircle,
  LocateFixed,
  SendHorizontal,
  CheckCircle2,
  Clock,
  Truck,
  Stethoscope,
  Building2,
  ShieldCheck,
  ChevronRight,
  RotateCcw,
  UserCheck,
  AlertTriangle,
  Brain,
  Zap,
  Flame,
  Activity,
  Baby,
  Skull
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { FirstAidGuidance } from './FirstAidGuidance';

const CATEGORIES = [
  { id: 'Traffic Accident', label: 'Traffic & Road Accident', icon: Car, desc: 'Vehicle collision, bike crash, pedestrian hit' },
  { id: 'Cardiac / Chest Pain', label: 'Cardiac Arrest / Chest Pain', icon: HeartCrack, desc: 'Heart attack symptoms, severe tightness, collapse' },
  { id: 'Breathing Difficulty', label: 'Breathing / Choking', icon: Wind, desc: 'Severe asthma, choking airway, acute dyspnea' },
  { id: 'Severe Bleeding', label: 'Severe Bleeding & Trauma', icon: Droplet, desc: 'Arterial blood loss, stab wound, hemorrhage' },
  { id: 'Unconscious Person', label: 'Unconscious / Fainted', icon: UserX, desc: 'Unresponsive to voice or shaking, coma' },
  { id: 'Suspected Stroke', label: 'Suspected Stroke (FAST)', icon: Brain, desc: 'Face drooping, slurred speech, arm weakness' },
  { id: 'Seizure / Convulsion', label: 'Seizure / Epileptic Fit', icon: Zap, desc: 'Violent convulsions, foaming, loss of control' },
  { id: 'Severe Burns', label: 'Severe Burns / Fire', icon: Flame, desc: 'Thermal flame burns, boiling oil, chemical burns' },
  { id: 'Fall from Height', label: 'Fall / Spinal Trauma', icon: Activity, desc: 'Roof/stairs fall, suspected spinal cord injury' },
  { id: 'Bone Fracture', label: 'Fracture / Crush Injury', icon: AlertTriangle, desc: 'Open compound fracture, crushed or deformed limb' },
  { id: 'Poisoning', label: 'Poison / Toxic Ingestion', icon: Skull, desc: 'Toxic ingestion, chemical hazard, drug overdose' },
  { id: 'Snakebite & Animal Bite', label: 'Snakebite / Animal Attack', icon: AlertCircle, desc: 'Venomous snakebite, rabies risk, severe bite' },
  { id: 'Pregnancy Emergency', label: 'Pregnancy / Labor Emergency', icon: Baby, desc: 'Imminent labor, severe obstetric hemorrhage' },
  { id: 'Pediatric Emergency', label: 'Pediatric / Infant Distress', icon: Users, desc: 'Child respiratory failure, high febrile seizure' },
  { id: 'Allergic Anaphylaxis', label: 'Severe Allergic Reaction', icon: ShieldCheck, desc: 'Throat swelling, anaphylactic shock, acute hives' },
  { id: 'Electric Shock', label: 'Electric Shock / Electrocution', icon: Zap, desc: 'High voltage electrocution, electrical burns' },
  { id: 'Other Emergency', label: 'Other Acute Emergency', icon: HelpCircle, desc: 'Unspecified life-threatening critical condition' },
];

export const ClientPortal = () => {
  const { 
    citizenIncident, 
    reportEmergency, 
    cancelCitizenIncident, 
    startNewCitizenReport,
    userLocation, 
    requestGpsLocation, 
    hospitals,
    showToast,
    theme 
  } = useCrisisCare();

  const isRed = theme === 'red';

  const [selectedCategory, setSelectedCategory] = useState('Traffic Accident');
  const [patientDetails, setPatientDetails] = useState('');
  const [patientCount, setPatientCount] = useState(1);
  const [incidentAddress, setIncidentAddress] = useState(userLocation.address || 'BKC Bandra East, Mumbai');
  const [isLocating, setIsLocating] = useState(false);

  const handleCaptureGps = async () => {
    setIsLocating(true);
    try {
      const loc = await requestGpsLocation();
      setIncidentAddress(loc.address);
    } finally {
      setIsLocating(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!selectedCategory) {
      showToast('Selection Required', 'Please select an emergency category', 'warning');
      return;
    }

    reportEmergency({
      emergencyType: selectedCategory,
      patientDetails: patientDetails.trim() || `${selectedCategory} reported at scene`,
      patientCount,
      locationName: incidentAddress
    });
  };

  const destHospital = citizenIncident?.destinationHospital || hospitals.find(h => h.id === citizenIncident?.targetHospitalId) || hospitals[0];
  const destSurgeon = destHospital?.surgeon;
  const isHospitalAccepted = citizenIncident?.hospitalResponse === 'accepted';
  const isDeclined = citizenIncident?.hospitalResponse === 'declined';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* CASE A: EMERGENCY REPORTED (LIVE ATTENDANT & ROUTING TRACKER) */}
      {citizenIncident ? (
        <div className="space-y-6 animate-fade-in">
          {/* Quick bar to report new emergency / answer questions */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-xs font-bold text-slate-800">
                Active Incident: <strong>{citizenIncident.patientCategory || citizenIncident.type}</strong> ({citizenIncident.locationName})
              </span>
            </div>
            <button
              type="button"
              onClick={startNewCitizenReport}
              className="text-xs font-extrabold text-red-700 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> + Report New Emergency (Question Form)
            </button>
          </div>

          {/* Status Banner in Emergency Theme */}
          <div className={`text-white rounded-3xl p-6 sm:p-8 shadow-elevated ${
            isHospitalAccepted
              ? 'bg-gradient-to-r from-emerald-800 to-emerald-600'
              : isRed
                ? 'bg-gradient-to-r from-[#8B0000] via-[#A81010] to-[#C62828]'
                : 'bg-gradient-to-r from-teal-deep to-teal-primary'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 ${
                  isHospitalAccepted ? 'bg-white text-emerald-800' : 'bg-white/20 text-white'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  {isHospitalAccepted 
                    ? 'Hospital Bed Reserved - En Route to ER' 
                    : isDeclined 
                      ? 'Re-routing: Finding Available Hospital' 
                      : 'Ambulance Dispatched & On The Way'
                  }
                </span>

                <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
                  {isHospitalAccepted 
                    ? `Heading to ${destHospital.name}` 
                    : 'Ambulance is Rushing to Your Location'
                  }
                </h1>

                <p className="text-xs sm:text-sm text-white/90 mt-1">
                  {isHospitalAccepted 
                    ? `Emergency room accepted patient. On-duty surgeon (${destSurgeon?.name || 'Trauma Lead'}) is ready.` 
                    : 'Keep your phone available. An ambulance attendant is dispatched to examine the patient and navigate to nearest hospital.'
                  }
                </p>
              </div>

              {/* Big ETA Countdown */}
              <div className="bg-black/25 backdrop-blur-md border border-white/20 px-5 py-3 rounded-2xl text-center shrink-0">
                <span className="text-[11px] uppercase font-bold text-white/80 block">
                  {isHospitalAccepted ? 'Hospital Arrival ETA' : 'Ambulance Arrival'}
                </span>
                <span className="text-3xl sm:text-4xl font-black text-amber-300">
                  ~{isHospitalAccepted ? (citizenIncident.etaToHospital || 6) : (citizenIncident.etaMinutes || 4)}{' '}
                  <span className="text-base font-normal">mins</span>
                </span>
              </div>
            </div>

            {/* Quick Contact Bar */}
            <div className="mt-6 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-300" />
                <span>Incident Scene: <strong>{citizenIncident.locationName}</strong></span>
              </div>
              <a
                href="tel:112"
                className="bg-white hover:bg-slate-100 text-red-700 font-extrabold px-4 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Call National Emergency Helpline: 112
              </a>
            </div>
          </div>

          {/* 4-Stage Transparent Emergency Timeline */}
          <div className="bg-surface-card rounded-3xl border border-surface-border p-6 shadow-subtle">
            <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-700" />
              Real-Time Emergency Response Lifecycle
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
              {/* Stage 1 */}
              <div className="bg-emerald-50 border border-status-green/40 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-status-green">Step 1: Completed</span>
                  <CheckCircle2 className="w-4 h-4 text-status-green" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">Emergency Reported</h4>
                <p className="text-[11px] text-slate-600">
                  {citizenIncident.patientCategory || citizenIncident.category} ({citizenIncident.patientCount} patient{citizenIncident.patientCount > 1 ? 's' : ''})
                </p>
                <div className="text-[10px] text-slate-500 pt-1 italic">
                  "{citizenIncident.patientDetails}"
                </div>
              </div>

              {/* Stage 2 */}
              <div className="bg-emerald-50 border border-status-green/40 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-status-green">Step 2: Completed</span>
                  <CheckCircle2 className="w-4 h-4 text-status-green" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">Ambulance Dispatched</h4>
                <p className="text-[11px] text-slate-600">
                  Lead: <strong>{citizenIncident.paramedicName}</strong>
                </p>
                <div className="text-[10px] text-emerald-800 font-semibold pt-1">
                  Speed: 48 km/h • Siren active
                </div>
              </div>

              {/* Stage 3 */}
              <div className={`p-4 rounded-2xl space-y-1 ${
                citizenIncident.assessment || citizenIncident.statusStep >= 3
                  ? 'bg-emerald-50 border border-status-green/40'
                  : 'bg-amber-50 border border-amber-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${
                    citizenIncident.assessment || citizenIncident.statusStep >= 3 ? 'text-status-green' : 'text-amber-700'
                  }`}>
                    {citizenIncident.assessment || citizenIncident.statusStep >= 3 ? 'Step 3: Completed' : 'Step 3: In Progress'}
                  </span>
                  {citizenIncident.assessment || citizenIncident.statusStep >= 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-status-green" />
                  ) : (
                    <Stethoscope className="w-4 h-4 text-amber-600 animate-pulse" />
                  )}
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">Attendant Checks Patient</h4>
                <p className="text-[11px] text-slate-600">
                  {citizenIncident.assessment ? (
                    <span>
                      Conscious: <strong>{citizenIncident.assessment.isConscious}</strong> • Breathing: <strong>{citizenIncident.assessment.isBreathingProperly}</strong>
                    </span>
                  ) : (
                    'Paramedic evaluates vital signs on scene.'
                  )}
                </p>
                {citizenIncident.assessment && (
                  <div className="text-[10px] text-status-green font-bold pt-1 bg-white/80 p-1 rounded border border-emerald-200">
                    Clinical checks completed & transmitted to hospital
                  </div>
                )}
              </div>

              {/* Stage 4 */}
              <div className={`p-4 rounded-2xl space-y-1 ${
                isHospitalAccepted
                  ? 'bg-emerald-50 border-2 border-status-green shadow-xs'
                  : isDeclined
                    ? 'bg-red-50 border-2 border-emergency-border'
                    : 'bg-amber-50 border border-amber-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${
                    isHospitalAccepted ? 'text-status-green' : isDeclined ? 'text-emergency-dark' : 'text-amber-700'
                  }`}>
                    {isHospitalAccepted 
                      ? 'Step 4: Confirmed & Accepted' 
                      : isDeclined 
                        ? 'Step 4: Re-routing' 
                        : 'Step 4: Awaiting ER Decision'
                    }
                  </span>
                  {isHospitalAccepted ? (
                    <CheckCircle2 className="w-4 h-4 text-status-green" />
                  ) : isDeclined ? (
                    <AlertTriangle className="w-4 h-4 text-emergency-red" />
                  ) : (
                    <Building2 className="w-4 h-4 text-amber-600 animate-pulse" />
                  )}
                </div>

                <h4 className="font-extrabold text-slate-900 text-sm">
                  {isHospitalAccepted ? 'Hospital Bed Reserved' : 'Hospital Verification'}
                </h4>

                <p className="text-[11px] text-slate-600">
                  Target: <strong>{destHospital.name}</strong>
                </p>

                <div className="text-[10px] pt-1.5 border-t border-slate-200 space-y-1">
                  <div className="flex items-center gap-1 font-bold text-slate-800">
                    <UserCheck className="w-3.5 h-3.5 text-status-green shrink-0" />
                    <span>Surgeon: {destSurgeon?.isAvailable ? destSurgeon.name : 'Surgeon on Call'}</span>
                  </div>
                  {isHospitalAccepted && (
                    <span className="text-[9px] font-black text-status-green bg-emerald-100 px-1.5 py-0.5 rounded block">
                      ICU Bed & Resuscitation Team Ready
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-surface-border flex justify-between items-center text-xs">
              <span className="text-surface-muted">
                Need to report a different incident?
              </span>
              <button
                onClick={cancelCitizenIncident}
                className="text-red-700 font-bold hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Cancel / Report New Emergency
              </button>
            </div>
          </div>

          <FirstAidGuidance />
        </div>
      ) : (
        /* CASE B: NEW EMERGENCY REPORT FORM WITH 12 EXPANDED CATEGORIES */
        <div className="bg-surface-card rounded-3xl border border-surface-border p-6 sm:p-8 shadow-subtle space-y-6">
          <div className="border-b border-surface-border pb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-emergency-dark text-xs font-bold uppercase mb-2">
              <span className="w-2 h-2 rounded-full bg-emergency-red animate-ping"></span>
              Citizen Emergency SOS Form
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Report Emergency Situation
            </h1>
            <p className="text-xs sm:text-sm text-surface-muted mt-1 leading-relaxed">
              No medical questions asked. Select what happened and your location; our system dispatches the nearest ambulance immediately.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* 1. Expanded 12 Emergency Categories */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2.5">
                1. Select Emergency Category ({CATEGORIES.length} Options) <span className="text-emergency-red">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-red-600 bg-red-50/80 shadow-sm ring-2 ring-red-600/30'
                          : 'border-surface-border bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${
                        isSelected ? 'bg-red-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className={`block text-xs font-extrabold line-clamp-1 ${isSelected ? 'text-red-700' : 'text-slate-900'}`}>
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-surface-muted leading-tight line-clamp-2 mt-0.5">
                          {cat.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Observable Description */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1.5">
                2. What Happened? (Brief Description)
              </label>
              <textarea
                value={patientDetails}
                onChange={(e) => setPatientDetails(e.target.value)}
                placeholder="e.g. Person fell off two-wheeler at junction, bleeding from forehead, conscious but cannot get up..."
                rows={2}
                style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                className="w-full p-3 text-xs sm:text-sm font-semibold text-slate-900 bg-white rounded-xl border border-slate-300 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none shadow-xs"
                maxLength={200}
              />
            </div>

            {/* 3. Patient Count & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-surface-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Number of Patients</span>
                  <span className="text-[11px] text-surface-muted">Needing emergency care</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPatientCount((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-surface-border font-bold text-slate-800 hover:bg-slate-100 flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="font-black text-lg w-4 text-center text-slate-900">{patientCount}</span>
                  <button
                    type="button"
                    onClick={() => setPatientCount((prev) => Math.min(10, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-surface-border font-bold text-slate-800 hover:bg-slate-100 flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-surface-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Incident Location</span>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isLocating}
                    className="text-xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1"
                  >
                    <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                    {isLocating ? 'Locating...' : 'Use My GPS'}
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-emergency-red absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={incidentAddress}
                    onChange={(e) => setIncidentAddress(e.target.value)}
                    placeholder="Enter street, landmark, or junction..."
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold text-slate-900 bg-white rounded-lg border border-slate-300 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Dispatch Action */}
            <button
              type="submit"
              className={`w-full text-white font-extrabold text-base py-4 px-6 rounded-2xl shadow-emergency flex items-center justify-center gap-2.5 transition active:scale-[0.99] ${
                isRed ? 'bg-[#B71C1C] hover:bg-[#8B0000]' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <SendHorizontal className="w-5 h-5" />
              <span>DISPATCH AMBULANCE NOW</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
