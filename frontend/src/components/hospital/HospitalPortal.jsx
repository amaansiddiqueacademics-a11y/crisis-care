import React, { useState } from 'react';
import {
  Building2, Camera, Check, CheckCircle2, KeyRound, Lock, LogOut, Minus, Plus, Radio, ShieldCheck, Stethoscope, Truck,
  User, XCircle,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { useLive } from '../../hooks/useLive';
import { findCategory } from '../../data/emergencyCategories';
import { tel } from '../../data/helplines';
import { ER_STATUS, ErrorNote, Field, Pill, TriageBadge, timeAgo } from '../common/ui';

const SERVICE_LABELS = {
  TRAUMA: 'Trauma care', CATH_LAB: 'Cath lab', STROKE: 'Stroke unit', BURNS: 'Burns unit', MATERNITY: 'Maternity',
  NICU: 'Newborn ICU', PAEDIATRIC: "Children's ER", DIALYSIS: 'Dialysis', TOXICOLOGY: 'Poison treatment', ANTIVENOM: 'Anti-snake venom',
};
const DECLINE_REASONS = [
  'No ICU bed free', 'Emergency room full (on diversion)', 'Required specialist not on duty', 'Cath lab / CT not working',
  'Operation theatres occupied', 'No matching blood available', 'Ventilators all in use',
];
const AGES = { INFANT: 'Baby', CHILD: 'Child', TEEN: 'Teen', ADULT: 'Adult', SENIOR: 'Senior 60+' };
const FINDING_LABELS = {
  stElevation: 'ST elevation', painMinutes: 'Pain (min)', onsetHours: 'Onset (h ago)', faceDroop: 'Face droop', armWeakness: 'Arm weak',
  speechSlurred: 'Speech slurred', spinalInjury: 'Spine injury?', gcs: 'GCS', burnPercent: '% burned', airwayBurn: 'Airway burn',
  weeks: 'Weeks pregnant', heavyBleeding: 'Heavy bleeding', contractionsMin: 'Contractions every (min)', hoursSinceBite: 'Bite (h ago)',
  neuroSigns: 'Neuro signs', swelling: 'Swelling', substance: 'Substance', hoursSince: 'Hours since', ageYears: 'Age', weightKg: 'Weight kg',
};
const show = (v) => (v === true ? 'Yes' : v === false ? 'No' : String(v));

const Login = () => {
  const { login, showToast } = useCrisisCare();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await login('hospital', username.trim(), password);
      showToast('Signed in', `${s.user.hospital.name} emergency desk`, 'success');
    } catch (err) {
      showToast('Sign-in failed', err.message, 'warning');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <form onSubmit={submit} className="cc-card p-8 space-y-5 shadow-lg">
        <div className="text-center">
          <span className="w-14 h-14 rounded-2xl bg-stone-900 text-white flex items-center justify-center mx-auto mb-3"><Building2 className="w-7 h-7" /></span>
          <h1 className="text-2xl font-black">Hospital emergency desk</h1>
          <p className="text-sm text-stone-500 mt-1">Each hospital signs in with its own hospital ID.</p>
        </div>
        <div>
          <label className="cc-label" htmlFor="h-user">Hospital ID</label>
          <div className="relative"><User className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" /><input id="h-user" value={username} onChange={(e) => setUsername(e.target.value)} className="cc-input pl-9" placeholder="e.g. kem_mumbai" autoComplete="username" required /></div>
        </div>
        <div>
          <label className="cc-label" htmlFor="h-pass">Password</label>
          <div className="relative"><KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" /><input id="h-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="cc-input pl-9" autoComplete="current-password" required /></div>
        </div>
        <button type="submit" disabled={busy} className="cc-btn-dark w-full !py-3"><Lock className="w-4 h-4" /> {busy ? 'Checking…' : 'Sign in securely'}</button>
        <ul className="text-xs text-stone-500 space-y-1.5 border-t border-stone-100 pt-4">
          <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /> Passwords are stored only as bcrypt hashes. Repeated failed attempts are blocked.</li>
          <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /> You only see patients sent to your hospital. Other hospitals cannot see your data.</li>
          <li className="flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /> The screen locks after 15 minutes idle. Every change is written to a tamper-evident audit log.</li>
        </ul>
        <p className="text-[11px] text-stone-400 text-center">Development IDs and passwords: backend/data/hospital_admin_credentials.csv</p>
      </form>
    </div>
  );
};

