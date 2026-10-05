import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  Activity,
  Truck,
  Building2,
  ShieldCheck,
  RotateCcw,
  Flame,
  Wifi,
  WifiOff,
  Layers,
  Circle,
  ChevronDown,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

const NAV_ITEMS = [
  { id: 'overview',   label: 'Dashboard',    short: 'Home',     icon: Layers,        badge: null },
  { id: 'client',     label: 'Citizen SOS',  short: 'SOS',      icon: HeartHandshake, badge: 'LIVE' },
  { id: 'ambulance',  label: 'Ambulance',    short: 'Ambu',     icon: Truck,          badge: 'GPS' },
  { id: 'hospital',   label: 'Hospital ER',  short: 'ER',       icon: Building2,      badge: 'INVENTORY' },
  { id: 'admin',      label: 'Admin Ops',    short: 'Admin',    icon: ShieldCheck,    badge: null },
];

export const Header = () => {
  const {
    activeSection, setActiveSection,
    isOffline, resetToSampleData,
    theme, toggleTheme,
    backendOnline, citizenIncident,
  } = useCrisisCare();

  const [scrolled, setScrolled]       = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [time, setTime]               = useState(new Date());

  // Scroll effect
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isRed = theme === 'red';

  const backendStatus =
    backendOnline === true  ? { label: 'Backend Online',  color: '#22c55e', pulse: true }  :
    backendOnline === false ? { label: 'Demo Mode',        color: '#f59e0b', pulse: false } :
    { label: 'Connecting…',   color: '#94a3b8', pulse: false };

  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <>
      {/* ── Top alert bar ───────────────────────────────────────────────── */}
      <div className={`
        relative z-50 border-b transition-all duration-300
        ${scrolled ? 'hidden' : 'flex'}
        items-center justify-between px-4 py-1.5 text-xs
        bg-[#0a0b0f] border-[rgba(255,255,255,0.06)]
      `}>
        {/* Left: backend status */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: backendStatus.color, boxShadow: backendOnline ? `0 0 6px ${backendStatus.color}` : 'none' }}
            />
            <span style={{ color: backendStatus.color }} className="font-semibold font-mono tracking-wide text-[10px] uppercase">
              {backendStatus.label}
            </span>
          </span>
          <span className="text-[rgba(255,255,255,0.25)] select-none">|</span>
          <span className="text-[rgba(255,255,255,0.35)] font-mono text-[10px]">
            PostGIS ST_DWithin • &lt;30ms
          </span>
          {citizenIncident && (
            <>
              <span className="text-[rgba(255,255,255,0.25)] select-none">|</span>
              <span className="flex items-center gap-1 text-[#f87171] font-semibold animate-pulse">
                <Circle className="w-1.5 h-1.5 fill-current" />
                Active Emergency
              </span>
            </>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[rgba(255,255,255,0.25)]">{timeStr}</span>

          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition-all
                       bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)]
                       text-[rgba(255,255,255,0.5)] hover:text-white border border-[rgba(255,255,255,0.07)]"
          >
            <Flame className="w-2.5 h-2.5 text-red-500" />
            {isRed ? 'Red & Black' : 'Deep Teal'}
          </button>

          <button
            onClick={resetToSampleData}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition-all
                       bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)]
                       text-[rgba(255,255,255,0.4)] hover:text-white border border-[rgba(255,255,255,0.07)]"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>

          {isOffline && (
            <span className="flex items-center gap-1 text-amber-400 font-semibold">
              <WifiOff className="w-3 h-3" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* ── Main nav ────────────────────────────────────────────────────── */}
      <header className={`
        sticky top-0 z-50 transition-all duration-300
        ${scrolled
          ? 'bg-[rgba(8,10,15,0.92)] backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.6)]'
          : 'bg-[#090b10] border-b border-[rgba(255,255,255,0.06)]'
        }
      `}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[60px]">

            {/* Logo */}
            <button
              onClick={() => { setActiveSection('overview'); setMobileOpen(false); }}
              className="flex items-center gap-3 group shrink-0"
            >
              <div className="relative w-9 h-9 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-700 to-red-900" />
                <div className="absolute inset-0 bg-[noise] opacity-30" />
                <Activity className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-sm" />
                {/* Pulse ring when there's an active emergency */}
                {citizenIncident && (
                  <div className="absolute inset-0 rounded-xl ring-2 ring-red-500 animate-ping opacity-60" />
                )}
              </div>
              <div className="hidden sm:block">
                <span className="text-white font-black text-lg tracking-tight leading-none">
                  CRISIS<span className="text-red-500">CARE</span>
                </span>
                <div className="text-[10px] text-[rgba(255,255,255,0.3)] font-medium tracking-widest uppercase leading-none mt-0.5">
                  Real-Time Emergency Routing
                </div>
              </div>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-0.5 tab-scroll">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`
                      relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold
                      whitespace-nowrap transition-all duration-200
                      ${isActive
                        ? 'text-white bg-[rgba(255,255,255,0.1)] shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                        : 'text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.06)]'
                      }
                    `}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`
                        text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider leading-none
                        ${item.id === 'client'
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)]'
                        }
                      `}>
                        {item.badge}
                      </span>
                    )}
                    {/* Active underline */}
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right: status chip + mobile toggle */}
            <div className="flex items-center gap-2">
              {/* Live status */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass text-xs">
                <span className="live-dot" style={{ width: 6, height: 6, background: backendStatus.color }} />
                <span className="text-[rgba(255,255,255,0.5)] font-mono text-[10px]">
                  {isOffline ? 'OFFLINE' : 'LIVE'}
                </span>
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="md:hidden flex items-center gap-1 px-3 py-1.5 rounded-lg glass text-xs text-white"
              >
                <span>{mobileOpen ? 'Close' : 'Menu'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mobileOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[rgba(255,255,255,0.07)] bg-[#0d0f14] animate-slide-up">
            <div className="max-w-7xl mx-auto px-4 py-2 space-y-0.5">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveSection(item.id); setMobileOpen(false); }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-left
                      transition-all duration-150
                      ${isActive
                        ? 'text-white bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.2)]'
                        : 'text-[rgba(255,255,255,0.55)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                    {item.badge && item.id === 'client' && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold bg-red-600 text-white animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>
    </>
  );
};
