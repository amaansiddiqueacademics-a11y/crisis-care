import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, Camera, Check, CheckCircle2, KeyRound, LocateFixed, LogOut, MapPin, Navigation, PhoneCall,
  Radio, ShieldCheck, Star, Truck, User, XCircle,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { useLive } from '../../hooks/useLive';
import { findCategory } from '../../data/emergencyCategories';
import { directionsUrl, tel } from '../../data/helplines';
import { CategoryImage } from '../common/FirstAidSteps';
import { MapView } from '../common/MapView';
import { Avatar, ErStatusBadge, ErrorNote, Field, OwnershipBadge, Pill, TriageBadge, timeAgo } from '../common/ui';

// Extra questions that matter for the hospital choice, per reported category.
const FINDINGS = {
  'Cardiac / Chest Pain': [
    { key: 'stElevation', label: 'ECG shows ST elevation?', type: 'bool' },
    { key: 'painMinutes', label: 'Chest pain for how many minutes?', type: 'number', max: 1440 },
  ],
  'Suspected Stroke': [
    { key: 'onsetHours', label: 'Hours since symptoms started', type: 'number', max: 72, step: 0.5 },
    { key: 'faceDroop', label: 'Face drooping?', type: 'bool' },
    { key: 'armWeakness', label: 'Arm weakness?', type: 'bool' },
    { key: 'speechSlurred', label: 'Speech slurred?', type: 'bool' },
  ],
  'Traffic Accident': [
    { key: 'spinalInjury', label: 'Possible spine / neck injury?', type: 'bool' },
    { key: 'gcs', label: 'GCS (3-15)', type: 'number', min: 3, max: 15 },
  ],
  'Fall from Height': [
    { key: 'spinalInjury', label: 'Possible spine / neck injury?', type: 'bool' },
    { key: 'gcs', label: 'GCS (3-15)', type: 'number', min: 3, max: 15 },
  ],
  'Severe Burns': [
    { key: 'burnPercent', label: '% of body burned', type: 'number', max: 100 },
    { key: 'airwayBurn', label: 'Burns to face / airway?', type: 'bool' },
  ],
  'Pregnancy Emergency': [
    { key: 'weeks', label: 'Weeks pregnant', type: 'number', max: 45 },
    { key: 'heavyBleeding', label: 'Heavy vaginal bleeding?', type: 'bool' },
    { key: 'contractionsMin', label: 'Minutes between contractions', type: 'number', max: 60 },
  ],
  'Snakebite & Animal Bite': [
    { key: 'hoursSinceBite', label: 'Hours since bite', type: 'number', max: 72, step: 0.5 },
    { key: 'neuroSigns', label: 'Droopy eyelids / trouble swallowing?', type: 'bool' },
    { key: 'swelling', label: 'Spreading swelling?', type: 'bool' },
  ],
  Poisoning: [
    { key: 'substance', label: 'What was taken', type: 'text' },
    { key: 'hoursSince', label: 'Hours since', type: 'number', max: 72, step: 0.5 },
  ],
  'Pediatric Emergency': [
    { key: 'ageYears', label: 'Age in years', type: 'number', max: 18 },
    { key: 'weightKg', label: 'Weight (kg)', type: 'number', max: 120 },
  ],
};

const AGES = { INFANT: 'Baby', CHILD: 'Child', TEEN: 'Teen', ADULT: 'Adult', SENIOR: 'Senior 60+' };

const Choice = ({ label, value, onChange, options }) => (
  <div>
    <p className="cc-label">{label}</p>
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map(([id, text]) => (
        <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id} className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${value === id ? 'border-red-600 bg-red-600 text-white' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'}`}>
          {text}
        </button>
      ))}
    </div>
  </div>
);