const RequestCard = ({ r, onRespond }) => {
  const e = r.emergency;
  const [declining, setDeclining] = useState(false);
  const a = e.assessment;
  const p = e.patient;
  const findings = Object.entries(a?.findings || {}).filter(([k]) => k !== 'triageReasons');

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${r.status === 'pending' ? 'border-red-300 bg-white shadow-sm' : r.status === 'accepted' ? 'border-emerald-300 bg-emerald-50/50' : 'border-stone-200 bg-stone-50 opacity-75'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {e.priority === 'URGENT' && <span className="cc-chip bg-red-600 text-white">URGENT</span>}
            <TriageBadge level={a?.triage} />
            <span className="font-mono text-[11px] text-stone-400">{e.code}</span>
          </div>
          <h3 className="text-lg font-black mt-1">{findCategory(e.type).label}</h3>
          <p className="text-xs text-stone-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> {e.ambulance?.callsign} · {e.ambulance?.paramedicName} · asked {timeAgo(r.requestedAt)}</p>
        </div>
        {e.hospital && <div className="text-right"><div className="text-3xl font-black tabular-nums leading-none">~{e.hospital.etaMinutes}</div><div className="text-[11px] text-stone-500">min · {e.hospital.distanceKm} km</div></div>}
      </div>

      {a?.findings?.triageReasons?.length > 0 && <p className="text-xs font-bold text-red-700">{a.findings.triageReasons.join(' · ')}</p>}

      <div className="grid sm:grid-cols-[1fr_auto] gap-3">
        <dl className="grid grid-cols-2 gap-2.5 text-sm">
          <Field label="Patient">{[p?.fullName, AGES[p?.ageGroup], p?.sex?.toLowerCase()].filter(Boolean).join(', ') || 'Not known'}</Field>
          <Field label="Blood group">{p?.bloodGroup || 'Unknown'}</Field>
          {a && <Field label="Vitals">{[a.heartRate && `HR ${a.heartRate}`, a.spo2 && `SpO2 ${a.spo2}%`, a.systolicBp && `BP ${a.systolicBp}/${a.diastolicBp ?? '?'}`].filter(Boolean).join(' · ') || '—'}</Field>}
          {a && <Field label="Status">{a.consciousness} · breathing {a.breathing} · pulse {a.pulseStatus}{a.severeBleeding ? ' · BLEEDING' : ''}</Field>}
          {p?.knownConditions?.length > 0 && <Field label="Conditions">{p.knownConditions.join(', ')}</Field>}
          {p?.allergies?.length > 0 && <Field label="Allergies"><span className="text-red-700">{p.allergies.join(', ')}</span></Field>}
          {e.report.symptoms.length > 0 && <Field label="Symptoms">{e.report.symptoms.join(', ')}</Field>}
          {findings.map(([k, v]) => <Field key={k} label={FINDING_LABELS[k] || k}>{show(v)}</Field>)}
          {a?.notes && <Field label="Crew notes">{a.notes}</Field>}
        </dl>
        {e.photo && <img src={e.photo} alt="Injury photo from the reporter" className="w-32 h-32 rounded-xl object-cover border border-stone-200" />}
      </div>
      {!a && <p className="text-xs text-amber-800">The crew has not recorded vitals yet. Expect an update.</p>}

      <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
        <p className="cc-label">Can you treat this patient?</p>
        <div className="flex flex-wrap gap-1">
          {r.fit.matched.map((m) => <span key={m} className="cc-chip bg-emerald-50 text-emerald-800"><Check className="w-3 h-3" /> {m}</span>)}
          {r.fit.missing.map((m) => <span key={m} className="cc-chip bg-red-50 text-red-700"><XCircle className="w-3 h-3" /> {m} (you have none)</span>)}
        </div>
      </div>

      {r.status === 'pending' ? (
        declining ? (
          <div className="space-y-2">
            <p className="text-xs font-bold">Why? The crew is told immediately and goes to the next hospital.</p>
            {DECLINE_REASONS.map((reason) => (
              <button key={reason} onClick={() => onRespond(r, 'DECLINE', reason)} className="w-full text-left rounded-xl border border-stone-200 hover:border-red-500 hover:bg-red-50 px-3 py-2 text-sm font-semibold">{reason}</button>
            ))}
            <button onClick={() => setDeclining(false)} className="text-xs font-bold text-stone-500 hover:underline">Back</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onRespond(r, 'ACCEPT')} className="cc-btn bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle2 className="w-4 h-4" /> Accept (reserve ICU bed)</button>
            <button onClick={() => setDeclining(true)} className="cc-btn-outline !text-red-700"><XCircle className="w-4 h-4" /> Decline</button>
          </div>
        )
      ) : (
        <p className={`text-sm font-bold ${r.status === 'accepted' ? 'text-emerald-700' : 'text-stone-500'}`}>
          {r.status === 'accepted' ? `Accepted ${timeAgo(r.respondedAt)}. Ambulance status: ${e.status.replace('_', ' ').toLowerCase()}` : `Declined: ${r.declineReason}`}
        </p>
      )}
    </div>
  );
};

