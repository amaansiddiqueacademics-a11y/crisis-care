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
    <div className="glass-dark rounded-3xl border border-[rgba(255,255,255,0.08)] p-6 sm:p-8">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4 mb-5">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-emerald-400" />
          <h3 className="font-black text-white text-lg tracking-tight">First-Aid & Safe Waiting</h3>
        </div>
        <span className="text-[10px] font-bold tracking-wider uppercase bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.6)] px-3 py-1.5 rounded-full border border-[rgba(255,255,255,0.04)]">
          Step {currentStep + 1} of {GUIDELINES.length}
        </span>
      </div>

      <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 min-h-[160px] flex flex-col justify-between relative overflow-hidden group hover:bg-[rgba(255,255,255,0.03)] transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="relative z-10">
          <h4 className="font-bold text-white text-base mb-2 flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <span>{item.title}</span>
          </h4>
          <p className="text-sm text-[rgba(255,255,255,0.55)] leading-relaxed pl-7">{item.description}</p>
        </div>
        <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.04)] flex items-center gap-2 text-xs text-[rgba(255,255,255,0.4)] relative z-10 pl-7">
          <span className="text-emerald-400/80 font-semibold">Tip:</span> {item.tip}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-white hover:bg-[rgba(255,255,255,0.08)] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        <div className="flex items-center gap-2">
          {GUIDELINES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep ? 'w-6 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'w-2 bg-[rgba(255,255,255,0.15)]'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentStep((prev) => Math.min(GUIDELINES.length - 1, prev + 1))}
          disabled={currentStep === GUIDELINES.length - 1}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-[0_0_15px_rgba(52,211,153,0.1)]"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-4">
        <span className="text-xs font-medium text-[rgba(255,255,255,0.4)]">Need immediate police or fire services?</span>
        <a 
          href="tel:112"
          className="flex items-center gap-2 font-black text-white bg-red-600/90 border border-red-500/50 px-4 py-2 rounded-xl hover:bg-red-500 transition shadow-[0_0_20px_rgba(220,38,38,0.2)]"
        >
          <PhoneCall className="w-4 h-4" /> Call 112
        </a>
      </div>
    </div>
  );
};
