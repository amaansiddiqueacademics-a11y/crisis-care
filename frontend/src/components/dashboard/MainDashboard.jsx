import React, { useState } from 'react';
import { 
  HeartHandshake, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Stethoscope, 
  ShieldCheck, 
  Zap, 
  UserCheck, 
  Building2, 
  Radio, 
  Navigation, 
  Activity,
  BarChart3,
  TrendingDown,
  Timer,
  BedDouble,
  Wind,
  AlertTriangle
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';

export const MainDashboard = () => {
  const { 
    setActiveSection, 
    theme, 
    startNewCitizenReport, 
    citizenIncident,
    hospitals 
  } = useCrisisCare();

  const isRed = theme === 'red';
  const [activeHourlyHover, setActiveHourlyHover] = useState(null);

  const handleStartSos = () => {
    if (!citizenIncident || citizenIncident.statusStep >= 4 || citizenIncident.hospitalResponse === 'accepted') {
      startNewCitizenReport();
    }
    setActiveSection('client');
  };

  // 24-Hour Mock Emergency Dispatch Distribution
  const hourlyDispatches = [
    { hour: '00:00', count: 3 },
    { hour: '02:00', count: 2 },
    { hour: '04:00', count: 1 },
    { hour: '06:00', count: 4 },
    { hour: '08:00', count: 9 },
    { hour: '10:00', count: 12 },
    { hour: '12:00', count: 15 },
    { hour: '14:00', count: 11 },
    { hour: '16:00', count: 14 },
    { hour: '18:00', count: 24, peak: true },
    { hour: '20:00', count: 28, peak: true },
    { hour: '22:00', count: 18 }
  ];

  const maxHourlyCount = Math.max(...hourlyDispatches.map(d => d.count));

  // Category percentage distribution
  const emergencyDistributions = [
    { name: 'Road Accidents', pct: 38, color: 'bg-red-600', count: '142 Cases' },
    { name: 'Cardiac & Chest Pain', pct: 28, color: 'bg-red-500', count: '104 Cases' },
    { name: 'Breathing / Choking', pct: 16, color: 'bg-amber-500', count: '60 Cases' },
    { name: 'Severe Bleeding & Trauma', pct: 12, color: 'bg-rose-700', count: '45 Cases' },
    { name: 'Other Emergencies', pct: 6, color: 'bg-slate-500', count: '22 Cases' }
  ];

  return (
    <div className="space-y-8 pb-16 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. HERO BANNER WITH EMERGENCY IMAGERY & RED & BLACK THEME                 */}
      {/* ========================================================================= */}
      <div className={`rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden transition-all duration-300 ${
        isRed 
          ? 'bg-gradient-to-br from-[#0c0d12] via-[#160a0d] to-[#2b0808] border border-red-900/50 text-white' 
          : 'bg-gradient-to-br from-teal-deep via-[#0c4e5c] to-teal-primary text-white'
      }`}>
        <div className="absolute right-0 top-0 translate-x-20 -translate-y-20 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text & CTA */}
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/70 border border-red-700/50 text-red-200 font-black text-xs uppercase tracking-wider shadow-sm backdrop-blur-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              Real-Time Healthcare Routing & Emergency Resource Infrastructure
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Crisis Care: Real-Time Healthcare Routing System
            </h1>

            <p className={`text-sm sm:text-base leading-relaxed ${isRed ? 'text-slate-300' : 'text-white/95'}`}>
              Crisis Care connects <strong>citizens in distress</strong>, <strong>ambulance attendants</strong>, and <strong>hospital emergency departments</strong> into a synchronized, real-time closed loop. It eliminates fatal transit delays by ensuring patients are only transported to facilities with live, verified beds, oxygen, and ready surgical teams.
            </p>

            {/* Clean, dominant primary action */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={handleStartSos}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-base px-8 py-4 rounded-2xl shadow-xl shadow-red-950/80 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3 border border-red-400/40"
              >
                <HeartHandshake className="w-6 h-6 text-white" />
                <span>REPORT EMERGENCY (CITIZEN SOS)</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className={`flex items-center gap-2 text-xs font-semibold ${isRed ? 'text-slate-400' : 'text-white/80'}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Active 24x7 CAD Link Online</span>
              </div>
            </div>
          </div>

          {/* Right Image Feature */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-red-600/30 group">
              <img 
                src="/images/emergency-hero.jpg" 
                alt="Crisis Care Live Ambulance Telemetry Routing" 
                className="w-full h-64 sm:h-72 object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
              
              {/* Floating Live Badges over Image */}
              <div className="absolute top-3 right-3 bg-red-600 text-white font-black text-[10px] uppercase px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 animate-pulse">
                <Radio className="w-3 h-3" />
                Live Telemetry Active
              </div>

              <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md border border-white/15 p-2.5 rounded-xl text-white">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold flex items-center gap-1 text-red-400">
                    <Navigation className="w-3.5 h-3.5" /> Intelligent CAD Navigation
                  </span>
                  <span className="text-[11px] text-slate-300 font-mono">ETA ~4 mins</span>
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  Dynamic routing to hospitals with verified resources & available surgeons.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. LIVE REAL-TIME PERFORMANCE GRAPHS & ANALYTICS (RED THEME)              */}
      {/* ========================================================================= */}
      <div className={`rounded-3xl border p-6 sm:p-8 shadow-xl space-y-6 ${
        isRed 
          ? 'bg-[#111218] border-red-950/70 text-slate-100' 
          : 'bg-surface-card border-surface-border text-slate-900'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 border-slate-800/60">
          <div>
            <span className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border inline-block mb-2 ${
              isRed 
                ? 'bg-red-950/70 text-red-400 border-red-800/40' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              Real-Time Metrics & Graphs
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-red-500" />
              Live Healthcare Routing Analytics
            </h2>
            <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isRed ? 'text-slate-400' : 'text-surface-muted'}`}>
              Telemetry data, transit time reductions, and real-time hospital resource capacity across Mumbai:
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs font-mono font-bold text-emerald-400">PostGIS ST_DWithin: 28ms</span>
          </div>
        </div>

        {/* 2-Column Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Graph 1: Golden-Hour Response Time Comparison (Left 6 Cols) */}
          <div className={`lg:col-span-6 rounded-2xl border p-5 space-y-4 ${
            isRed ? 'bg-[#181922] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <Timer className="w-4 h-4 text-red-500" />
                  Golden Hour Transit Time Savings
                </h3>
                <p className="text-[11px] text-slate-400">Crisis Care Closed-Loop vs Traditional 108 System</p>
              </div>
              <span className="text-xs font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                -76% Faster
              </span>
            </div>

            {/* Horizontal Bar Visualizer */}
            <div className="space-y-4 pt-2">
              {/* Crisis Care Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Crisis Care Routing
                  </span>
                  <span className="font-mono text-emerald-400 font-extrabold">5.8 mins to ER Admission</span>
                </div>
                <div className="h-6 w-full bg-slate-900/60 rounded-xl overflow-hidden p-0.5 border border-slate-700/50">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-lg flex items-center justify-end pr-2 text-[10px] font-black text-slate-950" 
                    style={{ width: '24%' }}
                  >
                    5.8m
                  </div>
                </div>
              </div>

              {/* Traditional Dispatch Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> Traditional 108 (Manual Bouncing)
                  </span>
                  <span className="font-mono text-rose-400 font-extrabold">24.5 mins Average</span>
                </div>
                <div className="h-6 w-full bg-slate-900/60 rounded-xl overflow-hidden p-0.5 border border-slate-700/50">
                  <div 
                    className="h-full bg-gradient-to-r from-red-700 to-rose-600 rounded-lg flex items-center justify-end pr-2 text-[10px] font-black text-white" 
                    style={{ width: '100%' }}
                  >
                    24.5m
                  </div>
                </div>
              </div>
            </div>

            {/* Time Saved Highlight Card */}
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-white block">18.7 Minutes Saved Per Patient</span>
                  <span className="text-[10px] text-slate-400">Prevents emergency trauma bay rejection at the ER door</span>
                </div>
              </div>
              <span className="text-xs font-black text-red-400 bg-red-900/50 px-2 py-1 rounded-lg">High Impact</span>
            </div>
          </div>

          {/* Graph 2: 24-Hour Emergency Dispatch Volume (Right 6 Cols) */}
          <div className={`lg:col-span-6 rounded-2xl border p-5 space-y-4 ${
            isRed ? 'bg-[#181922] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-500" />
                  24-Hour Emergency Dispatch Volume
                </h3>
                <p className="text-[11px] text-slate-400">Peak trauma surge occurs during evening commute (18:00 - 22:00)</p>
              </div>
              <span className="text-xs font-mono font-black text-red-400">
                {activeHourlyHover ? `${activeHourlyHover.hour}: ${activeHourlyHover.count} Calls` : 'Hover to Inspect'}
              </span>
            </div>

            {/* Bar Chart Visualization */}
            <div className="h-40 flex items-end justify-between gap-1.5 pt-6 px-1 border-b border-slate-800">
              {hourlyDispatches.map((d, idx) => {
                const heightPct = (d.count / maxHourlyCount) * 100;
                return (
                  <div 
                    key={idx} 
                    onMouseEnter={() => setActiveHourlyHover(d)}
                    onMouseLeave={() => setActiveHourlyHover(null)}
                    className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                  >
                    <div 
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        d.peak 
                          ? 'bg-gradient-to-t from-red-700 to-red-500 group-hover:from-red-600 group-hover:to-red-400 shadow-md shadow-red-900/40' 
                          : 'bg-slate-700/60 group-hover:bg-red-600/70'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    ></div>
                    <span className="text-[9px] text-slate-500 font-mono scale-90 group-hover:text-red-400">
                      {d.hour.slice(0, 2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Category breakdown pills */}
            <div className="flex flex-wrap gap-2 pt-1 text-[10px]">
              {emergencyDistributions.slice(0, 4).map((cat, i) => (
                <span key={i} className="flex items-center gap-1 text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                  <span className={`w-2 h-2 rounded-full ${cat.color}`}></span>
                  <span>{cat.name}: <strong>{cat.pct}%</strong></span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Graph 3: Live Hospital Resource Capacity Matrix */}
        <div className={`rounded-2xl border p-5 space-y-4 ${
          isRed ? 'bg-[#181922] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-500" />
                Live Hospital Capacity & Verification Matrix
              </h3>
              <p className="text-[11px] text-slate-400">Real-time ICU resuscitation beds, oxygen reserve, and on-duty trauma surgeons across facilities</p>
            </div>
            <span className="text-xs font-extrabold text-red-400 bg-red-950/60 border border-red-900/40 px-2.5 py-1 rounded-xl">
              Live Network Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {hospitals.map((h) => {
              const beds = h.inventory?.icuBeds || 0;
              const oxygen = h.inventory?.oxygenCylinders || 0;
              const hasSurgeon = h.surgeon?.isAvailable;
              const isExhausted = beds === 0;

              return (
                <div 
                  key={h.id}
                  className={`p-4 rounded-xl border space-y-3 ${
                    isExhausted 
                      ? 'bg-red-950/30 border-red-800/50' 
                      : 'bg-slate-900/40 border-slate-800/80 hover:border-red-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-xs text-white line-clamp-1">{h.name}</h4>
                      <span className="text-[10px] text-slate-400 block">{h.traumaLevel}</span>
                    </div>
                    {isExhausted ? (
                      <span className="text-[9px] font-black uppercase text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-800/40 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> Full
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        Ready
                      </span>
                    )}
                  </div>

                  {/* Resource Gauges */}
                  <div className="space-y-2 text-[11px]">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="flex items-center gap-1 text-slate-400">
                          <BedDouble className="w-3 h-3 text-red-400" /> ICU Beds:
                        </span>
                        <strong className={isExhausted ? 'text-red-400' : 'text-white'}>
                          {beds} Available
                        </strong>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isExhausted ? 'bg-red-600' : 'bg-gradient-to-r from-red-600 to-emerald-400'}`}
                          style={{ width: `${Math.min(100, (beds / 12) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Wind className="w-3 h-3 text-sky-400" /> Oxygen Cylinders:
                        </span>
                        <strong className="text-white">{oxygen} Units</strong>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-sky-500 rounded-full"
                          style={{ width: `${Math.min(100, (oxygen / 60) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">On-Duty Surgeon:</span>
                    <span className={`font-bold ${hasSurgeon ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {hasSurgeon ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. WHAT OUR APP IS DOING (WITH VISUAL IMAGES)                             */}
      {/* ========================================================================= */}
      <div className={`rounded-3xl border p-6 sm:p-8 shadow-xl space-y-6 ${
        isRed 
          ? 'bg-[#111218] border-red-950/70 text-slate-100' 
          : 'bg-surface-card border-surface-border text-slate-900'
      }`}>
        <div>
          <span className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border inline-block mb-2 ${
            isRed 
              ? 'bg-red-950/70 text-red-400 border-red-800/40' 
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            System Functionality
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            What Our App Is Doing
          </h2>
          <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isRed ? 'text-slate-400' : 'text-surface-muted'}`}>
            Crisis Care coordinates the entire emergency response pipeline from initial bystander SOS to hospital trauma bay admission:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Zero-Friction Citizen SOS */}
          <div className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition hover:border-red-500/60 ${
            isRed ? 'bg-[#181922] border-slate-800' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold border border-red-500/20">
                <Zap className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-extrabold text-base">1. Zero-Friction Citizen SOS</h3>
              <p className={`text-xs leading-relaxed ${isRed ? 'text-slate-300' : 'text-slate-600'}`}>
                When an accident occurs, bystanders don't need clinical knowledge. They select what happened from 17 clear emergency categories and submit location. The nearest ambulance is immediately dispatched.
              </p>
            </div>
            <div className={`pt-3 border-t text-[11px] font-bold flex items-center gap-1.5 ${isRed ? 'border-slate-800 text-red-400' : 'border-slate-200 text-red-700'}`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Instant CAD Auto-Dispatch</span>
            </div>
          </div>

          {/* Card 2: Paramedic Clinical Check (With Telemetry Image) */}
          <div className={`rounded-2xl border overflow-hidden flex flex-col justify-between space-y-4 transition hover:border-red-500/60 ${
            isRed ? 'bg-[#181922] border-slate-800' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="h-36 overflow-hidden relative">
              <img 
                src="/images/paramedic-vitals.jpg" 
                alt="Paramedic evaluating vitals" 
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-amber-600/90 px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                <Stethoscope className="w-3 h-3" /> On-Scene Clinical Triage
              </span>
            </div>
            <div className="px-5 pb-5 space-y-3">
              <h3 className="font-extrabold text-base">2. Paramedic Clinical Check</h3>
              <p className={`text-xs leading-relaxed ${isRed ? 'text-slate-300' : 'text-slate-600'}`}>
                The attendant evaluates vital signs on scene: consciousness, breathing, pulse, and bleeding. The attendant clicks a nearby hospital to transmit telemetry directly to their emergency room.
              </p>
              <div className={`pt-2 border-t text-[11px] font-bold flex items-center gap-1.5 ${isRed ? 'border-slate-800 text-amber-400' : 'border-slate-200 text-amber-700'}`}>
                <Activity className="w-4 h-4 shrink-0" />
                <span>Real-Time Vitals Telemetry</span>
              </div>
            </div>
          </div>

          {/* Card 3: Hospital Resource Acceptance / Decline (With Trauma Room Image) */}
          <div className={`rounded-2xl border overflow-hidden flex flex-col justify-between space-y-4 transition hover:border-red-500/60 ${
            isRed ? 'bg-[#181922] border-slate-800' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="h-36 overflow-hidden relative">
              <img 
                src="/images/hospital-trauma.jpg" 
                alt="Hospital Trauma Bay & Surgeon Ready" 
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-emerald-600/90 px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Hospital ER Verification
              </span>
            </div>
            <div className="px-5 pb-5 space-y-3">
              <h3 className="font-extrabold text-base">3. Resource Acceptance or Re-Route</h3>
              <p className={`text-xs leading-relaxed ${isRed ? 'text-slate-300' : 'text-slate-600'}`}>
                The hospital receives patient telemetry. If beds and surgeons are ready, they <strong>Accept</strong> and reserve the trauma bay. If resources are exhausted, they <strong>Decline</strong>, and the ambulance immediately routes to another hospital!
              </p>
              <div className={`pt-2 border-t text-[11px] font-bold flex items-center gap-1.5 ${isRed ? 'border-slate-800 text-emerald-400' : 'border-slate-200 text-status-green'}`}>
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>Verified On-Duty Surgeons Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. KEY BENEFITS OF CRISIS CARE                                            */}
      {/* ========================================================================= */}
      <div className={`rounded-3xl border p-6 sm:p-8 shadow-xl space-y-6 ${
        isRed 
          ? 'bg-[#111218] border-red-950/70 text-slate-100' 
          : 'bg-surface-card border-surface-border text-slate-900'
      }`}>
        <div>
          <span className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border inline-block mb-2 ${
            isRed 
              ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/40' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            Clinical Impact & Safety
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Key Benefits of Crisis Care
          </h2>
          <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isRed ? 'text-slate-400' : 'text-surface-muted'}`}>
            Eliminating the dangerous gap between ambulance transport and hospital resource availability:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-5 rounded-2xl border space-y-2.5 transition ${
            isRed 
              ? 'bg-[#181922] border-red-950/80 hover:border-red-600/40' 
              : 'border-slate-200 bg-red-50/40'
          }`}>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5 text-red-500" />
            </div>
            <h4 className="font-extrabold text-sm">Prevents Ambulance Bouncing</h4>
            <p className={`text-xs leading-relaxed ${isRed ? 'text-slate-400' : 'text-slate-600'}`}>
              No more arriving at a hospital only to find out there are no ICU beds or doctors available.
            </p>
          </div>

          <div className={`p-5 rounded-2xl border space-y-2.5 transition ${
            isRed 
              ? 'bg-[#181922] border-emerald-950/80 hover:border-emerald-600/40' 
              : 'border-slate-200 bg-emerald-50/40'
          }`}>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5 text-emerald-500" />
            </div>
            <h4 className="font-extrabold text-sm">Protects the "Golden Hour"</h4>
            <p className={`text-xs leading-relaxed ${isRed ? 'text-slate-400' : 'text-slate-600'}`}>
              Direct turn-by-turn routing saves 15-30 crucial minutes during life-threatening trauma and cardiac events.
            </p>
          </div>

          <div className={`p-5 rounded-2xl border space-y-2.5 transition ${
            isRed 
              ? 'bg-[#181922] border-amber-950/80 hover:border-amber-600/40' 
              : 'border-slate-200 bg-amber-50/40'
          }`}>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5 text-amber-500" />
            </div>
            <h4 className="font-extrabold text-sm">Verified On-Duty Surgeons</h4>
            <p className={`text-xs leading-relaxed ${isRed ? 'text-slate-400' : 'text-slate-600'}`}>
              Hospitals confirm surgeon readiness so that surgical teams are scrubbed in before the ambulance arrives.
            </p>
          </div>

          <div className={`p-5 rounded-2xl border space-y-2.5 transition ${
            isRed 
              ? 'bg-[#181922] border-blue-950/80 hover:border-blue-600/40' 
              : 'border-slate-200 bg-sky-50/40'
          }`}>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
            </div>
            <h4 className="font-extrabold text-sm">Transparent Citizen Tracker</h4>
            <p className={`text-xs leading-relaxed ${isRed ? 'text-slate-400' : 'text-slate-600'}`}>
              Citizens receive live ambulance arrival counts and clear reassurance without overwhelming technical confusion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
