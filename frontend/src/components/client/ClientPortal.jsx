import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, Camera, Check, CheckCircle2, Clock, LocateFixed, MapPin, MessageSquare, PhoneCall,
  RotateCcw, Siren, Stethoscope, Trash2, Truck, UserRound,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { api } from '../../api/client';
import { useLive } from '../../hooks/useLive';
import { EMERGENCY_CATEGORIES, findCategory } from '../../data/emergencyCategories';
import { directionsUrl, tel } from '../../data/helplines';
import { CategoryImage, FirstAidSteps } from '../common/FirstAidSteps';
import { MapView } from '../common/MapView';
import { ErrorNote, HelplineStrip, Pill } from '../common/ui';

// Tap-only answers: nothing here needs typing during an emergency.
const AREAS = [
  ['Colaba', 18.9067, 72.8147], ['Fort / CSMT', 18.9398, 72.8355], ['Byculla', 18.9768, 72.8332], ['Dadar', 19.0178, 72.8478],
  ['Bandra', 19.0596, 72.8295], ['Andheri', 19.1136, 72.8697], ['Borivali', 19.2307, 72.8567], ['Kurla', 19.0726, 72.8845],
  ['Ghatkopar', 19.0790, 72.9080], ['Mulund', 19.1726, 72.9425], ['Thane', 19.2183, 72.9781], ['Kalyan', 19.2403, 73.1305],
  ['Vashi', 19.0771, 72.9986], ['Panvel', 18.9894, 73.1175], ['Mira Road', 19.2813, 72.8686], ['Vasai-Virar', 19.4559, 72.8114],
  ['Palghar', 19.6967, 72.7653], ['Dahanu', 19.9712, 72.7312],
];

const BODY_AREAS = ['Head', 'Face', 'Neck', 'Chest', 'Stomach', 'Back', 'Arm', 'Hand', 'Leg', 'Foot', 'Skin'];
const SYMPTOMS = [
  'Chest pain', 'Stomach pain', 'Hard to breathe', 'Dizzy or faint', 'Severe headache', 'Vomiting blood',
  'Cannot move an arm or leg', 'Numbness', 'High fever', 'Confusion', 'Heavy sweating', 'Palpitations',
];
const PAIN = [['1', 'Mild'], ['2', 'Noticeable'], ['3', 'Strong'], ['4', 'Severe'], ['5', 'Worst ever']];
/** Shrinks a photo in the browser so it uploads quickly on a weak connection. */
const shrinkPhoto = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 720 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => reject(new Error('Could not read that photo'));
    img.src = URL.createObjectURL(file);
  });

const toggle = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

const Step = ({ number, title, hint, done, children }) => (
  <section className="cc-card p-5 sm:p-6">
    <h2 className="text-xl sm:text-2xl font-black flex items-center gap-3">
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${done ? 'bg-emerald-600 text-white' : 'bg-stone-900 text-white'}`}>
        {done ? <Check className="w-4 h-4" /> : number}
      </span>
      {title}
    </h2>
    {hint && <p className="text-sm text-stone-500 mt-1 ml-11">{hint}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

/** Shown when the report could not reach the server: the phone still works. */
const PhoneFallback = ({ place, category, onRetry }) => {
  const text = `EMERGENCY: ${findCategory(category).label}. Location: ${place?.name || ''} https://maps.google.com/?q=${place?.lat},${place?.lng}`;
  return (
    <div className="cc-card border-red-400 p-6 space-y-4" role="alert">
      <h2 className="text-2xl font-black text-red-700">We could not send your report</h2>
      <p className="text-stone-600">Do not wait. Call now, the operator will send an ambulance:</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <a href={tel('108')} className="cc-btn-sos !py-4 text-lg"><PhoneCall className="w-5 h-5" /> Call 108 (Ambulance)</a>
        <a href={tel('112')} className="cc-btn-dark !py-4 text-lg"><PhoneCall className="w-5 h-5" /> Call 112</a>
      </div>
      <a href={`sms:112?body=${encodeURIComponent(text)}`} className="cc-btn-outline w-full"><MessageSquare className="w-4 h-4" /> Send location by SMS to 112</a>
      <button onClick={onRetry} className="text-sm font-bold text-stone-600 hover:underline">Try sending again</button>
    </div>
  );
};