const Login = () => {
  const { login, showToast } = useCrisisCare();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await login('ambulance', username.trim().toLowerCase(), password);
      showToast('Signed in', `${s.user.fullName} on ${s.user.ambulance.callsign}`, 'success');
    } catch (err) {
      showToast('Sign-in failed', err.message, 'warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <form onSubmit={submit} className="cc-card p-8 space-y-5 shadow-lg">
        <div className="text-center">
          <span className="w-14 h-14 rounded-2xl bg-red-700 text-white flex items-center justify-center mx-auto mb-3"><Truck className="w-7 h-7" /></span>
          <h1 className="text-2xl font-black">Ambulance crew</h1>
          <p className="text-sm text-stone-500 mt-1">Sign in with your unit's call sign.</p>
        </div>
        <div>
          <label className="cc-label" htmlFor="crew-user">Unit call sign</label>
          <div className="relative"><User className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" /><input id="crew-user" value={username} onChange={(e) => setUsername(e.target.value)} className="cc-input pl-9" placeholder="e.g. mum-als-01" autoComplete="username" required /></div>
        </div>
        <div>
          <label className="cc-label" htmlFor="crew-pass">Password</label>
          <div className="relative"><KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" /><input id="crew-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="cc-input pl-9" autoComplete="current-password" required /></div>
        </div>
        <button type="submit" disabled={busy} className="cc-btn-dark w-full !py-3">{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-xs text-stone-400 text-center flex items-center justify-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Development units: mum-als-01 … vsi-als-13, password = SEED_CREW_PASSWORD in backend/.env</p>
      </form>
    </div>
  );
};

/** Shares the unit's GPS every 15 s while the switch is on, so dispatch and the patient see it move. */
const useGpsShare = (authed, enabled) => {
  const [last, setLast] = useState(null);
  const lastSent = useRef(0);
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (Date.now() - lastSent.current < 15000) return;
        lastSent.current = Date.now();
        authed('ambulance', '/ambulance/location', { method: 'PUT', body: { lat: coords.latitude, lng: coords.longitude } })
          .then(() => setLast(new Date()))
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [authed, enabled]);
  return last;
};

