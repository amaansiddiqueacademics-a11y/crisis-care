import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Building2, Camera, FileSpreadsheet, History, KeyRound, LogOut, MapPin, PhoneCall, ShieldCheck,
  Truck, UserCheck, XCircle,
} from 'lucide-react';
import { useCrisisCare } from '../../context/CrisisCareContext';
import { useLive } from '../../hooks/useLive';
import { api } from '../../api/client';
import { findCategory } from '../../data/emergencyCategories';
import { tel } from '../../data/helplines';
import { MapView } from '../common/MapView';
import { ConfirmDialog, ErrorNote, Field, TriageBadge, minutesAgo, timeAgo } from '../common/ui';
import { etaShort, gpsText, routeLine, trackingMarkers } from '../common/tracking';

const km = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const STAGE = {
  SEARCHING: ['No unit yet', 'bg-red-600 text-white'],
  AMBULANCE_ASSIGNED: ['Unit en route', 'bg-sky-100 text-sky-800'],
  AT_SCENE: ['On scene', 'bg-sky-100 text-sky-800'],
  HOSPITAL_PENDING: ['Waiting for hospital', 'bg-amber-100 text-amber-900'],
  HOSPITAL_DECLINED: ['Hospital declined', 'bg-red-100 text-red-800'],
  HOSPITAL_ACCEPTED: ['Hospital accepted', 'bg-emerald-100 text-emerald-800'],
  TRANSPORTING: ['Transporting', 'bg-emerald-100 text-emerald-800'],
  ARRIVED: ['At hospital', 'bg-emerald-100 text-emerald-800'],
};
const UNIT = { AVAILABLE: 'bg-emerald-100 text-emerald-800', OFFLINE: 'bg-stone-200 text-stone-600', MAINTENANCE: 'bg-stone-200 text-stone-600' };

/** What a dispatcher must act on now, in plain words. */
const problemsOf = (e) => {
  const out = [];
  if (e.status === 'SEARCHING') out.push(`No ambulance for ${e.waitingMinutes} min: assign one or call 108 control`);
  if (e.status === 'HOSPITAL_PENDING' && minutesAgo(e.updatedAt) >= 4) out.push(`${e.hospital?.name} has not answered for ${minutesAgo(e.updatedAt)} min: call them`);
  if (e.declinedHospitals.length >= 2) out.push(`${e.declinedHospitals.length} hospitals declined: help the crew find a bed`);
  if (e.status === 'AMBULANCE_ASSIGNED' && e.ambulance?.etaMinutes > 20) out.push(`Unit is ~${e.ambulance.etaMinutes} min away (estimate): is a closer one free?`);
  if (e.ambulance && e.ambulance.gps?.state !== 'LIVE' && ['AMBULANCE_ASSIGNED', 'TRANSPORTING'].includes(e.status)) out.push(`${e.ambulance.callsign} has no live GPS (${gpsText(e.ambulance).toLowerCase()}): call the crew`);
  return out;
};

