const fs = require('fs');
let code = fs.readFileSync('frontend/frontend/src/context/CrisisCareContext.jsx', 'utf8');

const replacement = `    // Find nearest or available ambulance from liveAttendants state, fallback if empty
    let assignedAmbulance = null;
    if (liveAttendants && liveAttendants.length > 0) {
      const available = liveAttendants.filter(a => a.status === 'available');
      assignedAmbulance = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : liveAttendants[0];
    } else {
      assignedAmbulance = { name: 'Ravi Kumar (EMT)', callsign: 'Alpha-205 (BLS Unit)', badge_id: 'PARA-101' };
    }

    // Build a local incident immediately for UI responsiveness
    const localIncident = {
      id: incidentId,
      patientDetails: reportData.patientDetails || 'Emergency reported',
      patientCategory: reportData.emergencyType,
      type: reportData.emergencyType,
      patientCount: reportData.patientCount || 1,
      locationName: reportData.locationName || userLocation.address,
      lat: userLocation.lat,
      lng: userLocation.lng,
      status: 'Dispatching...',
      statusStep: 1,
      assignedAmbulanceCallsign: assignedAmbulance.callsign,
      paramedicName: assignedAmbulance.name,
      paramedicBadge: assignedAmbulance.badge_id,
      targetHospitalId: null,
      targetHospitalName: null,
      hospitalResponse: null,
      etaMinutes: 4,
      createdAt: new Date().toISOString(),
    };`;

code = code.replace(/    \/\/ Build a local incident immediately for UI responsiveness[\s\S]*?createdAt: new Date\(\)\.toISOString\(\),\r?\n    \};/, replacement);

code = code.replace(
  '}, [userLocation, showToast, backendOnline]);',
  '}, [userLocation, showToast, backendOnline, liveAttendants]);'
);

fs.writeFileSync('frontend/frontend/src/context/CrisisCareContext.jsx', code);
