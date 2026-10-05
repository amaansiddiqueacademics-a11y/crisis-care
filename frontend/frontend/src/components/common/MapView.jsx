import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ── Fix Leaflet's broken default icon paths in Vite/webpack ──────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Animated origin marker (Patient / Scene) ─────────────────────────────────
const createOriginIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;">
        <div style="position:absolute;width:44px;height:44px;background:rgba(220,38,38,0.2);border-radius:50%;animation:pulseMarker 2s ease-in-out infinite;"></div>
        <div style="position:absolute;width:28px;height:28px;background:rgba(220,38,38,0.15);border-radius:50%;animation:pulseMarker 2s ease-in-out infinite 0.5s;"></div>
        <div style="width:18px;height:18px;background:#dc2626;border:3px solid #fff;border-radius:50%;box-shadow:0 0 16px rgba(220,38,38,0.8),0 2px 8px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize:    [44, 44],
    iconAnchor:  [22, 22],
    popupAnchor: [0, -24],
  });

// ── Active destination hospital marker ────────────────────────────────────────
const createDestinationIcon = (name = 'Hospital') =>
  L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="
          background:#052e16;
          color:#86efac;
          padding:6px 12px 6px 9px;
          border-radius:10px;
          border:2px solid #15803d;
          box-shadow:0 4px 20px rgba(0,0,0,0.6),0 0 16px rgba(22,163,74,0.3);
          font-weight:800;
          font-size:12px;
          font-family:system-ui,sans-serif;
          display:flex;
          align-items:center;
          gap:6px;
          white-space:nowrap;
          max-width:200px;
        ">
          <span style="background:#22c55e;width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;box-shadow:0 0 6px #22c55e;"></span>
          🏥 ${name.length > 22 ? name.slice(0, 20) + '…' : name}
        </div>
        <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #15803d;margin-top:-2px;"></div>
        <div style="width:2px;height:12px;background:linear-gradient(#15803d,transparent);"></div>
        <div style="width:8px;height:8px;background:#22c55e;border-radius:50%;box-shadow:0 0 8px #22c55e;"></div>
      </div>
    `,
    iconSize:    [200, 70],
    iconAnchor:  [100, 70],
    popupAnchor: [0, -72],
  });

// ── Small hospital markers (color coded by availability) ─────────────────────
const createSmallHospitalIcon = (available = true) => {
  const color   = available ? '#22c55e' : '#ef4444';
  const shadow  = available ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)';
  const label   = available ? '✓' : '✕';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:20px;height:20px;
        background:${color};
        border:2.5px solid #fff;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.6),0 0 6px ${shadow};
        display:flex;align-items:center;justify-content:center;
        font-size:9px;font-weight:900;color:#fff;
      ">${label}</div>
    `,
    iconSize:    [20, 20],
    iconAnchor:  [10, 10],
    popupAnchor: [0, -10],
  });
};

// ── Auto-fly to new target ────────────────────────────────────────────────────
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center?.[0] && center?.[1]) {
      map.flyTo(center, zoom, { duration: 1.4, easeLinearity: 0.25 });
    }
  }, [center?.[0], center?.[1], zoom]);
  return null;
}

function MapEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng);
    }
  });
  return null;
}

// ── MapView ───────────────────────────────────────────────────────────────────
export const MapView = ({
  userLocation,
  activeRouteTarget,
  allHospitals = [],
  height = '420px',
  originLabel = 'Emergency Scene',
  onMapClick,
}) => {
  const originLat = userLocation?.lat ?? 19.0665;
  const originLng = userLocation?.lng ?? 72.8700;

  const targetLat = activeRouteTarget?.lat ?? null;
  const targetLng = activeRouteTarget?.lng ?? null;

  // Smooth curved route line
  const routePoints = targetLat && targetLng ? [
    [originLat, originLng],
    [
      (originLat * 2 + targetLat) / 3 + 0.0015,
      (originLng * 2 + targetLng) / 3 - 0.001,
    ],
    [
      (originLat + targetLat * 2) / 3 - 0.001,
      (originLng + targetLng * 2) / 3 + 0.0013,
    ],
    [targetLat, targetLng],
  ] : null;

  const mapCenter = targetLat && targetLng
    ? [(originLat + targetLat) / 2, (originLng + targetLng) / 2]
    : [originLat, originLng];
  const mapZoom = targetLat ? 12 : 13;

  const etaText = activeRouteTarget?.estimatedMinutes
    ? `~${activeRouteTarget.estimatedMinutes} min away`
    : '';

  return (
    <div
      style={{
        height,
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#0d1117',
      }}
    >
      {/* HUD overlay */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 500,
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: 12,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: '#1D1D1F',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF3B30', display: 'inline-block', boxShadow: '0 0 6px rgba(255, 59, 48, 0.5)', flexShrink: 0 }} />
        {activeRouteTarget
          ? `Routing to destination ${etaText}`
          : `Live Map — ${originLabel}`}
      </div>

      <MapContainer
        center={[originLat, originLng]}
        zoom={13}
        scrollWheelZoom
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <ChangeView center={mapCenter} zoom={mapZoom} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains="abc"
          maxZoom={19}
        />
        
        <MapEvents onMapClick={onMapClick} />

        {/* Ambulance / Patient location marker */}
        <Marker position={[originLat, originLng]} icon={createOriginIcon()}>
          <Popup>
            <div style={{ fontSize: 12, fontFamily: 'system-ui, sans-serif', padding: '2px 0' }}>
              <strong style={{ color: '#dc2626', display: 'block', marginBottom: 4 }}>🚨 {originLabel}</strong>
              <span style={{ color: '#555', fontSize: 11 }}>{userLocation?.address || 'Current location'}</span>
            </div>
          </Popup>
        </Marker>

        {/* Selected hospital destination marker */}
        {targetLat && targetLng && (
          <Marker position={[targetLat, targetLng]} icon={createDestinationIcon(activeRouteTarget?.name)}>
            <Popup>
              <div style={{ fontSize: 13, fontFamily: '-apple-system, sans-serif', padding: '4px 2px' }}>
                <strong style={{ color: '#1D1D1F', display: 'block', marginBottom: 4 }}>Destination</strong>
                {activeRouteTarget.estimatedMinutes && (
                  <span style={{ fontSize: 12, color: '#0071E3', fontWeight: 500, display: 'block', marginTop: 4 }}>
                    ETA: {activeRouteTarget.estimatedMinutes} min • {activeRouteTarget.distanceKm ?? '?'} km
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Hospitals removed for operational security reasons */}

        {/* Route line — glow + animated dashes */}
        {routePoints && (
          <>
            <Polyline positions={routePoints} color="#dc2626" weight={12} opacity={0.15} />
            <Polyline positions={routePoints} color="#dc2626" weight={4}  opacity={0.9} />
            <Polyline positions={routePoints} color="#ff8888" weight={2}  opacity={0.8} dashArray="14, 10" />
          </>
        )}
      </MapContainer>

      <style>{`
        @keyframes pulseMarker {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.7); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
