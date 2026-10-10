import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

const escapeHtml = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const pulse = (color) => `
  <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;">
    <div style="position:absolute;width:34px;height:34px;background:${color}40;border-radius:50%;animation:pulseMarker 1.8s infinite;"></div>
    <div style="width:18px;height:18px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3);"></div>
  </div>`;

const tag = (bg, border, text) => `
  <div style="display:flex;flex-direction:column;align-items:center;">
    <div style="background:${bg};color:#fff;padding:4px 8px;border-radius:8px;border:2px solid ${border};box-shadow:0 3px 10px rgba(0,0,0,.25);font-weight:700;font-size:11px;white-space:nowrap;">${escapeHtml(text)}</div>
    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${bg};"></div>
  </div>`;

const ICONS = {
  patient: (m) => L.divIcon({ className: '', html: pulse(m.color || '#DC2626'), iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17] }),
  ambulance: (m) => L.divIcon({ className: '', html: tag(m.color || '#047857', '#fff', `🚑 ${m.label}`), iconSize: [120, 32], iconAnchor: [60, 32], popupAnchor: [0, -32] }),
  hospital: (m) => L.divIcon({ className: '', html: tag('#1C1917', m.color || '#F59E0B', m.label), iconSize: [160, 32], iconAnchor: [80, 32], popupAnchor: [0, -32] }),
};

/** Re-frames only when the set of coordinates changes, so live updates don't jitter the map. */
function FitView({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14, { animate: false });
    else if (points.length > 1) map.fitBounds(points, { padding: [50, 50], maxZoom: 15, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * markers: [{ id, lat, lng, kind: 'patient'|'ambulance'|'hospital', label, popup, color }]
 * route:   optional [[lat, lng], ...] drawn as a dashed straight line (not road routing)
 */
export const MapView = ({ markers = [], route = null, height = '360px', fitTo = null }) => {
  const valid = markers.filter((m) => m.lat != null && m.lng != null);
  const points = useMemo(
    () => (fitTo || valid).filter((m) => m.lat != null).map((m) => [m.lat, m.lng]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify((fitTo || valid).map((m) => [m.lat, m.lng]))],
  );
  const center = points[0] || [19.076, 72.8777];

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-stone-200 bg-stone-100" style={{ height }}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="w-full h-full">
        <FitView points={points.length ? points : [center]} />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {valid.map((m) => (
          <Marker key={m.id || `${m.kind}-${m.lat}-${m.lng}`} position={[m.lat, m.lng]} icon={ICONS[m.kind || 'patient'](m)}>
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}
        {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#F59E0B', weight: 4, opacity: 0.9, dashArray: '10, 8' }} />}
      </MapContainer>
    </div>
  );
};