const IncidentPanel = ({ e, units, onAssign, onCancel }) => {
  const p = e.patient;
  const nearestFree = units
    .filter((u) => u.status === 'AVAILABLE' && u.lat != null)
    .map((u) => ({ ...u, km: km(e, u) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 4);
  const canReassign = ['SEARCHING', 'AMBULANCE_ASSIGNED'].includes(e.status);
  const [stage, style] = STAGE[e.status] || [e.status, 'bg-stone-100'];

  return (
    <div className="cc-card overflow-hidden">
      <div className="p-5 border-b border-stone-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-stone-500">{e.code}</span>
            <span className={`cc-chip ${style}`}>{stage}</span>
            {e.priority === 'URGENT' && <span className="cc-chip bg-red-600 text-white">Urgent</span>}
            <TriageBadge level={e.assessment?.triage} />
          </div>
          <h3 className="text-2xl font-black mt-1">{findCategory(e.type).label}</h3>
          <p className="text-sm text-stone-500 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {e.locationText || `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`} · {e.waitingMinutes} min since report</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {e.callerPhone && <a href={tel(e.callerPhone)} className="cc-btn-outline !py-2"><PhoneCall className="w-4 h-4" /> Caller</a>}
          {e.hospital?.phone && <a href={tel(e.hospital.phone)} className="cc-btn-outline !py-2"><Building2 className="w-4 h-4" /> Hospital</a>}
          <button onClick={() => onCancel(e)} className="cc-btn-outline !py-2 !text-red-700"><XCircle className="w-4 h-4" /> Cancel call</button>
        </div>
      </div>

      {problemsOf(e).map((x) => <div key={x} className="px-5 py-2 bg-red-50 text-red-800 text-sm font-bold border-b border-red-100"><AlertTriangle className="inline w-4 h-4" /> {x}</div>)}

      <div className="grid md:grid-cols-2 gap-5 p-5">
        <dl className="grid grid-cols-2 gap-3 content-start">
          <Field label="Ambulance">{e.ambulance ? `${e.ambulance.callsign} · ${e.ambulance.paramedicName || ''} · ${etaShort(e.ambulance)}` : 'None'}</Field>
          <Field label="Hospital">{e.hospital ? `${e.hospital.name} (${e.hospital.response || 'asked'})` : 'Not chosen'}</Field>
          <Field label="Patient">{[p?.fullName, p?.ageGroup?.toLowerCase(), p?.sex?.toLowerCase(), p?.bloodGroup].filter(Boolean).join(', ') || 'Unknown'}</Field>
          <Field label="Needs">{e.needs?.join(', ')}</Field>
          {e.report.symptoms.length > 0 && <Field label="Symptoms">{e.report.symptoms.join(', ')}</Field>}
          {p?.knownConditions?.length > 0 && <Field label="Conditions">{p.knownConditions.join(', ')}</Field>}
          {e.assessment && <Field label="Vitals">{e.assessment.consciousness} · {e.assessment.breathing} · HR {e.assessment.heartRate ?? '?'} · SpO2 {e.assessment.spo2 ?? '?'}</Field>}
          {e.declinedHospitals.length > 0 && <Field label="Declined by">{e.declinedHospitals.map((d) => `${d.name} (${d.reason})`).join('; ')}</Field>}
          {p?.emergencyContactPhone && <Field label="Family"><a className="underline" href={tel(p.emergencyContactPhone)}>{p.emergencyContactPhone}</a></Field>}
        </dl>
        <div className="space-y-3">
          {e.photo && <img src={e.photo} alt="Reporter photo" className="w-full max-h-48 object-cover rounded-xl border border-stone-200" />}
          <MapView height="220px" markers={trackingMarkers(e)} route={routeLine(e)} />
        </div>
      </div>

      {canReassign && (
        <div className="px-5 pb-5">
          <p className="cc-label">{e.ambulance ? 'Send a closer unit instead' : 'Assign a unit'} (nearest free first)</p>
          {nearestFree.length === 0 ? (
            <p className="text-sm text-red-700 font-semibold">No unit is free. Ask 108 control for a government ambulance and tell the caller.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nearestFree.map((u) => (
                <button key={u.id} onClick={() => onAssign(e, u)} className="cc-btn-outline !py-2"><Truck className="w-4 h-4" /> {u.callsign} · {u.type} · {u.km.toFixed(1)} km</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const CANCEL_REASONS = ['Duplicate report', 'Prank call', 'Patient left or was taken by other transport', 'Other'];

/** Dispatcher cancellation: a reason is required and is written to the audit log. */
const CancelCallDialog = ({ e, busy, onConfirm, onClose }) => {
  const [choice, setChoice] = useState(null);
  const [other, setOther] = useState('');
  const reason = choice === 'Other' ? other.trim() : choice;
  return (
    <ConfirmDialog
      title={`Cancel call ${e.code}?`}
      confirmLabel="Cancel this call"
      cancelLabel="Keep the call"
      busy={busy}
      canConfirm={Boolean(reason) && reason.length >= 3}
      onConfirm={() => onConfirm(reason)}
      onClose={onClose}
    >
      <p>The citizen, the ambulance crew{e.hospital ? ' and the hospital' : ''} will stop treating this as an active call. {e.ambulance ? `${e.ambulance.callsign} is released` : ''}{e.hospital?.response === 'accepted' ? ' and the hospital bed reservation is released' : ''}. This is recorded in the audit log.</p>
      <fieldset className="space-y-1.5">
        <legend className="cc-label">Reason (required)</legend>
        {CANCEL_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-stone-800">
            <input type="radio" name="cancel-reason" checked={choice === r} onChange={() => setChoice(r)} /> {r}
          </label>
        ))}
        {choice === 'Other' && <input value={other} onChange={(ev) => setOther(ev.target.value)} maxLength={200} className="cc-input" placeholder="Say why (at least 3 letters)" aria-label="Other reason" />}
      </fieldset>
    </ConfirmDialog>
  );
};

const Console = () => {
  const { sessions, authed, logout, showToast } = useCrisisCare();
  const session = sessions.admin;
  const opts = { token: session.token };
  const board = useLive(() => authed('admin', '/admin/dispatch'), { ...opts, events: ['emergency:changed', 'inventory:changed'], pollMs: 15000 });
  const audit = useLive(() => authed('admin', '/admin/audit-logs?limit=60'), { ...opts, events: ['audit:new'], pollMs: 60000 });
  const [selectedCode, setSelectedCode] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const emergencies = board.data?.emergencies || [];
  const units = board.data?.ambulances || [];
  const selected = emergencies.find((e) => e.code === selectedCode) || emergencies[0];

  const act = async (path, body, msg) => {
    try {
      const data = await authed('admin', path, { method: 'POST', body });
      board.setData(data);
      showToast(...msg);
      return true;
    } catch (err) {
      showToast('Not done', err.message, 'warning');
      board.refresh();
      return false;
    }
  };

  const assign = (e, u) => act(`/admin/emergencies/${e.code}/assign`, { ambulanceId: u.id }, ['Unit assigned', `${u.callsign} is going to ${e.code}`, 'success']);
  // The call leaves the board only when the server confirms; a refusal keeps it and says why.
  const confirmCancel = async (reason) => {
    setCancelBusy(true);
    await act(`/admin/emergencies/${cancelTarget.code}/cancel`, { reason }, ['Call cancelled', `${cancelTarget.code}: ${reason}`, 'info']);
    setCancelBusy(false);
    setCancelTarget(null);
  };

  const exportCsv = async () => {
    try {
      const res = await api('/admin/audit-logs/export', { token: session.token, raw: true });
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement('a'), { href: url, download: 'crisis-care-audit-log.csv' }).click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Export failed', err.message, 'warning');
    }
  };

  const markers = useMemo(
    () => [
      ...emergencies.map((e) => ({ id: `e${e.id}`, kind: 'patient', lat: e.lat, lng: e.lng, color: e.priority === 'URGENT' ? '#DC2626' : '#F59E0B', popup: `${e.code} · ${findCategory(e.type).label}` })),
      ...units.filter((u) => u.lat != null).map((u) => ({ id: `u${u.id}`, kind: 'ambulance', lat: u.lat, lng: u.lng, label: u.emergencyCode && (!u.lastLocationUpdate || minutesAgo(u.lastLocationUpdate) > 5) ? `${u.callsign} · last known` : u.callsign, color: u.status === 'AVAILABLE' ? '#047857' : u.status === 'OFFLINE' ? '#78716C' : '#B45309' })),
    ],
    [emergencies, units],
  );

  const free = units.filter((u) => u.status === 'AVAILABLE').length;
  const waiting = emergencies.filter((e) => e.status === 'SEARCHING').length;
  const diversion = board.data?.zones.reduce((n, z) => n + z.diversion, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="bg-stone-900 text-white rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="cc-chip bg-amber-500 text-stone-950 mb-1">Dispatch control · live</span>
          <h1 className="text-2xl sm:text-3xl font-black">Mumbai Metropolitan Region & Palghar</h1>
          <p className="text-sm text-stone-400">Signed in as {session.user.fullName} · {board.updatedAt ? `updated ${board.updatedAt.toLocaleTimeString()}` : 'loading'}</p>
        </div>
        <button onClick={() => logout('admin')} className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-semibold"><LogOut className="w-4 h-4" /> Sign out</button>
      </div>

      <ErrorNote error={board.error} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          [emergencies.length, 'Open calls', Activity, 'text-amber-600'],
          [emergencies.filter((e) => e.priority === 'URGENT').length, 'Urgent', AlertTriangle, 'text-red-600'],
          [waiting, 'Waiting for a unit', Truck, waiting ? 'text-red-600' : 'text-stone-400'],
          [`${free}/${units.length}`, 'Units free', Truck, 'text-emerald-600'],
          [diversion, 'Hospitals on diversion', Building2, diversion ? 'text-red-600' : 'text-stone-400'],
        ].map(([value, label, Icon, color]) => (
          <div key={label} className="cc-card px-5 py-4 flex items-center justify-between">
            <div><div className="text-3xl font-black tabular-nums">{value}</div><div className="text-sm text-stone-500">{label}</div></div>
            <Icon className={`w-7 h-7 ${color}`} />
          </div>
        ))}
      </div>

      <MapView markers={markers} height="380px" />
      {cancelTarget && <CancelCallDialog e={cancelTarget} busy={cancelBusy} onConfirm={confirmCancel} onClose={() => setCancelTarget(null)} />}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-4 space-y-3" aria-label="Call queue">
          <h2 className="text-xl font-black">Queue <span className="text-sm font-semibold text-stone-500">(urgent first)</span></h2>
          {emergencies.length === 0 && <div className="cc-card p-8 text-center text-sm text-stone-400">No open calls.</div>}
          {emergencies.map((e) => {
            const [stage, style] = STAGE[e.status] || [e.status, ''];
            const flagged = problemsOf(e).length > 0;
            return (
              <button key={e.code} onClick={() => setSelectedCode(e.code)} aria-pressed={selected?.code === e.code} className={`cc-card w-full text-left p-4 border-l-4 ${e.priority === 'URGENT' ? 'border-l-red-500' : 'border-l-stone-300'} ${selected?.code === e.code ? 'ring-2 ring-amber-300' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-sm">{findCategory(e.type).label}</span>
                  <span className="text-xs text-stone-400 tabular-nums shrink-0">{e.waitingMinutes} min</span>
                </div>
                <p className="text-xs text-stone-500 truncate">{e.locationText || e.code}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className={`cc-chip ${style}`}>{stage}</span>
                  {flagged && <span className="cc-chip bg-red-50 text-red-700"><AlertTriangle className="w-3 h-3" /> act</span>}
                  {e.report.hasPhoto && <Camera className="w-3.5 h-3.5 text-stone-400" aria-label="Has photo" />}
                </div>
              </button>
            );
          })}
        </section>

        <section className="lg:col-span-8 space-y-6">
          {selected ? <IncidentPanel e={selected} units={units} onAssign={assign} onCancel={setCancelTarget} /> : <div className="cc-card p-10 text-center text-stone-400">Select a call.</div>}

          <div className="cc-card p-5 overflow-x-auto">
            <h3 className="text-lg font-black mb-3 flex items-center gap-2"><Truck className="w-5 h-5 text-amber-600" /> Fleet</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-stone-500 uppercase text-left"><tr><th className="py-1.5">Unit</th><th>Zone</th><th>Status</th><th>Crew</th><th>GPS</th><th>Call</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {units.map((u) => {
                  const stale = u.lastLocationUpdate && minutesAgo(u.lastLocationUpdate) > 5;
                  return (
                    <tr key={u.id}>
                      <td className="py-2 font-bold">{u.callsign} <span className="text-xs text-stone-400">{u.type}</span></td>
                      <td className="text-xs">{u.zone}</td>
                      <td><span className={`cc-chip ${UNIT[u.status] || 'bg-amber-100 text-amber-900'}`}>{u.status.replace('_', ' ').toLowerCase()}</span></td>
                      <td className="text-xs">{u.crew}</td>
                      <td className={`text-xs ${stale ? 'text-red-600 font-bold' : 'text-stone-500'}`}>{u.lastLocationUpdate ? timeAgo(u.lastLocationUpdate) : 'base station'}</td>
                      <td className="text-xs font-mono">{u.emergencyCode || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="cc-card p-5 overflow-x-auto">
            <h3 className="text-lg font-black mb-3 flex items-center gap-2"><Building2 className="w-5 h-5 text-amber-600" /> Hospital pressure by zone</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-stone-500 uppercase text-left"><tr><th className="py-1.5">Zone</th><th>Hospitals</th><th>Accepting</th><th>Limited</th><th>Diversion</th><th>ICU free</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {board.data?.zones.map((z) => (
                  <tr key={z.zone}><td className="py-2 font-bold">{z.zone}</td><td>{z.hospitals}</td><td>{z.accepting}</td><td>{z.limited}</td><td className={z.diversion ? 'text-red-700 font-bold' : ''}>{z.diversion}</td><td className={z.icuFree < 5 ? 'text-red-700 font-bold' : ''}>{z.icuFree}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="cc-card overflow-hidden">
        <div className="p-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-100">
          <h3 className="text-lg font-black flex items-center gap-2"><History className="w-5 h-5 text-amber-600" /> Audit log (append-only)</h3>
          <button onClick={exportCsv} className="text-xs font-bold text-stone-600 hover:text-amber-700 inline-flex items-center gap-1"><FileSpreadsheet className="w-4 h-4" /> Export CSV</button>
        </div>
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 uppercase sticky top-0"><tr><th className="py-2 px-4">Time</th><th className="py-2 px-4">By</th><th className="py-2 px-4">Hospital</th><th className="py-2 px-4">Action</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {audit.data?.map((l) => (
                <tr key={l.id}><td className="py-2 px-4 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td><td className="py-2 px-4">{l.actorName} <span className="text-stone-400">({l.actorRole})</span></td><td className="py-2 px-4">{l.hospitalName || '—'}</td><td className="py-2 px-4">{l.action}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AdminPortal = () => {
  const { sessions, login, showToast } = useCrisisCare();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (sessions.admin) return <Console />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login('admin', id.trim(), password);
    } catch (err) {
      showToast('Sign-in failed', err.message, 'warning');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <form onSubmit={submit} className="cc-card p-8 space-y-5 shadow-lg">
        <div className="text-center">
          <span className="w-14 h-14 rounded-2xl bg-stone-900 text-white flex items-center justify-center mx-auto mb-3"><ShieldCheck className="w-7 h-7" /></span>
          <h1 className="text-2xl font-black">Dispatch control</h1>
          <p className="text-sm text-stone-500 mt-1">Live calls, fleet and hospital capacity.</p>
        </div>
        <div>
          <label className="cc-label" htmlFor="dispatcher-id">Email</label>
          <div className="relative"><UserCheck className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" /><input id="dispatcher-id" type="email" value={id} onChange={(e) => setId(e.target.value)} className="cc-input pl-9" autoComplete="username" required /></div>
        </div>
        <div>
          <label className="cc-label" htmlFor="dispatcher-pass">Password</label>
          <div className="relative"><KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" /><input id="dispatcher-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="cc-input pl-9" autoComplete="current-password" required /></div>
        </div>
        <button type="submit" disabled={busy} className="cc-btn-dark w-full !py-3">{busy ? 'Checking…' : 'Sign in'}</button>
        <p className="text-xs text-stone-400 text-center">Development account: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in backend/.env</p>
      </form>
    </div>
  );
};
