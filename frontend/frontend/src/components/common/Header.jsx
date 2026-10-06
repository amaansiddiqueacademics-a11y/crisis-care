import React, { useState, useEffect, useRef } from 'react';
import {
  HeartHandshake,
  Activity,
  Truck,
  Building2,
  ShieldCheck,
  RotateCcw,
  Wifi,
  WifiOff,
  Layers,
  Circle,
  ChevronDown,
  Check,
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
    isOffline,
    theme, chooseTheme, resetTheme,
    backendOnline, citizenIncident,
  } = useCrisisCare();

  const [scrolled, setScrolled]       = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [time, setTime]               = useState(new Date());
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef(null);

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

  useEffect(() => {
    const onPointerDown = event => { if (!themeMenuRef.current?.contains(event.target)) setThemeMenuOpen(false); };
    const onKeyDown = event => { if (event.key === 'Escape') setThemeMenuOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, []);

  const isCoral = theme === 'coral-slate';

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
            system-bar bg-[#071A1C] border-[rgba(255,255,255,0.06)]
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

          <div className="relative" ref={themeMenuRef}>
            <button type="button" aria-haspopup="menu" aria-expanded={themeMenuOpen} onClick={() => setThemeMenuOpen(v => !v)} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[.07] px-2 py-1 text-[10px] font-semibold text-white/85 transition hover:bg-white/[.12] hover:text-white">
              <span className={`h-2 w-2 rounded-full ${isCoral ? 'bg-[#FF453A]' : 'bg-[#2A9D8F]'}`} />
              {isCoral ? 'Coral & Slate' : 'Coastal Teal'} <ChevronDown className={`h-3 w-3 transition-transform ${themeMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {themeMenuOpen && <div role="menu" aria-label="Select application theme" className="absolute right-0 top-full z-[80] mt-2 w-56 rounded-xl border border-[#D7E1DF] bg-white p-2 text-[#102A2B] shadow-[0_14px_38px_rgba(7,26,28,.2)]">
              <div className="px-2 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[.16em] text-[#718486]">Theme</div>
              {[{ id: 'coral-slate', label: 'Coral & Slate', swatches: ['#FF453A', '#071A1C', '#F4F7F6'] }, { id: 'coastal-teal', label: 'Coastal Teal', swatches: ['#0F766E', '#073B3A', '#F2F8F7'] }].map(option => {
                const selected = theme === option.id;
                return <button key={option.id} type="button" role="menuitemradio" aria-checked={selected} onClick={() => { chooseTheme(option.id); setThemeMenuOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs transition ${selected ? 'bg-[#EAF0EF] font-semibold text-[#102A2B]' : 'text-[#526668] hover:bg-[#F4F7F6]'}`}>
                  <span className="flex shrink-0 -space-x-1">{option.swatches.map(color => <i key={color} className="h-3.5 w-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />)}</span><span className="flex-1">{option.label}</span>{selected && <Check className="h-3.5 w-3.5 text-[#2675D9]" />}
                </button>;
              })}
            </div>}
          </div>
          <button type="button" onClick={() => { resetTheme(); setThemeMenuOpen(false); }} title="Reset theme to Coral & Slate" className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[.05] px-2 py-1 text-[10px] font-semibold text-white/65 transition hover:bg-white/[.1] hover:text-white"><RotateCcw className="h-2.5 w-2.5" /> Reset</button>

          {isOffline && (
            <span className="flex items-center gap-1 text-amber-400 font-semibold">
              <WifiOff className="w-3 h-3" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* ── Main nav ────────────────────────────────────────────────────── */}
      <header className={`primary-nav
        sticky top-0 z-50 transition-all duration-300
        ${scrolled
          ? 'bg-[rgba(11,37,39,0.96)] backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.24)]'
          : 'bg-[#0B2527] border-b border-[rgba(255,255,255,0.06)]'
        }
      `}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[60px]">

            {/* Logo */}
            <button
              onClick={() => { setActiveSection('overview'); setMobileOpen(false); }}
              className="flex items-center gap-3 group shrink-0"
            >
              <div className="cc-logo-mark relative w-9 h-9 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-[noise] opacity-30" />
                <Activity className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-sm" />
                {/* Pulse ring when there's an active emergency */}
                {citizenIncident && (
                  <div className="absolute inset-0 rounded-xl ring-2 ring-red-500 animate-ping opacity-60" />
                )}
              </div>
              <div className="hidden sm:block">
                <span className="text-white font-black text-lg tracking-tight leading-none">
                  CRISIS<span className="cc-brand-accent">CARE</span>
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
                      <span className="cc-nav-indicator absolute bottom-0 left-2 right-2 h-px" />
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
          <div className="cc-mobile-nav md:hidden border-t border-[rgba(255,255,255,0.07)] bg-[#0d0f14] animate-slide-up">
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
