import React, { useState } from 'react';
import { ShieldAlert, ChevronRight, ChevronLeft, PhoneCall, CheckCircle } from 'lucide-react';

const GUIDELINES = [
  {
    step: 1,
    title: 'Ensure Immediate Scene Safety',
    description: 'Check your immediate surroundings for incoming traffic, fire, electrical wires, or structural collapse before attending to the patient.',
    tip: 'Do not put yourself in danger while trying to assist.'
  },
  {
    step: 2,
    title: 'Check Airway & Responsiveness',
    description: 'Gently tap the patient’s shoulder and shout "Can you hear me?". Observe chest movement for normal breathing.',
    tip: 'Keep the airway open by gently tilting the head back if no neck trauma is suspected.'
  },
  {
    step: 3,
    title: 'Apply Direct Pressure for Severe Bleeding',
    description: 'Use a clean cloth or sterile bandage. Press firmly and continuously directly over the bleeding wound.',
    tip: 'Do not remove saturated dressings; place additional pads on top.'
  },
  {
    step: 4,
    title: 'Prepare for Paramedic Arrival',
    description: 'Designate a bystander to wave down the ambulance at the nearest landmark or building gate. Keep emergency access routes unobstructed.',
    tip: 'Keep the patient calm and warm with a jacket or blanket.'
  }
];

export const FirstAidGuidance = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const item = GUIDELINES[currentStep];

  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-5 shadow-subtle">
      <div className="flex items-center justify-between border-b border-surface-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-teal-primary" />
          <h3 className="font-bold text-teal-deep text-sm sm:text-base">First-Aid & Safe Waiting Guidance</h3>
        </div>
        <span className="text-xs font-semibold bg-teal-light text-teal-deep px-2.5 py-1 rounded-full">
          Step {currentStep + 1} of {GUIDELINES.length}
        </span>
      </div>

      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 min-h-[130px] flex flex-col justify-between">
        <div>
          <h4 className="font-bold text-teal-deep text-sm mb-1.5 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-status-green shrink-0" />
            {item.title}
          </h4>
          <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-surface-muted italic">
          <span>Tip: {item.tip}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-border bg-white text-surface-dark hover:bg-slate-50 disabled:opacity-40 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        <div className="flex items-center gap-1">
          {GUIDELINES.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentStep ? 'w-5 bg-teal-primary' : 'bg-slate-300'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentStep((prev) => Math.min(GUIDELINES.length - 1, prev + 1))}
          disabled={currentStep === GUIDELINES.length - 1}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-primary text-white hover:bg-teal-deep disabled:opacity-40 transition"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-xs">
        <span className="text-surface-muted">Need police or fire services?</span>
        <a 
          href="tel:112"
          className="flex items-center gap-1 font-bold text-emergency-dark bg-emergency-light px-2.5 py-1 rounded-md hover:bg-red-100 transition"
        >
          <PhoneCall className="w-3.5 h-3.5" /> Call National Helpline: 112
        </a>
      </div>
    </div>
  );
};
