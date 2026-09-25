import React, { useState } from 'react';
import { 
  Building2, 
  BedDouble, 
  Wind, 
  Droplets, 
  Plus, 
  Minus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  HeartHandshake,
  Shield,
  Activity,
  Save,
  Lock,
  LogOut,
  XCircle,
  KeyRound,
  Stethoscope,
  Scissors,
  Scan,
  HeartPulse,
  Radio,
  UserCheck,
  Edit2
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { InventoryFreshnessBadge } from '../common/InventoryFreshnessBadge';

export const HospitalPortal = () => {
  const { 
    hospitals, 
    hospitalAuth, 
    loginHospital, 
    logoutHospital, 
    emergencies,
    citizenIncident,
    respondToAmbulance, 
    updateHospitalInventory,
    updateSurgeonAvailability,
    showToast,
    theme 
  } = useCrisisCare();

  const isRed = theme === 'red';

  const [selectedHospId, setSelectedHospId] = useState(hospitals[0]?.id || 'hosp-001');
  const [email, setEmail] = useState('er.chief@crisiscare.org');
  const [password, setPassword] = useState('hospital123');
  const [declineReasonModal, setDeclineReasonModal] = useState(null);

  // Surgeon editing state
  const [isEditingSurgeon, setIsEditingSurgeon] = useState(false);
  const [surgeonNameInput, setSurgeonNameInput] = useState('');

  if (!hospitalAuth) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="bg-surface-card rounded-3xl border border-surface-border p-6 sm:p-8 shadow-elevated space-y-6">
          <div className="text-center">
            <div className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center mx-auto shadow-md mb-3 ${
              isRed ? 'bg-[#B71C1C]' : 'bg-teal-primary'
            }`}>
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Hospital ER Staff Login</h1>
            <p className="text-xs text-surface-muted mt-1">
              Select your hospital to check resources & accept/decline ambulances
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginHospital(selectedHospId, email, password);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Select Medical Facility
              </label>
              <select
                value={selectedHospId}
                onChange={(e) => setSelectedHospId(e.target.value)}
                style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-900 bg-white outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
              >
                {hospitals.map((h) => (
                  <option 
                    key={h.id} 
                    value={h.id} 
                    style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                    className="text-slate-900 bg-white font-bold py-1"
                  >
                    {h.name} ({h.traumaLevel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Clinician Email / Staff ID
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                className="w-full px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white rounded-xl border border-slate-300 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Access Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                className="w-full px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white rounded-xl border border-slate-300 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 shadow-xs"
                required
              />
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-surface-muted flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Password: <strong>hospital123</strong> • Select any hospital to log in</span>
            </div>

            <button
              type="submit"
              className={`w-full text-white font-black text-xs py-3 rounded-xl shadow-sm transition ${
                isRed ? 'bg-[#B71C1C] hover:bg-[#8B0000]' : 'bg-teal-primary hover:bg-teal-hover'
              }`}
            >
              AUTHENTICATE EMERGENCY DESK
            </button>
          </form>

          {/* Quick 1-click Demo shortcuts */}
          <div className="pt-3 border-t border-surface-border space-y-2">
            <span className="text-[11px] font-bold text-slate-500 block text-center">Quick Switch Facility Login:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => loginHospital('hosp-001', 'er.chief@apex.care', 'hospital123')}
                className="text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 py-2 px-2.5 rounded-xl border border-red-200 transition text-center"
              >
                🏥 Apex Central
              </button>
              <button
                onClick={() => loginHospital('hosp-002', 'er.chief@lifeline.care', 'hospital123')}
                className="text-[11px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 py-2 px-2.5 rounded-xl border border-sky-200 transition text-center"
              >
                🏥 LifeLine Specialty
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentHospital = hospitals.find((h) => h.id === hospitalAuth.hospitalId) || hospitals[0];
  const currentSurgeon = currentHospital.surgeon || {
    isAvailable: true,
    name: 'Dr. Rajeshwar Sharma, MS, MCh',
    specialty: 'Chief Trauma & Vascular Surgeon',
    dutyShift: '24x7 Emergency Call'
  };

  // Incoming emergencies: ONLY show emergencies that are currently targeting this specific hospital
  const incomingEmergencies = emergencies.filter(
    (e) => e.targetHospitalId === currentHospital.id
  );

  const handleAdjustCount = (key, subKey, delta) => {
    let currentVal = 0;
    if (subKey) {
      currentVal = currentHospital.inventory.bloodUnits[subKey] || 0;
    } else {
      currentVal = currentHospital.inventory[key] || 0;
    }
    const newVal = Math.max(0, currentVal + delta);
    updateHospitalInventory(
      currentHospital.id,
      key,
      subKey,
      newVal,
      delta > 0 ? `Restocked (+${delta})` : `Consumed (-${Math.abs(delta)})`
    );
  };

  const handleToggleBoolean = (key) => {
    const currentVal = !!currentHospital.inventory[key];
    updateHospitalInventory(
      currentHospital.id,
      key,
      null,
      !currentVal,
      !currentVal ? 'Resource marked Operational' : 'Resource taken Offline'
    );
  };

  const handleSaveSurgeonName = () => {
    if (surgeonNameInput.trim()) {
      updateSurgeonAvailability(currentHospital.id, currentSurgeon.isAvailable, surgeonNameInput.trim(), currentSurgeon.specialty);
    }
    setIsEditingSurgeon(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className={`text-white p-5 sm:p-6 rounded-3xl shadow-subtle flex flex-wrap items-center justify-between gap-4 ${
        isRed ? 'bg-[#8B0000]' : 'bg-teal-deep'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold shadow-md">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                Hospital ER Authenticated
              </span>
              <h1 className="text-xl sm:text-2xl font-black">{currentHospital.name}</h1>
            </div>
            <p className="text-xs text-white/80 mt-0.5">
              Logged In: <strong>{hospitalAuth.staffName}</strong> • {currentHospital.traumaLevel} • Staff on Duty: <strong>{currentHospital.staffOnDuty}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={logoutHospital}
            className="text-xs font-bold text-red-200 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
            title="Log out from this hospital facility"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout Facility
          </button>
        </div>
      </div>

      {/* DEDICATED ON-DUTY SURGEON DOCTOR AVAILABILITY CARD */}
      <div className="bg-surface-card rounded-3xl border border-surface-border p-5 shadow-subtle flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-sm ${
            currentSurgeon.isAvailable ? 'bg-status-green text-white' : 'bg-emergency-red text-white'
          }`}>
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Emergency On-Duty Trauma Surgeon
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                currentSurgeon.isAvailable ? 'bg-emerald-100 text-status-green' : 'bg-red-100 text-emergency-dark'
              }`}>
                {currentSurgeon.isAvailable ? 'SURGEON AVAILABLE & READY' : 'IN SURGERY / UNAVAILABLE'}
              </span>
            </div>

            {isEditingSurgeon ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={surgeonNameInput}
                  onChange={(e) => setSurgeonNameInput(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-red-600 outline-none"
                />
                <button
                  onClick={handleSaveSurgeonName}
                  className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-lg"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingSurgeon(false)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {currentSurgeon.isAvailable ? currentSurgeon.name : 'No Surgeon Currently Free'}
                </h3>
                <button
                  onClick={() => {
                    setSurgeonNameInput(currentSurgeon.name);
                    setIsEditingSurgeon(true);
                  }}
                  className="text-red-700 hover:text-red-900 text-xs flex items-center gap-1 font-semibold"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Name
                </button>
              </div>
            )}
            <p className="text-xs text-slate-600">
              Specialty: <strong>{currentSurgeon.specialty}</strong> • Shift: <strong>{currentSurgeon.dutyShift}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => updateSurgeonAvailability(
            currentHospital.id, 
            !currentSurgeon.isAvailable, 
            currentSurgeon.name, 
            currentSurgeon.specialty
          )}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-xs ${
            currentSurgeon.isAvailable
              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>{currentSurgeon.isAvailable ? 'Mark In Surgery / Unavailable' : 'Mark Available On-Duty'}</span>
        </button>
      </div>

      {/* Main Grid: Incoming Ambulance Requests (Accept/Decline) & Hospital Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Incoming Ambulance Requests with ACCEPT / DECLINE */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface-card rounded-3xl border-2 border-red-200 p-5 sm:p-6 shadow-subtle space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-emergency-red animate-pulse" />
                <h2 className="font-black text-slate-900 text-base">Incoming Ambulance Requests</h2>
              </div>
              <span className="bg-red-100 text-emergency-dark text-xs font-black px-2.5 py-0.5 rounded-full">
                {incomingEmergencies.length} Request
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Check your available ICU beds, oxygen, and surgeon on the right. If resources exist, click <strong>ACCEPT</strong>. If not, click <strong>DECLINE</strong> so the ambulance can reroute.
            </p>

            {incomingEmergencies.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-surface-muted">
                No active ambulances currently querying {currentHospital.name}.
              </div>
            ) : (
              <div className="space-y-4">
                {incomingEmergencies.map((inc) => {
                  const isAccepted = inc.hospitalResponse === 'accepted';
                  const isDeclined = inc.hospitalResponse === 'declined';

                  return (
                    <div
                      key={inc.id}
                      className={`p-4 rounded-2xl border space-y-3 transition ${
                        isAccepted 
                          ? 'border-status-green bg-emerald-50/50' 
                          : isDeclined 
                            ? 'border-red-300 bg-red-50/50 opacity-80' 
                            : 'border-red-300 bg-white shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">{inc.assignedAmbulanceCallsign}</span>
                          <span className="text-[11px] text-slate-500">Paramedic: {inc.paramedicName}</span>
                        </div>
                        <span className="text-xs font-black bg-emergency-red text-white px-2.5 py-0.5 rounded-full">
                          ETA ~4 mins
                        </span>
                      </div>

                      {/* Attendant Clinical Checks */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-surface-muted block">Patient Telemetry from Attendant:</span>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <div>
                            <span className="text-slate-500">Conscious:</span>{' '}
                            <strong className="text-slate-900">{inc.assessment?.isConscious || 'Semi-conscious'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Breathing:</span>{' '}
                            <strong className="text-slate-900">{inc.assessment?.isBreathingProperly || 'Labored'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Pulse:</span>{' '}
                            <strong className="text-slate-900">{inc.assessment?.pulseStatus || 'Rapid'} ({inc.assessment?.pulseBpm || 108} bpm)</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Bleeding:</span>{' '}
                            <strong className={inc.assessment?.severeBleeding ? 'text-emergency-red font-black' : 'text-slate-700'}>
                              {inc.assessment?.severeBleeding ? 'YES (Blood Needed)' : 'Controlled'}
                            </strong>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 pt-1 italic border-t border-slate-200">
                          Note: "{inc.patientDetails}"
                        </div>
                      </div>

                      {/* Action buttons */}
                      {isAccepted ? (
                        <div className="bg-emerald-100 text-status-green p-3 rounded-xl text-xs font-bold space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-status-green" />
                              Trauma Bay 1 Reserved (Accepted)
                            </span>
                            <span className="text-[10px] bg-white px-2 py-0.5 rounded text-emerald-800 font-extrabold">Ready</span>
                          </div>
                          <div className="text-[11px] text-emerald-800 font-medium pt-1 border-t border-emerald-200">
                            On-Duty Surgeon: <strong>{currentSurgeon.isAvailable ? currentSurgeon.name : 'Surgeon Alerted'}</strong>
                          </div>
                        </div>
                      ) : isDeclined ? (
                        <div className="bg-red-100 text-emergency-dark p-2.5 rounded-xl text-xs font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-emergency-red" />
                            Declined: {inc.declineReason || 'Resources Full'}
                          </span>
                          <span className="text-[10px] text-slate-600 font-medium">Ambulance Notified</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => respondToAmbulance(inc.id, 'accepted')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-1 transition shadow-xs"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            ACCEPT EMERGENCY
                          </button>
                          <button
                            onClick={() => setDeclineReasonModal(inc.id)}
                            className="bg-red-50 hover:bg-red-100 text-emergency-dark border border-emergency-border font-extrabold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-1 transition"
                          >
                            <XCircle className="w-4 h-4 text-emergency-red" />
                            DECLINE (NO RESOURCE)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: HOSPITAL RESOURCES CHECK */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface-card rounded-3xl border border-surface-border p-5 sm:p-6 shadow-subtle space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Hospital Live Resource Management</h3>
                <p className="text-xs text-surface-muted">Adjust availability in real time. Changes reflect immediately to all routing units.</p>
              </div>
              <InventoryFreshnessBadge lastUpdatedIso={currentHospital.lastUpdated} />
            </div>

            {/* Grid of Medical Resources */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. ICU Beds */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-red-700" />
                    <span className="text-xs font-bold text-slate-900">ICU Resuscitation Beds</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    (currentHospital.inventory?.icuBeds || 0) > 0 ? 'bg-emerald-100 text-status-green' : 'bg-red-100 text-emergency-dark'
                  }`}>
                    {(currentHospital.inventory?.icuBeds || 0) > 0 ? 'Available' : 'Unavailable (Full)'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-2xl font-black text-slate-900">{currentHospital.inventory?.icuBeds ?? 0}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAdjustCount('icuBeds', null, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAdjustCount('icuBeds', null, 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Ventilators */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-slate-900">Mechanical Ventilators</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    (currentHospital.inventory?.ventilators || 0) > 0 ? 'bg-emerald-100 text-status-green' : 'bg-red-100 text-emergency-dark'
                  }`}>
                    {(currentHospital.inventory?.ventilators || 0) > 0 ? 'Available' : 'All in Use'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-2xl font-black text-slate-900">{currentHospital.inventory?.ventilators ?? 0}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAdjustCount('ventilators', null, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAdjustCount('ventilators', null, 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Oxygen Cylinders */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-cyan-600" />
                    <span className="text-xs font-bold text-slate-900">Medical Oxygen (Type D)</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    (currentHospital.inventory?.oxygenCylinders || 0) > 10 ? 'bg-emerald-100 text-status-green' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {(currentHospital.inventory?.oxygenCylinders || 0) > 10 ? 'Adequate' : 'Low Stock'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-2xl font-black text-slate-900">{currentHospital.inventory?.oxygenCylinders ?? 0}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAdjustCount('oxygenCylinders', null, -2)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAdjustCount('oxygenCylinders', null, 2)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Operating Theater */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">Trauma Operating Theater</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    (currentHospital.inventory?.emergencyOT || 0) > 0 ? 'bg-emerald-100 text-status-green' : 'bg-red-100 text-emergency-dark'
                  }`}>
                    {(currentHospital.inventory?.emergencyOT || 0) > 0 ? 'Ready / Sterilized' : 'Occupied'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-2xl font-black text-slate-900">{currentHospital.inventory?.emergencyOT ?? 0}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAdjustCount('emergencyOT', null, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAdjustCount('emergencyOT', null, 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-xs flex items-center justify-center hover:bg-slate-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Blood Bank */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-emergency-red" />
                  <span className="text-xs font-extrabold text-slate-900">Blood Bank Tested Units</span>
                </div>
                <span className="text-[10px] text-surface-muted">Universal and emergency blood stock</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.entries(currentHospital.inventory?.bloodUnits || {}).map(([grp, qty]) => {
                  const isUniv = grp === 'O-';
                  const isAvailable = qty > 0;
                  return (
                    <div
                      key={grp}
                      className={`p-2.5 rounded-xl border text-center ${
                        isAvailable
                          ? isUniv ? 'bg-red-50 border-red-300 ring-1 ring-red-300' : 'bg-white border-slate-200'
                          : 'bg-red-100 border-red-300 opacity-60'
                      }`}
                    >
                      <span className="text-xs font-black block text-slate-800">
                        {grp} {isUniv && <span className="text-[9px] text-red-600">(Univ)</span>}
                      </span>
                      <span className="text-base font-black text-emergency-dark block my-1">{qty}</span>
                      <span className={`text-[9px] font-bold uppercase block mb-1.5 ${
                        isAvailable ? 'text-status-green' : 'text-emergency-red'
                      }`}>
                        {isAvailable ? 'In Stock' : 'Out of Stock'}
                      </span>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleAdjustCount('bloodUnits', grp, -1)}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleAdjustCount('bloodUnits', grp, 1)}
                          className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decline Reason Modal */}
      {declineReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card rounded-3xl max-w-md w-full border border-surface-border p-6 shadow-elevated space-y-4">
            <h3 className="font-black text-emergency-dark text-base flex items-center gap-2">
              <XCircle className="w-5 h-5 text-emergency-red" />
              Specify Reason for Declining Ambulance
            </h3>
            <p className="text-xs text-slate-600">
              Select reason below. The ambulance attendant will be alerted immediately and prompted to pick another hospital:
            </p>

            <div className="space-y-2">
              {[
                'ICU Resuscitation Beds at 100% Capacity',
                'Universal O- Blood Bank Stock Depleted',
                'Trauma Operating Theaters Currently Occupied',
                'Oxygen Supply Below Critical Reserve Threshold'
              ].map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    respondToAmbulance(declineReasonModal, 'declined', reason);
                    setDeclineReasonModal(null);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-emergency-red hover:bg-red-50 text-xs font-semibold text-slate-800 transition"
                >
                  {reason}
                </button>
              ))}
            </div>

            <button
              onClick={() => setDeclineReasonModal(null)}
              className="w-full py-2 text-xs font-bold text-slate-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
