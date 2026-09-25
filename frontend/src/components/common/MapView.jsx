import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Building2, Truck, ShieldCheck } from 'lucide-react';

// Clean, professional Origin Marker (Current Location / Ambulance)
const createOriginIcon = (label = 'Current Location') =>
  L.divIcon({
    className: 'custom-clean-origin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
        <div style="position: absolute; width: 36px; height: 36px; background: rgba(211, 47, 47, 0.3); border-radius: 50%; animation: pulseMarker 1.8s infinite;"></div>
        <div style="width: 22px; height: 22px; background: #D32F2F; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
          <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });

// Clean Destination Marker (Selected Target Hospital)
const createDestinationIcon = (hospitalName) =>
  L.divIcon({
    className: 'custom-clean-dest',
    html: `
      <div style="position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center;">
        <div style="
          background: #0D4752; 
          color: white; 
          padding: 5px 10px; 
          border-radius: 8px; 
          border: 2px solid #0F6B78; 
          box-shadow: 0 4px 12px rgba(13, 71, 82, 0.35); 
          font-weight: 800; 
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        ">
          <span style="background: #2E7D32; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
          🏥 ${hospitalName || 'Destination Hospital'}
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #0D4752;"></div>
      </div>
    `,
    iconSize: [140, 36],
    iconAnchor: [70, 36],
    popupAnchor: [0, -36],
  });

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export const MapView = ({ 
  userLocation, 
  activeRouteTarget, 
  height = '540px',
  originLabel = 'Current Location'
}) => {
  // Default coordinate if userLocation not yet set
  const originLat = userLocation?.lat || 19.0665;
  const originLng = userLocation?.lng || 72.8700;
  const center = [originLat, originLng];

  const targetLat = activeRouteTarget?.lat || 19.0760;
  const targetLng = activeRouteTarget?.lng || 72.8777;

  // Clean direct navigation polyline with natural slight curve
  const routePoints = activeRouteTarget ? [
    [originLat, originLng],
    [
      (originLat * 2 + targetLat) / 3 + 0.0012,
      (originLng * 2 + targetLng) / 3 - 0.0015
    ],
    [
      (originLat + targetLat * 2) / 3 - 0.001,
      (originLng + targetLng * 2) / 3 + 0.0012
    ],
    [targetLat, targetLng]
  ] : null;

  return (
    <div 
      className="relative w-full rounded-2xl overflow-hidden border-2 border-surface-border shadow-elevated bg-slate-100" 
      style={{ height }}
    >
      {/* Clean HUD Top Bar */}
      <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur-md px-4 py-2 rounded-xl border border-surface-border shadow-md flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 font-black text-teal-deep">
          <Navigation className="w-4 h-4 text-emergency-red animate-pulse" />
          <span>Live Emergency GPS Tracking</span>
        </div>
        <div className="h-4 w-px bg-slate-300"></div>
        <div className="text-slate-600 text-[11px] font-semibold">
          {activeRouteTarget ? (
            <span>
              Route to: <strong className="text-teal-deep">{activeRouteTarget.name}</strong> (~{activeRouteTarget.estimatedMinutes || 6} mins away)
            </span>
          ) : (
            <span>Tracking active location</span>
          )}
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <ChangeView 
          center={activeRouteTarget ? [(originLat + targetLat) / 2, (originLng + targetLng) / 2] : center} 
          zoom={13} 
        />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 1. Clean Origin Marker (Where the patient / ambulance is) */}
        <Marker position={[originLat, originLng]} icon={createOriginIcon(originLabel)}>
          <Popup>
            <div className="p-1 text-xs">
              <span className="font-extrabold text-emergency-red block mb-0.5">● {originLabel}</span>
              <p className="text-slate-600">{userLocation?.address || 'Incident Scene Coordinates'}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Lat: {originLat.toFixed(4)}, Lng: {originLng.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>

        {/* 2. Clean Destination Marker (Target Hospital Only) */}
        {activeRouteTarget && (
          <Marker position={[targetLat, targetLng]} icon={createDestinationIcon(activeRouteTarget.name)}>
            <Popup>
              <div className="p-1 text-xs">
                <span className="font-black text-teal-deep text-sm block">{activeRouteTarget.name}</span>
                <p className="text-slate-500 text-[11px]">{activeRouteTarget.address}</p>
                <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between font-bold text-[11px]">
                  <span className="text-status-green">ICU Beds: {activeRouteTarget.inventory?.icuBeds ?? 0} Available</span>
                  <span className="text-emergency-red">ETA: ~{activeRouteTarget.estimatedMinutes} mins</span>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 3. The Clean Navigation Tracking Route Line */}
        {routePoints && (
          <>
            {/* Background glow path */}
            <Polyline
              positions={routePoints}
              color="#D32F2F"
              weight={6}
              opacity={0.35}
            />
            {/* Primary dashed route line */}
            <Polyline
              positions={routePoints}
              color="#D32F2F"
              weight={4}
              opacity={0.95}
              dashArray="10, 8"
            />
          </>
        )}
      </MapContainer>
    </div>
  );
};