const Stepper = ({ item, onChange }) => (
  <div className={`rounded-xl border p-3 ${item.available > 0 ? 'bg-white border-stone-200' : 'bg-red-50 border-red-200'}`}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs font-bold leading-tight">{item.name.replace('Blood ', '')}</span>
      {!item.confirmed && <span className="text-[10px] font-bold text-amber-700" title="Seeded sample value; adjust to confirm">sample</span>}
    </div>
    <div className="flex items-center justify-between mt-1.5">
      <span className="text-2xl font-black tabular-nums">{item.available}</span>
      <span className="flex gap-1">
        <button onClick={() => onChange(item, -1)} className="w-8 h-8 rounded-lg border border-stone-300 flex items-center justify-center hover:bg-stone-100" aria-label={`Decrease ${item.name}`}><Minus className="w-3.5 h-3.5" /></button>
        <button onClick={() => onChange(item, 1)} className="w-8 h-8 rounded-lg border border-stone-300 flex items-center justify-center hover:bg-stone-100" aria-label={`Increase ${item.name}`}><Plus className="w-3.5 h-3.5" /></button>
      </span>
    </div>
    {item.reserved > 0 && <p className="text-[10px] text-stone-500 mt-1">{item.reserved} reserved for incoming</p>}
  </div>
);

