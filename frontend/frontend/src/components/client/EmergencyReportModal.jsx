import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Users, 
  AlertTriangle, 
  Cross, 
  Car, 
  UserX, 
  Droplet, 
  Wind, 
  HeartCrack, 
  HelpCircle,
  LocateFixed,
  SendHorizontal
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

const EMERGENCY_TYPES = [
  { id: 'Accident', label: 'Accident / Collision', icon: Car },
  { id: 'Unconscious person', label: 'Unconscious Person', icon: UserX },
  { id: 'Severe bleeding', label: 'Severe Bleeding', icon: Droplet },
  { id: 'Breathing problem', label: 'Breathing Difficulty', icon: Wind },
  { id: 'Chest pain', label: 'Chest Pain / Heart', icon: HeartCrack },
  { id: 'Other', label: 'Other Emergency', icon: HelpCircle },
];

export const EmergencyReportModal = ({ isOpen, onClose }) => {
  const { userLocation, requestGpsLocation, reportEmergency, showToast } = useCrisisCare();

  const [selectedType, setSelectedType] = useState('Accident');
  const [patientCount, setPatientCount] = useState(1);
  const [note, setNote] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [manualAddress, setManualAddress] = useState(userLocation.address || '');

  if (!isOpen) return null;

  const handleCaptureLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await requestGpsLocation();
      setManualAddress(loc.address);
    } catch (err) {
      // Handled gracefully in context
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedType) {
      showToast('Selection Required', 'Please select an observable emergency category', 'warning');
      return;
    }

    reportEmergency({
      emergencyType: selectedType,
      patientCount,
      locationName: manualAddress || userLocation.address,
      note: note.trim()
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-teal-deep/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card rounded-2xl max-w-lg w-full border border-surface-border shadow-elevated overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-emergency-red text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg leading-tight">Report Health Emergency</h2>
              <p className="text-xs text-white/80">Immediate live triage & hospital routing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Observable Triage Types */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-muted mb-2">
              1. Observable Emergency Situation <span className="text-emergency-red">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EMERGENCY_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      isSelected 
                        ? 'border-emergency-red bg-emergency-light text-emergency-dark font-bold shadow-sm ring-1 ring-emergency-red' 
                        : 'border-surface-border bg-white text-surface-dark hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-emergency-red' : 'text-teal-primary'}`} />
                    <span className="text-xs">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Patient Count Stepper */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-surface-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-deep" />
              <div>
                <span className="text-xs font-bold text-teal-deep block">Number of Patients</span>
                <span className="text-[11px] text-surface-muted">Estimated persons needing care</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPatientCount((prev) => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded-lg bg-white border border-surface-border text-surface-dark font-bold hover:bg-slate-100 flex items-center justify-center transition"
              >
                -
              </button>
              <span className="font-extrabold text-base w-4 text-center text-teal-deep">{patientCount}</span>
              <button
                type="button"
                onClick={() => setPatientCount((prev) => Math.min(10, prev + 1))}
                className="w-8 h-8 rounded-lg bg-white border border-surface-border text-surface-dark font-bold hover:bg-slate-100 flex items-center justify-center transition"
              >
                +
              </button>
            </div>
          </div>

          {/* Location Verification & Manual Fallback */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-surface-muted">
                2. Incident Location (GPS / Landmark)
              </label>
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={isLocating}
                className="text-xs text-teal-primary hover:text-teal-deep font-semibold flex items-center gap-1"
              >
                <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? 'Acquiring GPS...' : 'Auto-Detect GPS'}
              </button>
            </div>
            <div className="relative">
              <MapPin className="w-4 h-4 text-emergency-red absolute left-3 top-3" />
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Street address, flyover, or nearby landmark..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-surface-border focus:border-teal-primary focus:ring-1 focus:ring-teal-primary outline-none"
                required
              />
            </div>
            <p className="text-[11px] text-surface-muted">
              Auto-coordinates: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)} • PostGIS Radius: 15km
            </p>
          </div>

          {/* Quick Observable Observation (No medical jargon) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-surface-muted">
              3. Visual Clues / Notes (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Near bus stop, conscious but cannot stand, severe leg laceration"
              className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border focus:border-teal-primary outline-none"
              maxLength={120}
            />
          </div>

          {/* Safety Disclaimer */}
          <div className="bg-amber-50/80 border border-amber-200 p-2.5 rounded-lg text-[11px] text-amber-900 leading-snug">
            <strong>Medical Disclaimer:</strong> Do not attempt complex medical maneuvers. Emergency dispatch will guide you, and medical decisions remain the sole responsibility of certified clinicians.
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            className="w-full bg-emergency-red hover:bg-emergency-dark text-white font-extrabold text-sm py-3.5 px-4 rounded-xl shadow-emergency flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            <SendHorizontal className="w-4 h-4" />
            FIND NEAREST HOSPITALS & DISPATCH AMBULANCE
          </button>
        </form>
      </div>
    </div>
  );
};