const Assessment = ({ emergency, onSaved }) => {
  const { authed, showToast } = useCrisisCare();
  const [consciousness, setConsciousness] = useState('conscious');
  const [breathing, setBreathing] = useState('normal');
  const [pulseStatus, setPulseStatus] = useState('normal');
  const [severeBleeding, setSevereBleeding] = useState(false);
  const [vitals, setVitals] = useState({ heartRate: '', spo2: '', systolicBp: '', diastolicBp: '' });
  const [findings, setFindings] = useState({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const questions = FINDINGS[emergency.type] || [];

  const num = (v) => (v === '' || v == null ? null : Number(v));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const categoryFindings = Object.fromEntries(
        Object.entries(findings).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, typeof v === 'string' && questions.find((q) => q.key === k)?.type === 'number' ? Number(v) : v]),
      );
      await authed('ambulance', '/ambulance/emergency/assessment', {
        method: 'POST',
        body: {
          consciousness, breathing, pulseStatus, severeBleeding,
          heartRate: num(vitals.heartRate), spo2: num(vitals.spo2), systolicBp: num(vitals.systolicBp), diastolicBp: num(vitals.diastolicBp),
          notes: notes.trim() || null,
          categoryFindings,
        },
      });
      showToast('Assessment saved', 'Hospitals below are re-ranked for this patient.', 'success');
      onSaved();
    } catch (err) {
      showToast('Not saved', err.message, 'warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="cc-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">On-scene assessment</h2>
          <p className="text-xs text-stone-500">Sent to the hospital you ask. Triage colour is computed from it.</p>
        </div>
        {emergency.assessment && <TriageBadge level={emergency.assessment.triage} />}
      </div>
      <Choice label="Conscious?" value={consciousness} onChange={setConsciousness} options={[['conscious', 'Alert'], ['semi-conscious', 'Drowsy'], ['unconscious', 'Unconscious']]} />
      <Choice label="Breathing" value={breathing} onChange={setBreathing} options={[['normal', 'Normal'], ['labored', 'Laboured'], ['not-breathing', 'Not breathing']]} />
      <Choice label="Pulse" value={pulseStatus} onChange={setPulseStatus} options={[['normal', 'Normal'], ['rapid', 'Rapid'], ['weak', 'Weak'], ['none', 'None']]} />
      <Choice label="Severe bleeding?" value={severeBleeding ? 'y' : 'n'} onChange={(v) => setSevereBleeding(v === 'y')} options={[['n', 'No'], ['y', 'Yes']]} />

      <div className="grid grid-cols-4 gap-2">
        {[['heartRate', 'Pulse', 300], ['spo2', 'SpO2 %', 100], ['systolicBp', 'BP sys', 300], ['diastolicBp', 'BP dia', 200]].map(([k, label, max]) => (
          <div key={k}>
            <label className="cc-label" htmlFor={k}>{label}</label>
            <input id={k} type="number" inputMode="numeric" min={0} max={max} value={vitals[k]} onChange={(e) => setVitals((v) => ({ ...v, [k]: e.target.value }))} className="cc-input !px-2" />
          </div>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-3">
          <p className="text-xs font-black uppercase text-amber-800">{findCategory(emergency.type).label}: decides the hospital</p>
          {questions.map((q) =>
            q.type === 'bool' ? (
              <Choice key={q.key} label={q.label} value={findings[q.key] === true ? 'y' : findings[q.key] === false ? 'n' : null} onChange={(v) => setFindings((f) => ({ ...f, [q.key]: v === 'y' }))} options={[['n', 'No'], ['y', 'Yes']]} />
            ) : (
              <div key={q.key}>
                <label className="cc-label" htmlFor={q.key}>{q.label}</label>
                <input id={q.key} type={q.type} min={q.min ?? 0} max={q.max} step={q.step || 1} maxLength={80} value={findings[q.key] ?? ''} onChange={(e) => setFindings((f) => ({ ...f, [q.key]: e.target.value }))} className="cc-input" />
              </div>
            ),
          )}
        </div>
      )}

      <div>
        <label className="cc-label" htmlFor="notes">Notes for the hospital</label>
        <textarea id="notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="cc-input" />
      </div>
      <button type="submit" disabled={busy} className="cc-btn-sos w-full"><CheckCircle2 className="w-4 h-4" /> {busy ? 'Saving…' : 'Save assessment'}</button>
    </form>
  );
};

const PatientCard = ({ e, onSaved }) => {
  const { authed, showToast } = useCrisisCare();
  const p = e.patient || {};
  const [name, setName] = useState('');
  const [age, setAge] = useState(null);
  const [sex, setSex] = useState(null);

  const save = async () => {
    try {
      await authed('ambulance', '/ambulance/emergency/patient', { method: 'PUT', body: { fullName: name.trim() || null, ageGroup: age, sex } });
      setName('');
      showToast('Patient updated', 'Saved on the patient record.', 'success');
      onSaved();
    } catch (err) {
      showToast('Not saved', err.message, 'warning');
    }
  };

  return (
    <div className="cc-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={p.fullName || 'Patient'} />
        <div>
          <h2 className="text-lg font-black">{p.fullName || 'Name not known'}</h2>
          <p className="text-xs text-stone-500">{[AGES[p.ageGroup], p.sex?.toLowerCase(), p.bloodGroup && `Blood ${p.bloodGroup}`].filter(Boolean).join(' · ') || 'Age and sex not given'}</p>
        </div>
      </div>

      {e.photo ? (
        <figure>
          <img src={e.photo} alt="Injury photo sent by the reporter" className="w-full max-h-72 object-cover rounded-xl border border-stone-200" />
          <figcaption className="text-xs text-stone-500 mt-1 flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Sent by the reporter{e.report.bodyArea ? ` · ${e.report.bodyArea}` : ''}</figcaption>
        </figure>
      ) : null}

      <dl className="grid grid-cols-2 gap-3">
        <Field label="Reported">{findCategory(e.type).label}{e.patientCount > 1 ? ` · ${e.patientCount} patients` : ''}</Field>
        <Field label="Reported by">{{ SELF: 'Patient', FAMILY: 'Family', BYSTANDER: 'Bystander' }[e.report.reporterRelation] || 'Not said'}</Field>
        {e.report.symptoms.length > 0 && <Field label="Symptoms">{e.report.symptoms.join(', ')}{e.report.painLevel ? ` · pain ${e.report.painLevel}/5` : ''}</Field>}
        {e.report.bodyArea && !e.photo && <Field label="Injury">{e.report.bodyArea}</Field>}
        {p.knownConditions?.length > 0 && <Field label="Conditions">{p.knownConditions.join(', ')}</Field>}
        {p.allergies?.length > 0 && <Field label="Allergies"><span className="text-red-700 font-black">{p.allergies.join(', ')}</span></Field>}
      </dl>

      <div className="flex flex-wrap gap-2">
        {e.callerPhone && <a href={tel(e.callerPhone)} className="cc-btn-outline !py-2"><PhoneCall className="w-4 h-4" /> Caller {e.callerPhone}</a>}
        {p.emergencyContactPhone && <a href={tel(p.emergencyContactPhone)} className="cc-btn-outline !py-2"><PhoneCall className="w-4 h-4" /> Family {p.emergencyContactPhone}</a>}
        <a href={directionsUrl(e.lat, e.lng)} target="_blank" rel="noreferrer" className="cc-btn-primary !py-2"><Navigation className="w-4 h-4" /> Navigate to patient</a>
      </div>

      <details className="rounded-xl border border-stone-200 p-3">
        <summary className="text-sm font-bold cursor-pointer">Correct patient details</summary>
        <div className="mt-3 space-y-3">
          <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Full name" maxLength={150} className="cc-input" />
          <div className="flex flex-wrap gap-2">{Object.entries(AGES).map(([id, l]) => <Pill key={id} on={age === id} onClick={() => setAge(age === id ? null : id)}>{l}</Pill>)}</div>
          <div className="flex flex-wrap gap-2">{['FEMALE', 'MALE', 'OTHER'].map((s) => <Pill key={s} on={sex === s} onClick={() => setSex(sex === s ? null : s)}>{s.toLowerCase()}</Pill>)}</div>
          <button type="button" onClick={save} className="cc-btn-dark !py-2">Save to patient record</button>
        </div>
      </details>
    </div>
  );
};

const HospitalChoice = ({ e, onChanged }) => {
  const { authed, showToast } = useCrisisCare();
  const { data: list, error, refresh } = useLive(() => authed('ambulance', '/ambulance/emergency/hospitals'), {
    token: null, events: [], pollMs: 30000, key: `${e.code}-${e.assessment?.recordedAt}-${e.hospital?.response}`,
  });
  const locked = ['TRANSPORTING', 'ARRIVED'].includes(e.status);

  const ask = async (h) => {
    try {
      await authed('ambulance', '/ambulance/emergency/select-hospital', { method: 'POST', body: { hospitalId: h.id } });
      showToast('Hospital asked', `${h.name} sees the patient now. Call them if they don't answer in 3 minutes.`, 'info');
      onChanged();
      refresh();
    } catch (err) {
      showToast('Could not ask this hospital', err.message, 'warning');
    }
  };

  return (
    <div className="cc-card p-5 space-y-3">
      <div>
        <h2 className="text-lg font-black">Best hospital for this patient</h2>
        <p className="text-xs text-stone-500">Ranked by what the patient needs ({e.needs?.join(', ')}), whether the emergency room is open, then travel time.</p>
      </div>
      <ErrorNote error={error} />
      {!list && !error && <p className="text-sm text-stone-400">Ranking hospitals…</p>}
      <ol className="space-y-2.5">
        {list?.map((h) => {
          const isCurrent = e.hospital?.id === h.id;
          return (
            <li key={h.id} className={`rounded-2xl border p-3.5 ${h.recommended ? 'border-emerald-400 bg-emerald-50/50' : h.response === 'declined' ? 'border-red-200 bg-red-50/40 opacity-70' : 'border-stone-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {h.recommended && <span className="cc-chip bg-emerald-600 text-white"><Star className="w-3 h-3" /> Best fit</span>}
                    {h.nearest && !h.recommended && <span className="cc-chip bg-stone-200 text-stone-700">Nearest</span>}
                    <ErStatusBadge status={h.erStatus} />
                    <OwnershipBadge ownership={h.ownership} />
                  </div>
                  <h3 className="font-black text-sm mt-1">{h.name}</h3>
                  <p className="text-xs text-stone-500">{h.zone} · {h.distanceKm} km · ~{h.etaMinutes} min{h.extraMinutes > 0 ? ` (+${h.extraMinutes} vs nearest)` : ''} · ICU free {h.icuFree}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  {h.response === 'declined' ? (
                    <span className="cc-chip bg-red-600 text-white"><XCircle className="w-3 h-3" /> Declined</span>
                  ) : h.response === 'accepted' ? (
                    <span className="cc-chip bg-emerald-600 text-white"><CheckCircle2 className="w-3 h-3" /> Accepted</span>
                  ) : isCurrent ? (
                    <span className="cc-chip bg-amber-100 text-amber-900"><Radio className="w-3 h-3 animate-pulse" /> Waiting</span>
                  ) : (
                    <button onClick={() => ask(h)} disabled={locked || e.hospital?.response === 'accepted'} className="cc-btn-dark !py-1.5 !px-3 text-xs">Ask</button>
                  )}
                  {h.phone && <a href={tel(h.phone)} className="text-xs font-bold text-stone-600 hover:text-red-700 inline-flex items-center gap-1"><PhoneCall className="w-3 h-3" /> Call</a>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {h.fit.matched.map((m) => <span key={m} className="cc-chip bg-emerald-50 text-emerald-800 !font-semibold"><Check className="w-3 h-3" /> {m}</span>)}
                {h.fit.missing.map((m) => <span key={m} className="cc-chip bg-red-50 text-red-700 !font-semibold"><XCircle className="w-3 h-3" /> {m}</span>)}
              </div>
              {h.fit.warnings.length > 0 && <p className="text-[11px] text-amber-800 mt-1.5"><AlertTriangle className="inline w-3 h-3" /> {h.fit.warnings.join(' · ')}</p>}
              {h.declineReason && <p className="text-[11px] text-red-700 mt-1">Reason: {h.declineReason}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const STAGES = [
  ['ARRIVE_SCENE', 'Arrived at patient', (e, a) => a.status === 'DISPATCHED'],
  ['START_TRANSPORT', 'Patient on board, leave for hospital', (e, a) => a.status === 'AT_SCENE' && e.status === 'HOSPITAL_ACCEPTED'],
  ['ARRIVE_HOSPITAL', 'Arrived at hospital', (e) => e.status === 'TRANSPORTING'],
  ['HANDOVER', 'Patient handed over', (e) => e.status === 'ARRIVED'],
];

export const AmbulancePortal = () => {
  const { sessions, authed, logout, showToast } = useCrisisCare();
  const session = sessions.ambulance;
  const [gpsOn, setGpsOn] = useState(true);
  const { data, error, refresh } = useLive(() => authed('ambulance', '/ambulance/me'), {
    token: session?.token, events: ['emergency:changed'], pollMs: 15000, enabled: Boolean(session),
  });
  const lastGps = useGpsShare(authed, Boolean(session) && gpsOn);

  if (!session) return <Login />;

  const a = data?.ambulance;
  const e = data?.emergency;

  const stage = async (step) => {
    try {
      await authed('ambulance', '/ambulance/emergency/stage', { method: 'POST', body: { step } });
      refresh();
    } catch (err) {
      showToast('Not possible yet', err.message, 'warning');
    }
  };

  const setAvailability = async (status) => {
    try {
      await authed('ambulance', '/ambulance/availability', { method: 'PUT', body: { status } });
      refresh();
    } catch (err) {
      showToast('Not changed', err.message, 'warning');
    }
  };

  const next = a && e ? STAGES.find(([, , ok]) => ok(e, a)) : null;

  return (
    <div className="space-y-6">
      <div className="bg-stone-900 text-white rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={session.user.fullName} className="w-14 h-14 text-lg" />
          <div>
            <h1 className="text-xl sm:text-2xl font-black">{session.user.fullName}</h1>
            <p className="text-sm text-stone-300">{session.user.crewRole?.toLowerCase() || 'paramedic'} · {a?.callsign || session.user.ambulance.callsign} ({a?.type}) · {a?.status?.replace('_', ' ').toLowerCase()}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setGpsOn(!gpsOn)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${gpsOn ? 'bg-emerald-600' : 'bg-white/10'}`}>
            <LocateFixed className="w-4 h-4" /> GPS {gpsOn ? `on${lastGps ? ` · sent ${lastGps.toLocaleTimeString()}` : ''}` : 'off'}
          </button>
          {!e && a && (
            <button onClick={() => setAvailability(a.status === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE')} className="rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-semibold">
              {a.status === 'OFFLINE' ? 'Go on duty' : 'Go off duty'}
            </button>
          )}
          <button onClick={() => logout('ambulance')} className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-semibold"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
      </div>

      <ErrorNote error={error} />

      {!e ? (
        <div className="cc-card p-10 text-center space-y-2">
          <Truck className="w-10 h-10 mx-auto text-stone-300" />
          <h2 className="text-xl font-black">{a?.status === 'OFFLINE' ? 'You are off duty' : 'Waiting for a call'}</h2>
          <p className="text-sm text-stone-500">A new emergency appears here automatically, with an alert. Keep GPS on so dispatch can send you to the nearest call.</p>
        </div>
      ) : (
        <>
          <div className={`rounded-3xl p-5 sm:p-6 flex flex-wrap items-center gap-5 ${e.priority === 'URGENT' ? 'bg-red-700 text-white' : 'bg-amber-100'}`}>
            <CategoryImage category={findCategory(e.type)} className="w-20 h-20 rounded-2xl bg-white shrink-0" />
            <div className="flex-1 min-w-[220px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold opacity-80">{e.code}</span>
                {e.priority === 'URGENT' && <span className="cc-chip bg-white text-red-700">URGENT</span>}
                {e.assessment && <TriageBadge level={e.assessment.triage} />}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black">{findCategory(e.type).label}</h2>
              <p className="text-sm opacity-90 flex items-center gap-1"><MapPin className="w-4 h-4" /> {e.locationText || 'Pinned location'} · reported {timeAgo(e.createdAt)}</p>
            </div>
            {next && (
              <button onClick={() => stage(next[0])} className="cc-btn bg-white text-stone-900 !py-4 text-base shadow-lg">
                <CheckCircle2 className="w-5 h-5" /> {next[1]}
              </button>
            )}
            {!next && e.status === 'AT_SCENE' && e.hospital?.response !== 'accepted' && (
              <span className="text-sm font-bold">Ask a hospital below. Transport starts once one accepts.</span>
            )}
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-6">
              <PatientCard e={e} onSaved={refresh} />
              <Assessment emergency={e} onSaved={refresh} />
            </div>
            <div className="lg:col-span-7 space-y-6">
              {e.hospital && (
                <div className={`cc-card p-4 flex flex-wrap items-center gap-3 ${e.hospital.response === 'accepted' ? 'border-emerald-400' : e.hospital.response === 'declined' ? 'border-red-300' : 'border-amber-300'}`}>
                  <Building2 className="w-6 h-6 text-amber-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black">{e.hospital.response === 'accepted' ? 'Accepted: ' : e.hospital.response === 'declined' ? 'Declined: ' : 'Waiting for: '}{e.hospital.name}</p>
                    <p className="text-xs text-stone-500">{e.hospital.response === 'declined' ? e.hospital.declineReason : `${e.hospital.distanceKm} km from patient · ~${e.hospital.etaMinutes} min`}</p>
                  </div>
                  {e.hospital.phone && <a href={tel(e.hospital.phone)} className="cc-btn-outline !py-2"><PhoneCall className="w-4 h-4" /> Call ER</a>}
                  <a href={directionsUrl(e.hospital.lat, e.hospital.lng)} target="_blank" rel="noreferrer" className="cc-btn-primary !py-2"><Navigation className="w-4 h-4" /> Navigate</a>
                </div>
              )}
              <MapView
                height="320px"
                markers={[
                  { id: 'p', kind: 'patient', lat: e.lat, lng: e.lng, popup: 'Patient' },
                  a?.lat != null && { id: 'a', kind: 'ambulance', lat: a.lat, lng: a.lng, label: a.callsign },
                  e.hospital && { id: 'h', kind: 'hospital', lat: e.hospital.lat, lng: e.hospital.lng, label: e.hospital.name },
                ].filter(Boolean)}
              />
              <HospitalChoice e={e} onChanged={refresh} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