export const HospitalPortal = () => {
  const { sessions, authed, logout, showToast } = useCrisisCare();
  const session = sessions.hospital;
  const opts = { token: session?.token, enabled: Boolean(session) };
  const me = useLive(() => authed('hospital', '/hospital/me'), { ...opts, events: ['inventory:changed'], pollMs: 60000 });
  const requests = useLive(() => authed('hospital', '/hospital/requests'), { ...opts, events: ['emergency:changed', 'inventory:changed'], pollMs: 15000 });
  const [note, setNote] = useState('');
  const [surgeon, setSurgeon] = useState('');

  if (!session) return <Login />;

  const call = async (path, options, success) => {
    try {
      const out = await authed('hospital', path, options);
      if (success) showToast(...success);
      me.refresh();
      requests.refresh();
      return out;
    } catch (err) {
      showToast('Not saved', err.message, 'warning');
      return null;
    }
  };

  const respond = (r, decision, reason) =>
    call(`/hospital/requests/${r.responseId}/respond`, { method: 'POST', body: { decision, reason } }, decision === 'ACCEPT' ? ['Accepted', 'ICU bed reserved. The crew is on the way.', 'success'] : ['Declined', 'The crew has been told and will reroute.', 'info']);

  const adjust = (item, delta) => call(`/hospital/inventory/${item.code}`, { method: 'PATCH', body: { delta } });

  const data = me.data;
  const h = data?.hospital;
  const pending = requests.data?.filter((r) => r.status === 'pending') || [];
  const groups = data ? {
    'Beds & equipment': data.inventory.filter((i) => ['BED', 'EQUIPMENT', 'OXYGEN'].includes(i.category)),
    'Specialists on duty now': data.inventory.filter((i) => i.category === 'STAFF'),
    'Blood bank (units)': data.inventory.filter((i) => i.category === 'BLOOD'),
  } : {};

  return (
    <div className="space-y-6">
      <div className="bg-stone-900 text-white rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="cc-chip bg-emerald-500 text-white"><Lock className="w-3 h-3" /> Secure session</span>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">{h?.name || session.user.hospital.name}</h1>
          <p className="text-sm text-stone-400">{h?.zone} · {session.user.fullName || session.user.username} · session ends {new Date(session.expiresAt).toLocaleTimeString()} or after 15 min idle</p>
        </div>
        <button onClick={() => logout('hospital')} className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-semibold"><LogOut className="w-4 h-4" /> Sign out</button>
      </div>

      <ErrorNote error={me.error || requests.error} />

      {h && (
        <section className="cc-card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black">Emergency room status</h2>
              <p className="text-xs text-stone-500">Ambulances are routed away from you while on diversion. Updated {timeAgo(h.erStatusUpdatedAt)}.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {Object.entries(ER_STATUS).map(([status, [label, style]]) => (
              <button key={status} onClick={() => call('/hospital/er-status', { method: 'PUT', body: { status, note: note.trim() || null } }, ['Status updated', label, 'success'])} aria-pressed={h.erStatus === status} className={`rounded-xl border-2 px-3 py-3 text-sm font-black transition ${h.erStatus === status ? `${style} border-current` : 'border-stone-200 hover:border-stone-400'}`}>
                {label}
              </button>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="cc-input" placeholder={h.erStatusNote || 'Optional note, e.g. "No paediatric cases until 6 PM", then pick a status'} />
        </section>
      )}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 space-y-3">
          <h2 className="text-xl font-black flex items-center gap-2"><Radio className={`w-5 h-5 ${pending.length ? 'text-red-600 animate-pulse' : 'text-stone-400'}`} /> Incoming patients {pending.length > 0 && <span className="cc-chip bg-red-600 text-white">{pending.length} waiting</span>}</h2>
          {requests.data?.length === 0 && <div className="cc-card p-8 text-center text-sm text-stone-400">No ambulance is asking for your hospital right now. New requests appear here instantly.</div>}
          {requests.data?.map((r) => <RequestCard key={r.responseId} r={r} onRespond={respond} />)}
        </section>

        <section className="lg:col-span-6 space-y-5">
          {data && Object.entries(groups).map(([title, items]) => (
            <div key={title} className="cc-card p-5">
              <h3 className="font-black mb-3">{title}</h3>
              <div className={`grid gap-2 ${title.startsWith('Blood') ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {items.map((i) => <Stepper key={i.code} item={i} onChange={adjust} />)}
              </div>
            </div>
          ))}

          {data && (
            <div className="cc-card p-5">
              <h3 className="font-black">Services available now</h3>
              <p className="text-xs text-stone-500 mb-3">Switch off what is down (e.g. cath lab under maintenance) so crews don't bring patients you can't treat.</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SERVICE_LABELS).map(([code, label]) => {
                  const s = (data.services || []).find((x) => x.code === code);
                  return <Pill key={code} on={Boolean(s?.available)} onClick={() => call(`/hospital/services/${code}`, { method: 'PUT', body: { available: !s?.available } })}>{label}</Pill>;
                })}
              </div>
            </div>
          )}

          {data && (
            <div className="cc-card p-5 space-y-3">
              <h3 className="font-black flex items-center gap-2"><Stethoscope className="w-5 h-5 text-amber-600" /> Trauma surgeon on duty</h3>
              <p className="text-sm">{data.surgeon ? <><strong>{data.surgeon.fullName}</strong> · {data.surgeon.status.replace('_', ' ').toLowerCase()} · updated {timeAgo(data.surgeon.updatedAt)}</> : 'Not set'}</p>
              <div className="flex flex-wrap gap-2">
                <input value={surgeon} onChange={(e) => setSurgeon(e.target.value)} maxLength={150} className="cc-input flex-1 min-w-[180px]" placeholder="Surgeon's name (to change)" />
                {['AVAILABLE', 'IN_SURGERY', 'ON_CALL', 'OFFLINE'].map((status) => (
                  <button key={status} onClick={() => call('/hospital/surgeon', { method: 'PUT', body: { status, ...(surgeon.trim().length >= 2 ? { fullName: surgeon.trim() } : {}) } }, ['Surgeon updated', status.replace('_', ' ').toLowerCase(), 'success'])} className={`cc-btn !py-2 !px-3 border ${data.surgeon?.status === status ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-300'}`}>
                    {status.replace('_', ' ').toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {h?.phone && <p className="text-xs text-stone-500">Hospital desk phone on record: <a href={tel(h.phone)} className="font-bold">{h.phone}</a>. Crews see this number.</p>}
          {data && <p className="text-[11px] text-stone-400 flex items-center gap-1"><Camera className="w-3 h-3" /> Patient photos and details disappear from this screen 24 h after the case ends.</p>}
        </section>
      </div>
    </div>
  );
};
