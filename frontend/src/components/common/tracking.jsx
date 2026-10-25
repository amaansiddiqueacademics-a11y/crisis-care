import React from 'react';
import { Clock } from 'lucide-react';

// Shared by the citizen tracker, the ambulance portal and the dispatch map, so all three show the
// same markers, route and arrival time for an emergency. Everything comes from the server's view.

const ago = (seconds) => (seconds < 90 ? `${Math.max(1, Math.round(seconds))} s` : `${Math.round(seconds / 60)} min`);

/** Plain-words freshness of the unit's GPS. */
export const gpsText = (amb) => {
  const g = amb?.gps;
  if (!g || g.state === 'NONE') return 'No live GPS yet (showing base station)';
  if (g.state === 'INVALID') return 'GPS signal unusable';
  if (g.state === 'STALE') return `Last GPS ${ago(g.ageSeconds)} ago (stale)`;
  return `Live GPS, ${ago(g.ageSeconds)} ago`;
};

/** The ambulance marker at its latest valid position; grey and labelled "last known" unless the GPS is live. */
export const ambulanceMarker = (amb, extra = {}) => {
  if (!amb || amb.lat == null || amb.lng == null) return null;
  const live = amb.gps?.state === 'LIVE';
  return {
    id: 'a',
    kind: 'ambulance',
    lat: amb.lat,
    lng: amb.lng,
    label: live ? amb.callsign : `${amb.callsign} · base station`,
    color: live ? '#047857' : '#78716C',
    popup: `${amb.callsign}: ${gpsText(amb)}`,
    ...extra,
  };
};

/** Patient, ambulance and (if one is involved and has not declined) hospital markers for one emergency. */
export const trackingMarkers = (e) => {
  const h = e.hospital;
  const hospitalShown = h && h.response !== 'declined';
  return [
    { id: 'p', kind: 'patient', lat: e.lat, lng: e.lng, popup: 'Patient' },
    ambulanceMarker(e.ambulance),
    hospitalShown && {
      id: 'h',
      kind: 'hospital',
      lat: h.lat,
      lng: h.lng,
      label: h.response === 'accepted' ? h.name : `Asked: ${h.name}`,
      color: h.response === 'accepted' ? '#10B981' : '#F59E0B',
    },
  ].filter(Boolean);
};

/** Dashed straight line from the unit to where it is heading now. Drawn only from a live position. */
export const routeLine = (e) => {
  const dest = e.navigation?.destination;
  const a = e.ambulance;
  // A unit with no live GPS is drawn from its base station: a demo path, labelled as such by the caller.
  if (!dest || !['LIVE', 'NONE'].includes(a?.gps?.state) || a.lat == null) return null;
  return [[a.lat, a.lng], [dest.lat, dest.lng]];
};

/** Short text for compact places (tables, cards): minutes as an estimate, or why there is none. */
export const etaShort = (amb) => {
  const eta = amb?.eta;
  if (!eta) return '';
  if (eta.status === 'ARRIVED') return 'arrived';
  if (eta.status === 'ESTIMATE') return `~${eta.minutes} min (estimate)`;
  return 'arrival time unavailable';
};

/** Arrival-time block: number only when the server has a live position; otherwise the reason. */
export const EtaBadge = ({ amb, tone = 'dark' }) => {
  const eta = amb?.eta;
  if (!eta || eta.status === 'ARRIVED' || (eta.status === 'UNAVAILABLE' && !eta.message)) return null;
  const to = eta.to === 'HOSPITAL' ? 'hospital' : 'patient';

  if (eta.status === 'UNAVAILABLE') {
    return (
      <div className={`rounded-2xl px-5 py-3 max-w-[16rem] text-sm ${tone === 'dark' ? 'bg-black/20' : 'bg-stone-100 text-stone-700'}`} role="status">
        <div className="font-black flex items-center gap-1.5"><Clock className="w-4 h-4" /> Arrival time unavailable</div>
        <div className="text-xs mt-1 opacity-90">{eta.message}</div>
      </div>
    );
  }

  return (
    <div className={`text-center rounded-2xl px-6 py-3 shrink-0 ${tone === 'dark' ? 'bg-black/20' : 'bg-stone-100 text-stone-800'}`} title={eta.message}>
      <div className="text-5xl font-black tabular-nums leading-none">~{eta.minutes}</div>
      <div className="text-xs font-bold mt-1">min to {to} · rough estimate</div>
      <div className="text-[10px] opacity-80 mt-0.5">{eta.basis === 'BASE_STATION' ? 'demo: from base station, no live GPS' : 'straight-line, no traffic data'}</div>
    </div>
  );
};
