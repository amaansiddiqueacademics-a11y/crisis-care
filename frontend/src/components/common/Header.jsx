import React from 'react';
import { Activity, Building2, HeartHandshake, Layers, PhoneCall, ShieldCheck, Truck } from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

const NAV = [
  { id: 'overview', label: 'Home', icon: Layers },
  { id: 'client', label: 'Get help', icon: HeartHandshake, sos: true },
  { id: 'ambulance', label: 'Ambulance', icon: Truck, role: 'ambulance' },
  { id: 'hospital', label: 'Hospital', icon: Building2, role: 'hospital' },
  { id: 'admin', label: 'Dispatch', icon: ShieldCheck, role: 'admin' },
];

export const Header = () => {
  const { activeSection, setActiveSection, sessions } = useCrisisCare();

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur text-stone-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        <a href="#/" className="flex items-center gap-2.5 shrink-0" aria-label="Crisis Care home">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 text-white flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </span>
          <span className="hidden sm:inline font-black text-lg tracking-tight">
            CRISIS<span className="text-amber-600">CARE</span>
          </span>
        </a>

        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Portals">
          {NAV.map(({ id, label, icon: Icon, sos, role }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
                className={`relative flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                  isActive ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{label}</span>
                {sos && <span className="text-[10px] font-black px-1.5 rounded bg-red-600 text-white">SOS</span>}
                {role && sessions[role] && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" title="Signed in" />}
              </button>
            );
          })}

          <span className="w-px h-6 bg-stone-200 mx-1" aria-hidden="true" />

          <a href="tel:108" className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 px-2.5 sm:px-3 py-2 text-sm font-black" aria-label="Call 108 ambulance">
            <PhoneCall className="w-4 h-4" /> 108
          </a>
          <a href="tel:112" className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm font-black" aria-label="Call 112 emergency">
            112
          </a>
        </nav>
      </div>
    </header>
  );
};
