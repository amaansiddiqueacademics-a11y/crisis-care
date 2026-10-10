import React, { useState } from 'react';
import {
  AlertTriangle, ArrowRight, Building2, Check, Clock, HeartHandshake, HeartPulse, LocateFixed, Navigation, PhoneCall,
  ShieldCheck, X,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { api } from '../../api/client';
import { useLive } from '../../hooks/useLive';
import { MapView } from '../common/MapView';
import { CategoryImage, FirstAidSteps } from '../common/FirstAidSteps';
import { EMERGENCY_CATEGORIES } from '../../data/emergencyCategories';
import { directionsUrl, tel } from '../../data/helplines';
import { ErStatusBadge, ErrorNote, HelplineStrip, OwnershipBadge, timeAgo } from '../common/ui';

const START_POINTS = [
  ['South Mumbai', 18.9398, 72.8355], ['Western Suburbs', 19.1136, 72.8697], ['Central Suburbs', 19.0790, 72.9080],
  ['Thane & Kalyan', 19.2183, 72.9781], ['Navi Mumbai & Panvel', 19.0771, 72.9986], ['Palghar & Vasai-Virar', 19.6967, 72.7653],
];

const Stat = ({ value, label }) => (
  <div className="cc-card px-5 py-4">
    <div className="text-3xl sm:text-4xl font-black tabular-nums text-amber-600">{value ?? '–'}</div>
    <div className="text-sm mt-0.5 text-stone-500">{label}</div>
  </div>
);

const SectionTitle = ({ id, title, text }) => (
  <div className="mb-5">
    <h2 id={id} className="text-2xl sm:text-3xl font-black">{title}</h2>
    {text && <p className="text-sm mt-1 text-stone-500 max-w-2xl">{text}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// "Which hospital should I go to?" — same matching rules the ambulance crews use.
// ---------------------------------------------------------------------------

const Recommendation = () => {
  const { showToast } = useCrisisCare();
  const [type, setType] = useState('Cardiac / Chest Pain');
  const [origin, setOrigin] = useState({ name: 'South Mumbai', lat: 18.9398, lng: 72.8355 });
  const [locating, setLocating] = useState(false);

  const { data, error } = useLive(
    () => api(`/hospitals/recommend?type=${encodeURIComponent(type)}&lat=${origin.lat}&lng=${origin.lng}`),
    { events: ['inventory:changed'], pollMs: 60000, key: `${type}|${origin.lat}|${origin.lng}` },
  );

  const locate = () => {
    if (!navigator.geolocation) return showToast('Location unavailable', 'Choose your area instead.', 'warning');
    setLocating(true);
    return navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin({ name: 'Your location', lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        showToast('Location blocked', 'Choose your area instead.', 'warning');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const list = data?.hospitals || [];
  const best = list.find((h) => h.fit.fits);

  return (
    <section aria-labelledby="find-title" className="space-y-5">
      <SectionTitle id="find-title" title="Which hospital can treat this, near me?" text="Not every hospital can treat every emergency. A heart attack needs a cath lab, a stroke needs a CT scan and a neurologist, a snakebite needs anti-venom. Pick what happened; we show hospitals that have it right now." />

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={locate} disabled={locating} className={`cc-btn !py-2 border ${origin.name === 'Your location' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-300'}`}>
          <LocateFixed className={`w-4 h-4 ${locating ? 'animate-spin' : ''}`} /> {locating ? 'Locating…' : 'My location'}
        </button>
        {START_POINTS.map(([name, lat, lng]) => (
          <button key={name} onClick={() => setOrigin({ name, lat, lng })} aria-pressed={origin.name === name} className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${origin.name === name ? 'bg-amber-500 border-amber-500' : 'bg-white border-stone-300 hover:border-amber-500'}`}>{name}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="What happened">
        {EMERGENCY_CATEGORIES.filter((c) => c.id !== 'Other Emergency').map((c) => (
          <button key={c.id} onClick={() => setType(c.id)} aria-pressed={type === c.id} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${type === c.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-stone-300 hover:border-red-400'}`}>{c.label}</button>
        ))}
      </div>

      {data && <p className="text-sm text-stone-600"><strong>Needs:</strong> {data.needs.join(', ')}</p>}
      <ErrorNote error={error} />

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">
          {best ? (
            <div className="cc-card p-5 sm:p-6 border-emerald-400">
              <div className="flex flex-wrap gap-1.5"><span className="cc-chip bg-emerald-600 text-white"><Check className="w-3.5 h-3.5" /> Best match</span><ErStatusBadge status={best.erStatus} /><OwnershipBadge ownership={best.ownership} /></div>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-xl sm:text-2xl font-black leading-tight">{best.name}</h3>
                  <p className="text-sm mt-1 text-stone-500">{best.address}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-4xl font-black tabular-nums leading-none text-amber-600">~{best.etaMinutes}</div>
                  <div className="text-xs mt-1 text-stone-500">min · {best.distanceKm} km</div>
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2">{best.fit.matched.map((m) => <li key={m} className="cc-chip bg-emerald-50 text-emerald-800"><Check className="w-3.5 h-3.5" /> {m}</li>)}</ul>
              <p className="text-xs text-stone-500 mt-3">{best.inventoryConfirmedAt ? `Stock confirmed by the hospital ${timeAgo(best.inventoryConfirmedAt)}` : 'Stock not yet confirmed by the hospital: call before going.'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={directionsUrl(best.lat, best.lng)} target="_blank" rel="noreferrer" className="cc-btn-primary"><Navigation className="w-4 h-4" /> Directions</a>
                {best.phone && <a href={tel(best.phone)} className="cc-btn-outline"><PhoneCall className="w-4 h-4" /> Call hospital</a>}
                <a href={tel('108')} className="cc-btn-outline !text-red-700"><PhoneCall className="w-4 h-4" /> Need an ambulance? 108</a>
              </div>
            </div>
          ) : data ? (
            <div className="cc-card p-6 border-red-300">
              <h3 className="text-lg font-black">No nearby hospital has everything for this right now</h3>
              <p className="text-sm mt-1 text-stone-500">Call 108: the ambulance stabilises the patient and dispatch finds a bed further away.</p>
            </div>
          ) : null}
          <MapView
            height="320px"
            markers={[
              { id: 'o', kind: 'patient', lat: origin.lat, lng: origin.lng, popup: origin.name },
              ...list.slice(0, 5).map((h) => ({ id: `h${h.id}`, kind: 'hospital', lat: h.lat, lng: h.lng, label: h.name.split(',')[0].slice(0, 28), color: h.fit.fits ? '#10B981' : '#A8A29E' })),
            ]}
            fitTo={[origin, ...(best ? [best] : list.slice(0, 1))]}
          />
        </div>

        <ol className="lg:col-span-2 space-y-3" aria-label="Hospitals ranked for this emergency">
          {list.map((h, i) => (
            <li key={h.id} className={`cc-card p-4 flex gap-3 ${h.fit.fits ? '' : 'opacity-75'}`}>
              <span className={`text-2xl font-black w-6 shrink-0 ${h.fit.fits ? 'text-emerald-600' : 'text-stone-400'}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm leading-snug">{h.name}</h3>
                  <span className="text-xs font-bold shrink-0 tabular-nums text-stone-500">~{h.etaMinutes} min</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1"><ErStatusBadge status={h.erStatus} /><OwnershipBadge ownership={h.ownership} /></div>
                {h.fit.missing.length === 0 ? (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Check className="w-3.5 h-3.5" /> Has what is needed · ICU free {h.icuFree}</span>
                ) : (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-red-700"><X className="w-3.5 h-3.5" /> Missing: {h.fit.missing.join(', ')}</span>
                )}
                {h.phone && <a href={tel(h.phone)} className="block text-xs font-bold text-stone-600 mt-1 hover:text-red-700"><PhoneCall className="inline w-3 h-3" /> {h.phone}</a>}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-xs text-stone-400 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Hospital stock is shown as reported by each hospital's own staff; until they confirm it, figures are sample data. Travel times are straight-line estimates.</p>
    </section>
  );
};

const FirstAidGuide = () => {
  const [openId, setOpenId] = useState('Severe Bleeding');
  return (
    <section aria-labelledby="aid-title">
      <SectionTitle id="aid-title" title="What to do until help arrives" text="Pick the situation to see what to do, and what not to do." />
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {EMERGENCY_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setOpenId(c.id)} aria-pressed={openId === c.id} className={`cc-card p-2.5 text-center transition hover:-translate-y-0.5 hover:border-amber-400 ${openId === c.id ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}>
            <CategoryImage category={c} className="w-full h-20 sm:h-24 rounded-lg" />
            <span className="block mt-2 text-xs font-bold leading-tight">{c.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-5"><FirstAidSteps categoryId={openId} /></div>
    </section>
  );
};

const PHOTOS = [
  { src: '/images/real/lilavati-bandra.webp', title: 'Lilavati Hospital, Bandra', credit: 'Nichalp, Wikimedia Commons, CC BY-SA 3.0' },
  { src: '/images/real/hinduja-wide.webp', title: 'P.D. Hinduja Hospital, Mahim', credit: 'Dpb696, Wikimedia Commons, CC BY-SA 4.0' },
  { src: '/images/real/hinduja-mahim.webp', title: 'Hinduja Hospital tower, Mahim', credit: 'Jkl0101, Wikimedia Commons, CC BY-SA 4.0' },
];

const HospitalGallery = () => (
  <section aria-labelledby="gallery-title">
    <SectionTitle id="gallery-title" title="Real hospitals across Mumbai and Palghar" text="105 hospitals in South Mumbai, the Western and Central suburbs, Thane, Navi Mumbai and Palghar, plus other Maharashtra cities. Photographs are for illustration and do not imply a partnership." />
    <div className="grid md:grid-cols-3 gap-4">
      {PHOTOS.map((p) => (
        <figure key={p.src} className="cc-card overflow-hidden">
          <img src={p.src} alt={p.title} loading="lazy" className="w-full h-56 object-cover" />
          <figcaption className="p-4"><div className="font-bold text-sm">{p.title}</div><div className="text-[11px] text-stone-400 mt-0.5">Photo: {p.credit}</div></figcaption>
        </figure>
      ))}
    </div>
  </section>
);

const About = () => (
  <section id="about" aria-labelledby="about-title" className="cc-card overflow-hidden grid lg:grid-cols-2">
    <img src="/images/real/ambulance-road.jpg" alt="An ambulance driving on an Indian road" loading="lazy" className="w-full h-72 lg:h-full object-cover" />
    <div className="p-6 sm:p-10 space-y-5">
      <h2 id="about-title" className="text-2xl sm:text-3xl font-black">About Crisis Care</h2>
      <p className="text-stone-600 leading-relaxed">
        In Mumbai, patients are often driven from one hospital to the next because the first one had no ICU bed, no cath lab or no specialist on duty. Every lost hour costs lives. Crisis Care sends the nearest ambulance, tells the hospital what the patient needs before they arrive, and only drives the patient to a hospital that has said yes.
      </p>
      <ul className="grid sm:grid-cols-2 gap-4">
        {[
          [Clock, 'No hospital hopping', 'The hospital accepts and reserves a bed before the ambulance leaves.'],
          [HeartPulse, 'Right care, not just nearest', 'A heart attack goes to a cath lab, a stroke to a CT and neurologist.'],
          [ShieldCheck, 'Honest data', 'Every figure says who reported it and when. Unconfirmed data is labelled.'],
          [Building2, 'Phone always works', '108 and 112 are one tap away everywhere, even if this site is down.'],
        ].map(([Icon, title, text]) => (
          <li key={title} className="flex gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
            <span><strong className="block text-sm">{title}</strong><span className="text-sm text-stone-500">{text}</span></span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-stone-400">Ambulance photo: Satyam Shukla 28, Wikimedia Commons, CC0.</p>
    </div>
  </section>
);

export const MainDashboard = () => {
  const { setActiveSection, trackingCode } = useCrisisCare();
  const { data: stats } = useLive(() => api('/stats'), { events: ['inventory:changed'], pollMs: 30000 });

  return (
    <div className="space-y-14 pb-6">
      <section className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 sm:p-10">
        <div className="relative grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.02]">Help is on its way.<br /><span className="text-amber-600">Stay calm.</span></h1>
            <p className="text-lg text-stone-600 max-w-md">Tell us what happened. We send the nearest ambulance and find a hospital that is ready for this patient.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setActiveSection('client')} className="cc-btn-sos !px-7 !py-4 text-base">
                <HeartHandshake className="w-5 h-5" /> {trackingCode ? 'Track my ambulance' : 'Get help now'} <ArrowRight className="w-5 h-5" />
              </button>
              <a href={tel('108')} className="cc-btn-outline !px-6 !py-4 text-base !border-red-400 !text-red-700"><PhoneCall className="w-5 h-5" /> Call 108</a>
            </div>
          </div>
          <div className="lg:col-span-6">
            <img src="/images/ambulance-hero.webp" alt="Ambulance ready for an emergency call" className="w-full max-h-[22rem] object-contain drop-shadow-xl" />
          </div>
        </div>
      </section>

      <section aria-labelledby="helplines-title">
        <h2 id="helplines-title" className="text-lg font-black mb-3">No internet, or prefer to talk? These numbers always work</h2>
        <HelplineStrip />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Network right now">
        <Stat value={stats && `${stats.ambulancesAvailable}/${stats.ambulancesOnline}`} label="Ambulances free now" />
        <Stat value={stats?.hospitals} label="Hospitals connected" />
        <Stat value={stats?.activeEmergencies} label="Emergencies being handled" />
        <Stat value={stats?.reportToHospitalAcceptance.avgMinutes != null ? `${stats.reportToHospitalAcceptance.avgMinutes} min` : '–'} label="Avg. report → bed confirmed (30 days)" />
      </section>

      <Recommendation />
      <FirstAidGuide />
      <HospitalGallery />
      <About />
    </div>
  );
};
