import React from 'react';
import { 
  HeartHandshake, 
  Activity, 
  Truck, 
  Building2, 
  ShieldCheck, 
  Wifi, 
  RotateCcw,
  Layers,
  Palette,
  Sun,
  Flame
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

export const Header = () => {
  const { activeSection, setActiveSection, isOffline, resetToSampleData, theme, toggleTheme } = useCrisisCare();

  const isRed = theme === 'red';

  const navItems = [
    { id: 'overview', label: 'Command Center', icon: Layers, badge: null },
    { id: 'client', label: '1. Citizen / Client', icon: HeartHandshake, badge: 'SOS' },
    { id: 'ambulance', label: '2. Ambulance Attendant', icon: Truck, badge: 'Live GPS' },
    { id: 'hospital', label: '3. Hospital Staff', icon: Building2, badge: 'Inventory' },
    { id: 'admin', label: '4. Admin Ops', icon: ShieldCheck, badge: 'Audit' },
  ];

  return (
    <header className={`${isRed ? 'bg-[#0e0f14] border-red-900/40 shadow-xl' : 'bg-teal-deep border-teal-primary/30'} text-white border-b sticky top-0 z-50 shadow-md transition-colors duration-200`}>
      {/* Top utility alert bar */}
      <div className={`${isRed ? 'bg-[#08080a] border-red-950/80 text-slate-400' : 'bg-[#082e36] border-white/5 text-teal-light/80'} px-4 py-1.5 text-xs flex justify-between items-center border-b transition-colors`}>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className={`font-medium ${isRed ? 'text-slate-200' : 'text-white'}`}>PostGIS 3.x Spatial Engine:</span> Active (ST_DWithin 28ms)
        </div>
        <div className="flex items-center gap-4">
          {/* THEME TOGGLE (RED & BLACK / DEEP TEAL) */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border transition ${
              isRed 
                ? 'bg-red-950/70 border-red-800/60 hover:bg-red-900 text-red-200' 
                : 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
            }`}
            title="Toggle between Emergency Red & Black and Teal theme"
          >
            <Flame className="w-3.5 h-3.5 text-red-500" />
            <span>Theme: {isRed ? 'Red & Black' : 'Deep Teal'}</span>
          </button>

          <button 
            onClick={resetToSampleData}
            title="Reset to default mock datasets"
            className="hover:text-white transition flex items-center gap-1 text-[11px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded"
          >
            <RotateCcw className="w-3 h-3" /> Reset Mock Data
          </button>
        </div>
      </div>

      {/* Main Branding & Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Project Title */}
          <div 
            onClick={() => setActiveSection('overview')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform ${
              isRed ? 'bg-gradient-to-br from-red-600 to-red-800 text-white ring-2 ring-red-500/40 shadow-emergency' : 'bg-emergency-red text-white'
            }`}>
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-white">
                  CRISIS<span className={isRed ? 'text-red-500' : 'text-teal-light'}>CARE</span>
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                  isRed ? 'bg-red-950 text-red-300 border border-red-800/40' : 'bg-white/20 text-white'
                }`}>SRS v1.0</span>
              </div>
              <p className={`text-[11px] ${isRed ? 'text-slate-400' : 'text-teal-light/70'} hidden sm:block`}>
                Real-Time Healthcare Routing & Emergency Resource Infrastructure
              </p>
            </div>
          </div>

          {/* Section Selector Tabs */}
          <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive 
                      ? isRed 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-950/60 ring-1 ring-red-400/40' 
                        : 'bg-teal-primary text-white shadow-sm ring-1 ring-white/20' 
                      : isRed
                        ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      item.id === 'client' 
                        ? 'bg-white text-red-700' 
                        : isRed 
                          ? 'bg-black/40 text-red-200 border border-red-800/30' 
                          : 'bg-white/20 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