const ReportForm = () => {
  const { setTrackingCode, showToast } = useCrisisCare();

  const [category, setCategory] = useState(null);
  const [place, setPlace] = useState(null); // { name, lat, lng, accuracy }
  const [locating, setLocating] = useState(false);
  const [landmark, setLandmark] = useState('');
  const [problemKind, setProblemKind] = useState(null);
  const [bodyArea, setBodyArea] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [painLevel, setPainLevel] = useState(null);
  const [patientCount, setPatientCount] = useState(1);
  const [callerPhone, setCallerPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef(null);

  const useGps = () => {
    if (!navigator.geolocation) return showToast('Location unavailable', 'Choose the nearest area instead.', 'warning');
    setLocating(true);
    return navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPlace({ name: 'Your current location', lat: coords.latitude, lng: coords.longitude, accuracy: Math.round(coords.accuracy) });
        setLocating(false);
      },
      () => {
        setLocating(false);
        showToast('Location not shared', 'Allow location access, or choose the nearest area below.', 'warning');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await shrinkPhoto(file));
    } catch (error) {
      showToast('Photo not added', error.message, 'warning');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!place || !category) {
      showToast('Two things needed', `${!place ? 'Tell us where the patient is' : 'Choose what happened'} so we can send help.`, 'warning');
      return;
    }

    setSending(true);
    setFailed(false);
    try {
      const emergency = await api('/emergencies', {
        method: 'POST',
        body: {
          type: category,
          lat: place.lat,
          lng: place.lng,
          patientCount,
          locationText: [place.name, landmark.trim()].filter(Boolean).join(' · ').slice(0, 300),
          callerPhone: callerPhone.trim() || null,
          problemKind,
          bodyArea: problemKind === 'outside' ? bodyArea : null,
          photo: problemKind === 'outside' ? photo : null,
          symptoms: problemKind === 'inside' ? symptoms : [],
          painLevel: problemKind === 'inside' && painLevel ? Number(painLevel) : null,
        },
      });
      setTrackingCode(emergency.code);
      window.location.hash = `#/report/${emergency.code}`;
      window.scrollTo({ top: 0 });
    } catch (error) {
      if (error.status === 0 || error.status >= 500 || error.status === 429) setFailed(true);
      else showToast('Please check the report', error.message, 'warning');
    } finally {
      setSending(false);
    }
  };

  if (failed) return <div className="max-w-3xl mx-auto"><PhoneFallback place={place} category={category} onRetry={() => setFailed(false)} /></div>;

  return (
    <form onSubmit={submit} className="max-w-3xl mx-auto space-y-5 pb-28">
      <header>
        <h1 className="text-4xl sm:text-5xl font-black">Get help now</h1>
        <p className="text-stone-500 mt-2">Two taps send an ambulance. Everything else is optional and helps the hospital get ready.</p>
        <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-900 flex flex-wrap items-center gap-2">
          <PhoneCall className="w-4 h-4" /> Prefer to talk? <a href={tel('108')} className="font-black underline">Call 108</a> or <a href={tel('112')} className="font-black underline">112</a>. You can do both.
        </div>
      </header>

      <Step number="1" title="Where is the patient?" done={Boolean(place)}>
        <button type="button" onClick={useGps} disabled={locating} className={place?.accuracy ? 'cc-btn-dark w-full' : 'cc-btn-primary w-full'}>
          <LocateFixed className={`w-4 h-4 ${locating ? 'animate-spin' : ''}`} />
          {locating ? 'Finding you...' : place?.accuracy ? `Using your location (±${place.accuracy} m)` : 'Use my current location'}
        </button>
        <p className="text-xs text-stone-400 text-center my-3">or choose the nearest area</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {AREAS.map(([name, lat, lng]) => <Pill key={name} on={place?.name === name} onClick={() => setPlace({ name, lat, lng })}>{name}</Pill>)}
        </div>
        <label className="cc-label mt-4" htmlFor="landmark">Landmark or building (optional)</label>
        <input id="landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={150} className="cc-input" placeholder="e.g. near Sion station east exit, Gate 2" />
      </Step>

      <Step number="2" title="What happened?" done={Boolean(category)} hint="Tap the picture that fits best.">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {EMERGENCY_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={`cc-card p-2 text-center transition hover:-translate-y-0.5 hover:border-amber-400 ${category === c.id ? 'border-red-500 ring-2 ring-red-200 bg-red-50/40' : ''}`}
            >
              <CategoryImage category={c} className="w-full h-20 sm:h-24 rounded-lg" />
              <span className="block mt-2 text-xs font-bold leading-tight">{c.label}</span>
            </button>
          ))}
        </div>
      </Step>

      <Step number="3" title="Where does it hurt?" hint="Optional. The crew and hospital see this before they arrive.">
        <div className="grid grid-cols-2 gap-3">
          {[['outside', 'On the body', 'A visible injury, wound or swelling', Camera], ['inside', 'Inside the body', 'Pain or a feeling you cannot see', Stethoscope]].map(([id, title, text, Icon]) => (
            <button key={id} type="button" onClick={() => setProblemKind(problemKind === id ? null : id)} aria-pressed={problemKind === id} className={`rounded-2xl border p-4 text-left transition ${problemKind === id ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-stone-200 bg-white hover:border-amber-400'}`}>
              <Icon className="w-6 h-6 text-amber-600" />
              <span className="block font-extrabold mt-2">{title}</span>
              <span className="block text-xs text-stone-500 mt-0.5">{text}</span>
            </button>
          ))}
        </div>

        {problemKind === 'outside' && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="cc-label">Which part?</p>
              <div className="flex flex-wrap gap-2">{BODY_AREAS.map((b) => <Pill key={b} on={bodyArea === b} onClick={() => setBodyArea(bodyArea === b ? null : b)}>{b}</Pill>)}</div>
            </div>
            <div>
              <p className="cc-label">Photo of the injury</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" aria-label="Take a photo of the injury" />
              {photo ? (
                <div className="flex items-center gap-4">
                  <img src={photo} alt="Injury photo to send" className="w-32 h-32 rounded-xl object-cover border border-stone-200" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5"><Check className="w-4 h-4" /> Goes to the crew, the hospital and dispatch only</p>
                    <button type="button" onClick={() => fileRef.current?.click()} className="cc-btn-outline !py-2">Retake</button>{' '}
                    <button type="button" onClick={() => setPhoto(null)} className="cc-btn-outline !py-2 !text-red-700"><Trash2 className="w-4 h-4" /> Remove</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="cc-btn-outline w-full !py-4 border-dashed"><Camera className="w-5 h-5" /> Take a photo</button>
              )}
              <p className="text-xs text-stone-400 mt-2">Only if it is quick and safe. Never delay help for a photo.</p>
            </div>
          </div>
        )}

        {problemKind === 'inside' && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="cc-label">What is the patient feeling? (tap all that apply)</p>
              <div className="flex flex-wrap gap-2">{SYMPTOMS.map((s) => <Pill key={s} on={symptoms.includes(s)} onClick={() => setSymptoms((p) => toggle(p, s))}>{s}</Pill>)}</div>
            </div>
            <div>
              <p className="cc-label">How strong is the pain?</p>
              <div className="grid grid-cols-5 gap-2">
                {PAIN.map(([n, label]) => (
                  <button key={n} type="button" aria-pressed={painLevel === n} onClick={() => setPainLevel(painLevel === n ? null : n)} className={`rounded-xl border py-2 text-center transition ${painLevel === n ? 'bg-amber-500 border-amber-500 text-stone-950' : 'bg-white border-stone-300 hover:border-amber-500'}`}>
                    <span className="block text-xl font-black">{n}</span>
                    <span className="block text-[10px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Step>

      <Step number="4" title="Your phone number" hint="So the ambulance crew can call you if they cannot find the place. You don't need to know the patient's name.">
        <label className="cc-label" htmlFor="cphone">Mobile number</label>
        <input id="cphone" type="tel" inputMode="tel" value={callerPhone} onChange={(e) => setCallerPhone(e.target.value)} maxLength={20} className="cc-input" placeholder="98xxxxxxxx" autoComplete="tel" />
        <p className="text-xs text-stone-400 mt-2">Only the ambulance crew and dispatch can see it. The crew records the patient's age, allergies and conditions when they reach the patient.</p>
      </Step>

      <Step number="5" title="How many people need help?">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" aria-pressed={patientCount === n} onClick={() => setPatientCount(n)} className={`flex-1 rounded-xl border py-3 text-xl font-black transition ${patientCount === n ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-300 hover:border-amber-500'}`}>
              {n === 4 ? '4+' : n}
            </button>
          ))}
        </div>
      </Step>

      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href={tel('108')} className="cc-btn-outline !px-3 !py-4 !text-red-700" aria-label="Call 108"><PhoneCall className="w-5 h-5" /> 108</a>
          <button type="submit" disabled={sending} className={`cc-btn-sos flex-1 !py-4 text-base ${!place || !category ? 'opacity-70' : ''}`}>
            <Siren className="w-5 h-5" /> {sending ? 'Sending...' : !place ? 'Step 1: where?' : !category ? 'Step 2: what happened?' : 'Send ambulance'}
          </button>
        </div>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Live tracking (real status from the server, pushed over Socket.IO)
// ---------------------------------------------------------------------------

const BANNERS = {
  SEARCHING: ['bg-amber-600', 'Finding the nearest free ambulance', 'All nearby units are busy. You are in the queue and the first free unit comes to you. Call 108 as well.'],
  AMBULANCE_ASSIGNED: ['bg-red-700', 'The ambulance is on its way', 'Stay with the patient and follow the steps below.'],
  AT_SCENE: ['bg-sky-700', 'The crew is with the patient', 'They are checking the patient and contacting the right hospital.'],
  HOSPITAL_PENDING: ['bg-sky-700', 'Asking the hospital to get ready', 'The crew has sent the patient\'s condition to the hospital.'],
  HOSPITAL_DECLINED: ['bg-amber-600', 'Finding another hospital', 'The first hospital could not take the patient. The crew is asking the next best one.'],
  HOSPITAL_ACCEPTED: ['bg-emerald-700', 'The hospital is ready', 'A bed is reserved and the emergency team has been told.'],
  TRANSPORTING: ['bg-emerald-700', 'On the way to the hospital', 'The hospital team is waiting for the patient.'],
  ARRIVED: ['bg-emerald-800', 'Arrived at the hospital', 'The patient is being handed over to the emergency team.'],
  CLOSED: ['bg-stone-700', 'Handed over to the hospital', 'The patient is in the hospital\'s care. Take care.'],
  CANCELLED: ['bg-stone-700', 'Request cancelled', 'If help is still needed, start a new request or call 108.'],
};

const Tracker = ({ code }) => {
  const { setTrackingCode, forgetTracking, showToast } = useCrisisCare();
  const { data: e, error, refresh, updatedAt } = useLive(() => api(`/emergencies/${code}`), { events: ['emergency:changed'], track: code, pollMs: 15000 });
  const [cancelling, setCancelling] = useState(false);
  const finished = Boolean(e) && !e.isOpen;
  useEffect(() => { if (finished) forgetTracking(); }, [finished, forgetTracking]);

  if (error?.status === 404) {
    return (
      <div className="max-w-xl mx-auto cc-card p-6 space-y-3">
        <h1 className="text-2xl font-black">This request was not found</h1>
        <button onClick={() => { setTrackingCode(null); window.location.hash = '#/report'; }} className="cc-btn-primary">Start a new request</button>
      </div>
    );
  }
  if (!e) return <div className="max-w-4xl mx-auto space-y-4"><ErrorNote error={error} /><div className="cc-card p-10 text-center text-stone-400">Loading your request…</div><HelplineStrip compact numbers={['108', '112']} /></div>;

  const [tone, title, text] = BANNERS[e.status] || BANNERS.AMBULANCE_ASSIGNED;
  const h = e.hospital;
  const accepted = h?.response === 'accepted';
  const eta = ['TRANSPORTING', 'HOSPITAL_ACCEPTED'].includes(e.status) && accepted ? h.etaMinutes : e.ambulance?.etaMinutes;

  const cancel = async () => {
    if (!window.confirm('Cancel the ambulance? Only do this if help is no longer needed.')) return;
    setCancelling(true);
    try {
      await api(`/emergencies/${code}/cancel`, { method: 'POST' });
      refresh();
    } catch (err) {
      showToast('Could not cancel', err.message, 'warning');
    } finally {
      setCancelling(false);
    }
  };

  const steps = [
    { icon: CheckCircle2, title: 'Help requested', done: true, text: `${findCategory(e.type).label} · code ${e.code}` },
    { icon: Truck, title: e.ambulance ? `Ambulance ${e.ambulance.callsign}` : 'Waiting for a free ambulance', done: Boolean(e.ambulance), warn: !e.ambulance, text: e.ambulance ? `${e.ambulance.paramedicName || 'Crew'} · ${e.ambulance.distanceKm ?? '?'} km away` : 'You are in the queue. Call 108 as well.' },
    { icon: Stethoscope, title: 'Patient checked', done: Boolean(e.assessment), text: e.assessment ? 'Condition sent to the hospital' : 'The crew examines the patient on arrival' },
    { icon: Building2, title: accepted ? `${h.name} is ready` : h?.response === 'declined' ? 'Choosing another hospital' : h ? `Asking ${h.name}` : 'Hospital confirmation', done: accepted, warn: e.declinedHospitals.length > 0 && !accepted, text: accepted ? 'Bed reserved, team alerted' : e.declinedHospitals.length ? `${e.declinedHospitals.length} hospital(s) could not take the patient` : 'The crew asks the hospital that fits the patient' },
  ];

  const markers = [
    { id: 'p', kind: 'patient', lat: e.lat, lng: e.lng, popup: 'Patient' },
    e.ambulance?.lat != null && { id: 'a', kind: 'ambulance', lat: e.ambulance.lat, lng: e.ambulance.lng, label: e.ambulance.callsign },
    h && { id: 'h', kind: 'hospital', lat: h.lat, lng: h.lng, label: h.name, color: accepted ? '#10B981' : '#F59E0B' },
  ].filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className={`${tone} text-white rounded-3xl p-6 sm:p-8 shadow-lg`} aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-black">{title}</h1>
            <p className="mt-2 text-white/90">{text}</p>
          </div>
          {e.isOpen && eta != null && (
            <div className="text-center bg-black/20 rounded-2xl px-6 py-3 shrink-0">
              <div className="text-5xl font-black tabular-nums leading-none">~{eta}</div>
              <div className="text-xs font-bold mt-1">min (straight-line estimate)</div>
            </div>
          )}
        </div>
        <div className="mt-5 pt-4 border-t border-white/25 flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-2 mr-auto"><MapPin className="w-4 h-4" /> {e.locationText || 'Pinned location'}</span>
          <a href={tel('108')} className="inline-flex items-center gap-2 rounded-xl bg-white text-stone-900 px-4 py-2 font-bold"><PhoneCall className="w-4 h-4" /> 108</a>
          {h?.phone && <a href={tel(h.phone)} className="inline-flex items-center gap-2 rounded-xl bg-white text-stone-900 px-4 py-2 font-bold"><Building2 className="w-4 h-4" /> Call hospital</a>}
        </div>
      </div>

      <div className="cc-card p-6">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-600" /> Progress</h2>
        <ol className="grid sm:grid-cols-2 gap-3">
          {steps.map(({ icon: Icon, title: t, done, warn, text: x }) => (
            <li key={t} className={`rounded-2xl border p-4 flex gap-3 ${done ? 'bg-emerald-50 border-emerald-200' : warn ? 'bg-amber-50 border-amber-300' : 'bg-stone-50 border-stone-200'}`}>
              <Icon className={`w-6 h-6 shrink-0 ${done ? 'text-emerald-700' : warn ? 'text-amber-700' : 'text-stone-400'}`} />
              <span><strong className="block text-sm">{t}</strong><span className="text-xs text-stone-500">{x}</span></span>
            </li>
          ))}
        </ol>
        {e.declinedHospitals.length > 0 && (
          <ul className="mt-3 text-xs text-amber-900 space-y-1">
            {e.declinedHospitals.map((d) => <li key={d.id}><AlertTriangle className="inline w-3 h-3" /> {d.name}: {d.reason}</li>)}
          </ul>
        )}
        <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-stone-500">Updates live{updatedAt ? ` · checked ${updatedAt.toLocaleTimeString()}` : ''}</span>
          <span className="flex gap-3">
            {e.isOpen && !['TRANSPORTING', 'ARRIVED'].includes(e.status) && <button onClick={cancel} disabled={cancelling} className="text-red-700 font-bold hover:underline">Cancel request</button>}
            <button onClick={() => { setTrackingCode(null); window.location.hash = '#/report'; }} className="font-bold text-stone-700 hover:underline inline-flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> New request</button>
          </span>
        </div>
      </div>

      <MapView markers={markers} height="300px" />
      {h && <a href={directionsUrl(h.lat, h.lng)} target="_blank" rel="noreferrer" className="cc-btn-outline w-full"><MapPin className="w-4 h-4" /> Directions to {h.name} (for family)</a>}

      {e.isOpen && <FirstAidSteps categoryId={e.type} />}
      <div className="cc-card p-5 text-sm text-stone-700 space-y-1">
        <p className="font-black text-base flex items-center gap-2"><UserRound className="w-5 h-5 text-amber-600" /> Please stay on this page</p>
        <p>It updates by itself until the patient reaches the hospital.</p>
        <p>Your report ID, for future reference: <strong className="font-mono text-base select-all">{e.code}</strong></p>
      </div>
    </div>
  );
};

export const ClientPortal = () => {
  const { trackingCode, setTrackingCode, subRoute } = useCrisisCare();
  const fromUrl = /^CC-[A-Z0-9]{8}$/.test(subRoute || '') ? subRoute : null;
  // A code in the address bar becomes this phone's saved request (so reopening the site finds it).
  // Runs only when the address changes, so "New request" is not undone by a stale address.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (fromUrl) setTrackingCode(fromUrl); }, [fromUrl]);
  const code = fromUrl || trackingCode;
  return code ? <Tracker code={code} /> : <ReportForm />;
};
