import React, { useState, useEffect, useRef } from 'react';
import {
  HeartHandshake, ArrowRight, Clock, CheckCircle2, Stethoscope,
  ShieldCheck, Zap, UserCheck, Building2, Activity, TrendingDown,
  Timer, BedDouble, Wind, ArrowUpRight, Cpu, Globe2, Server
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { MapView } from '../common/MapView';

// ── Animated counter hook ────────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) cancelAnimationFrame(ref.current);
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return value;
}

// ── Hourly dispatch bar chart ─────────────────────────────────────────────────
const HourlyChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.count));
  const [hovered, setHovered] = useState(null);
  return (
    <div className="h-36 flex items-end gap-1 pt-8 relative" role="img" aria-label="24-hour emergency call volume chart">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        const isHov = hovered === i;
        return (
          <div
            key={i}
            className="flex-1 h-full flex flex-col justify-end items-center gap-1 cursor-pointer relative group"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {isHov && (
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-md
                              text-[#1D1D1F] text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap z-50 pointer-events-none">
                {d.count} calls at {d.hour}
              </div>
            )}
            <div
              className={`w-full rounded-t-md transition-all duration-300
                ${d.peak ? 'bg-[#FF3B30]' : 'bg-gray-200'}
                ${isHov ? 'opacity-100 shadow-[0_4px_12px_rgba(255,59,48,0.3)] scale-105' : 'opacity-90'}
              `}
              style={{ height: `${Math.max(pct, 4)}%`, minHeight: 4, transformOrigin: 'bottom' }}
            />
            <span className={`text-[9px] font-medium transition-colors ${isHov ? 'text-[#FF3B30]' : 'text-gray-400'}`}>
              {d.hour.slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── Hospital capacity card ────────────────────────────────────────────────────
const HospitalCard = ({ h }) => {
  const icuBed = h.resources?.find(r => r.resource_type === 'icu_bed')?.quantity_available ?? h.inventory?.icuBeds ?? h.icu_beds ?? 0;
  const oxygen = h.resources?.find(r => r.resource_type === 'oxygen_cylinder')?.quantity_available ?? h.inventory?.oxygenCylinders ?? h.oxygen_cylinders ?? 0;
  const hasSurgeon = h.surgeon?.isAvailable ?? icuBed > 0;
  const isFull = icuBed === 0;
  const score = h.availability_score ?? (isFull ? 0.05 : 0.65);

  return (
    <div className={`rounded-2xl border p-5 space-y-4 transition-all duration-200 hover:shadow-md
      ${isFull
        ? 'border-red-100 bg-red-50/50'
        : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-sm text-[#1D1D1F] leading-tight line-clamp-1">{h.name}</h4>
          <span className="text-[11px] text-gray-500 font-medium block mt-0.5">Tier {h.tier} • {h.address?.split(',')[0]}</span>
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full
          ${isFull
            ? 'text-[#FF3B30] bg-red-100'
            : 'text-[#34C759] bg-green-100'
          }`}
        >
          {isFull ? 'Full' : 'Ready'}
        </span>
      </div>

      {/* Score bar */}
      <div>
        <div className="flex justify-between text-[11px] font-medium mb-1.5">
          <span className="text-gray-500">Availability Score</span>
          <span className={`font-bold ${score > 0.5 ? 'text-[#34C759]' : score > 0.2 ? 'text-[#FF9500]' : 'text-[#FF3B30]'}`}>
            {Math.round(score * 100)}%
          </span>
        </div>
        <div className="gauge-track">
          <div
            className={`gauge-fill ${score > 0.5 ? 'gauge-fill-emerald' : score > 0.2 ? 'gauge-fill-amber' : 'gauge-fill-red'}`}
            style={{ width: `${Math.round(score * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div className="flex items-center gap-1.5">
          <BedDouble className="w-4 h-4 text-[#FF3B30] shrink-0" />
          <span className="text-gray-500 font-medium">ICU:</span>
          <span className={`font-bold ${isFull ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>{icuBed}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wind className="w-4 h-4 text-[#007AFF] shrink-0" />
          <span className="text-gray-500 font-medium">O₂:</span>
          <span className="font-bold text-[#1D1D1F]">{oxygen}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-medium">
        <span className="text-gray-500">Surgical Team</span>
        <span className={`font-bold ${hasSurgeon ? 'text-[#34C759]' : 'text-gray-400'}`}>
          {hasSurgeon ? '✓ Available' : '— Unavailable'}
        </span>
      </div>
    </div>
  );
};

// ── Main dashboard component ──────────────────────────────────────────────────
export const MainDashboard = () => {
  const { setActiveSection, startNewCitizenReport, citizenIncident, hospitals, backendOnline, hospitalsLoading } = useCrisisCare();

  const handleStartSos = () => {
    if (!citizenIncident || citizenIncident.statusStep >= 4 || citizenIncident.hospitalResponse === 'accepted') {
      startNewCitizenReport();
    }
    setActiveSection('client');
  };

  const totalICU    = hospitals.reduce((s, h) => s + (h.resources?.find(r => r.resource_type === 'icu_bed')?.quantity_available ?? h.inventory?.icuBeds ?? h.icu_beds ?? 0), 0);
  const totalVents  = hospitals.reduce((s, h) => s + (h.resources?.find(r => r.resource_type === 'ventilator')?.quantity_available ?? h.inventory?.ventilators ?? h.ventilators ?? 0), 0);
  const readyHosps  = hospitals.filter(h => (h.resources?.find(r => r.resource_type === 'icu_bed')?.quantity_available ?? h.inventory?.icuBeds ?? h.icu_beds ?? 0) > 0).length;

  const hourlyDispatches = [
    { hour: '00:00', count: 3 }, { hour: '02:00', count: 2 },
    { hour: '04:00', count: 1 }, { hour: '06:00', count: 4 },
    { hour: '08:00', count: 9 }, { hour: '10:00', count: 12 },
    { hour: '12:00', count: 15 }, { hour: '14:00', count: 11 },
    { hour: '16:00', count: 14 }, { hour: '18:00', count: 24, peak: true },
    { hour: '20:00', count: 28, peak: true }, { hour: '22:00', count: 18 },
  ];

  const systemFeatures = [
    { icon: Zap,         title: 'One-Tap Emergency Alert',  desc: 'Pick your emergency type — accident, cardiac, breathing problem. The nearest ambulance is sent to you automatically within seconds.', color: 'red',     tag: 'Instant Dispatch' },
    { icon: Stethoscope, title: 'Paramedic Checks Patient', desc: 'The paramedic checks the patient\'s condition at the scene — breathing, pulse, consciousness — and shares this info with the hospital before arriving.', color: 'amber',   tag: 'Live Health Data' },
    { icon: UserCheck,   title: 'Hospital Confirms Ready',  desc: 'The best hospital confirms a bed and doctor are ready before the ambulance arrives. If one hospital is full, the system automatically finds another.', color: 'emerald', tag: 'Smart Routing' },
  ];

  const benefits = [
    { icon: CheckCircle2, title: 'Prevents Bouncing', desc: 'No more arriving at a hospital only to find zero ICU beds or surgeons available.', color: 'text-[#FF3B30]', bg: 'bg-red-50' },
    { icon: Clock,        title: 'Golden Hour',    desc: 'Direct routing saves 15–30 crucial minutes during life-threatening trauma and cardiac events.', color: 'text-[#34C759]', bg: 'bg-green-50' },
    { icon: UserCheck,    title: 'Verified Surgeons',   desc: 'Hospitals confirm surgeon readiness so surgical teams are scrubbed in before the ambulance arrives.', color: 'text-[#FF9500]', bg: 'bg-orange-50' },
    { icon: ShieldCheck,  title: 'Citizen Tracker', desc: 'Citizens receive live ETA and status without clinical confusion.', color: 'text-[#007AFF]', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-12 pb-24 animate-fade-in font-sans text-[#1D1D1F]">

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HERO SECTION                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative rounded-[32px] overflow-hidden bg-white border border-gray-200 shadow-sm">
        <div className="relative z-10 p-8 sm:p-12 lg:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left text */}
            <div className="space-y-8">
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F5F5F7] border border-gray-200">
                <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse" />
                <span className="text-[#1D1D1F] text-[11px] font-bold uppercase tracking-wider">
                  Mumbai · Real-Time Emergency Infrastructure
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
                Crisis Care
                <br />
                <span className="text-[#FF3B30]">Saves Lives</span>
                <br />
                <span className="text-gray-400 text-4xl sm:text-5xl font-bold tracking-tight">in Real Time.</span>
              </h1>

              <p className="text-gray-500 text-lg sm:text-xl font-medium leading-relaxed max-w-lg">
                Connecting Mumbai's <strong className="text-[#1D1D1F]">citizens</strong>,{' '}
                <strong className="text-[#1D1D1F]">paramedics</strong>, and{' '}
                <strong className="text-[#1D1D1F]">hospitals</strong> in a synchronized, closed loop — eliminating fatal transit delays across all 6 zones.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-4 items-center pt-2">
                <button
                  onClick={handleStartSos}
                  className="btn-emergency flex items-center gap-3 text-base"
                >
                  <HeartHandshake className="w-5 h-5" />
                  <span>Report Emergency</span>
                </button>

                <button
                  onClick={() => setActiveSection('hospital')}
                  className="btn-ghost flex items-center gap-2 text-base border border-gray-200"
                >
                  <Building2 className="w-4 h-4" />
                  Hospital Operations
                </button>
              </div>
            </div>

            {/* Right: live metrics grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Stats */}
              <div className="bg-[#F5F5F7] rounded-3xl p-6 space-y-2 border border-gray-200/50 hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-[float_4s_ease-in-out_infinite]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">ICU Beds</span>
                  <BedDouble className="w-5 h-5 text-[#FF3B30] animate-pulse" />
                </div>
                <div className="text-4xl font-black text-[#1D1D1F]">{totalICU}</div>
                <div className="text-[12px] font-medium text-gray-500">Available city-wide</div>
              </div>

              <div className="bg-[#F5F5F7] rounded-3xl p-6 space-y-2 border border-gray-200/50 hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-[float_5s_ease-in-out_infinite_0.5s]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">Hospitals</span>
                  <Building2 className="w-5 h-5 text-[#34C759]" />
                </div>
                <div className="text-4xl font-black text-[#1D1D1F]">{readyHosps}</div>
                <div className="text-[12px] font-medium text-gray-500">Ready to accept</div>
              </div>

              <div className="bg-[#F5F5F7] rounded-3xl p-6 space-y-2 border border-gray-200/50 hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-[float_4.5s_ease-in-out_infinite_1s]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">Ventilators</span>
                  <Wind className="w-5 h-5 text-[#007AFF]" />
                </div>
                <div className="text-4xl font-black text-[#1D1D1F]">{totalVents}</div>
                <div className="text-[12px] font-medium text-gray-500">In service</div>
              </div>

              <div className="bg-[#F5F5F7] rounded-3xl p-6 space-y-2 border border-gray-200/50 hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-[float_5.5s_ease-in-out_infinite_1.5s]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">Response</span>
                  <Timer className="w-5 h-5 text-[#FF9500]" />
                </div>
                <div className="text-4xl font-black text-[#1D1D1F]">5.8<span className="text-xl text-gray-400">m</span></div>
                <div className="text-[12px] font-medium text-gray-500">Avg to ER admission</div>
              </div>

              {/* Architecture diagram card spanning full width */}
              <div className="col-span-2 bg-[#F5F5F7] rounded-3xl p-5 border border-gray-200/50 mt-2">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">System Architecture</span>
                  <span className="flex items-center gap-1.5 text-[#34C759] text-[11px] font-bold uppercase">
                    <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                    Live
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-2">
                  {[
                    { label: 'SOS', icon: HeartHandshake, color: 'text-[#FF3B30]' },
                    { label: '→', icon: null, color: 'text-gray-300' },
                    { label: 'Ambulance', icon: Server, color: 'text-[#FF9500]' },
                    { label: '→', icon: null, color: 'text-gray-300' },
                    { label: 'Smart Match', icon: Cpu, color: 'text-[#007AFF]' },
                    { label: '→', icon: null, color: 'text-gray-300' },
                    { label: 'Hospital ER', icon: Building2, color: 'text-[#34C759]' },
                  ].map((item, i) => (
                    <div key={i} className={`flex flex-col items-center gap-1.5 ${item.color}`}>
                      {item.icon ? <item.icon className="w-5 h-5" /> : null}
                      <span className="font-bold text-[10px] sm:text-[11px] whitespace-nowrap">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ANALYTICS SECTION                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Golden hour comparison */}
        <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Performance</span>
              <h2 className="text-2xl font-black text-[#1D1D1F] flex items-center gap-2">
                <Timer className="w-6 h-6 text-[#FF3B30]" />
                Golden Hour Savings
              </h2>
            </div>
            <span className="bg-green-100 text-[#34C759] text-sm font-bold px-3 py-1 rounded-full">−76%</span>
          </div>

          <div className="space-y-5 pt-2">
            <div>
              <div className="flex justify-between text-sm font-bold mb-2">
                <span className="flex items-center gap-2 text-[#34C759]">
                  Crisis Care
                </span>
                <span className="font-mono text-[#34C759]">5.8 min</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#34C759] rounded-full" style={{ width: '24%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm font-bold mb-2">
                <span className="flex items-center gap-2 text-gray-500">
                  Traditional 108
                </span>
                <span className="font-mono text-gray-500">24.5 min</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-400 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 flex items-center gap-4 mt-6">
            <TrendingDown className="w-6 h-6 text-[#FF3B30] shrink-0" />
            <div>
              <span className="text-sm font-bold text-[#FF3B30] block">18.7 minutes saved per patient</span>
              <span className="text-[12px] text-[#FF3B30] font-medium opacity-80">Prevents emergency trauma bay rejection at the ER door</span>
            </div>
          </div>
        </div>

        {/* 24-hour dispatch volume */}
        <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm p-8 space-y-6">
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Live Volume</span>
            <h2 className="text-2xl font-black text-[#1D1D1F] flex items-center gap-2">
              <Activity className="w-6 h-6 text-[#FF3B30]" />
              Emergency Dispatch
            </h2>
          </div>

          <div className="relative pt-2">
            <HourlyChart data={hourlyDispatches} />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { label: 'Road Accidents', pct: 38, color: 'bg-[#FF3B30]' },
              { label: 'Cardiac', pct: 28, color: 'bg-[#FF9500]' },
              { label: 'Respiratory', pct: 16, color: 'bg-[#007AFF]' },
              { label: 'Trauma', pct: 12, color: 'bg-[#AF52DE]' },
            ].map(cat => (
              <span key={cat.label} className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                {cat.label}: <span className="text-[#1D1D1F]">{cat.pct}%</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LIVE INTERACTIVE MAP                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm p-8 space-y-6">
        <div>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF9500] animate-pulse" />
            Live Map Operations
          </span>
          <h2 className="text-3xl font-black text-[#1D1D1F]">
            Mumbai Emergency Tracking
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-2">
            Active emergency incidents and operational zones across all six Mumbai districts. (Hospital locations omitted for security protocols).
          </p>
        </div>
        <div className="w-full relative shadow-md rounded-2xl overflow-hidden border border-gray-200">
          <MapView 
            userLocation={{ lat: 19.0760, lng: 72.8777, address: 'Central Mumbai' }}
            activeRouteTarget={citizenIncident && citizenIncident.hospitalResponse === 'accepted' ? 
              hospitals.find(h => h.id === citizenIncident.hospitalId) : null}
            height="500px"
            originLabel="City Center"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LIVE ACTIVITY TICKER                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm p-8 space-y-6 overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        <div className="flex items-center gap-3 mb-2 relative z-20">
          <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF] animate-ping shadow-[0_0_8px_rgba(0,122,255,0.6)]" />
          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Live Network Activity</h2>
        </div>
        <div className="flex gap-4 animate-[ticker_30s_linear_infinite] whitespace-nowrap w-[200%]">
          {[...Array(3)].map((_, i) => (
            <React.Fragment key={i}>
              <div className="inline-flex items-center gap-3 bg-[#F5F5F7] px-5 py-3 rounded-2xl border border-gray-200/60 shadow-sm transition-transform hover:scale-105">
                <span className="text-[#34C759] font-bold text-xs bg-green-100 px-2 py-1 rounded-md">LIVE</span>
                <span className="text-[#1D1D1F] text-sm font-semibold">Ambulance dispatched to Andheri East</span>
              </div>
              <div className="inline-flex items-center gap-3 bg-[#F5F5F7] px-5 py-3 rounded-2xl border border-gray-200/60 shadow-sm transition-transform hover:scale-105">
                <span className="text-[#FF9500] font-bold text-xs bg-orange-100 px-2 py-1 rounded-md">UPDATE</span>
                <span className="text-[#1D1D1F] text-sm font-semibold">ETA revised — Bandra Kurla Complex</span>
              </div>
              <div className="inline-flex items-center gap-3 bg-[#F5F5F7] px-5 py-3 rounded-2xl border border-gray-200/60 shadow-sm transition-transform hover:scale-105">
                <span className="text-[#007AFF] font-bold text-xs bg-blue-100 px-2 py-1 rounded-md">SYNC</span>
                <span className="text-[#1D1D1F] text-sm font-semibold">Routing grid optimised — Dadar zone</span>
              </div>
              <div className="inline-flex items-center gap-3 bg-[#F5F5F7] px-5 py-3 rounded-2xl border border-gray-200/60 shadow-sm transition-transform hover:scale-105">
                <span className="text-[#FF3B30] font-bold text-xs bg-red-100 px-2 py-1 rounded-md">ALERT</span>
                <span className="text-[#1D1D1F] text-sm font-semibold">Priority routing activated — Borivali trauma</span>
              </div>
              <div className="inline-flex items-center gap-3 bg-[#F5F5F7] px-5 py-3 rounded-2xl border border-gray-200/60 shadow-sm transition-transform hover:scale-105">
                <span className="text-[#34C759] font-bold text-xs bg-green-100 px-2 py-1 rounded-md">LIVE</span>
                <span className="text-[#1D1D1F] text-sm font-semibold">Paramedic PARA-118 responding — Worli</span>
              </div>
              <div className="inline-flex items-center gap-3 bg-[#F5F5F7] px-5 py-3 rounded-2xl border border-gray-200/60 shadow-sm transition-transform hover:scale-105">
                <span className="text-[#AF52DE] font-bold text-xs bg-purple-100 px-2 py-1 rounded-md">ICU</span>
                <span className="text-[#1D1D1F] text-sm font-semibold">Bed reserved at KEM Hospital, Parel</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS — 3 STEPS                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm p-8 space-y-8">
        <div>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">System Flow</span>
          <h2 className="text-3xl font-black text-[#1D1D1F]">How Crisis Care Works</h2>
          <p className="text-sm font-medium text-gray-500 mt-2">Three coordinated actors, one closed loop</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {systemFeatures.map((f, i) => {
            const Icon = f.icon;
            const colorMap = { red: 'text-[#FF3B30] bg-red-50 border-red-100', amber: 'text-[#FF9500] bg-orange-50 border-orange-100', emerald: 'text-[#34C759] bg-green-50 border-green-100' };
            const badgeMap = { red: 'bg-red-100 text-[#FF3B30]', amber: 'bg-orange-100 text-[#FF9500]', emerald: 'bg-green-100 text-[#34C759]' };
            return (
              <div
                key={i}
                className={`relative rounded-2xl border p-6 space-y-4 hover:shadow-md transition-shadow ${colorMap[f.color]}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${badgeMap[f.color]}`}>{f.tag}</span>
                </div>
                <h3 className="font-bold text-lg text-[#1D1D1F]">{f.title}</h3>
                <p className="text-sm font-medium text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* KEY BENEFITS                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm p-8 space-y-8">
        <div>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Impact</span>
          <h2 className="text-3xl font-black text-[#1D1D1F]">Key Benefits</h2>
          <p className="text-sm font-medium text-gray-500 mt-2">Eliminating the gap between transport and hospital readiness</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className={`rounded-2xl p-6 space-y-4 border border-gray-100 ${b.bg}`}>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Icon className={`w-5 h-5 ${b.color}`} />
                </div>
                <h4 className="font-bold text-base text-[#1D1D1F]">{b.title}</h4>
                <p className="text-sm font-medium text-gray-600 leading-relaxed">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
