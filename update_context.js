const fs = require('fs');
let code = fs.readFileSync('frontend/frontend/src/context/CrisisCareContext.jsx', 'utf8');

// Add realAuditLogs state
code = code.replace(
  'const [resourceChangesLoading, setResourceChangesLoading] = useState(false);',
  'const [resourceChangesLoading, setResourceChangesLoading] = useState(false);\n  const [realAuditLogs, setRealAuditLogs] = useState([]);'
);

// Add fetchAuditLogs
const fetchAudit = `  // ── Admin: fetch live ambulance attendants ────────────────────────────────
  const fetchLiveAttendants = useCallback(async () => {
    setAttendantsLoading(true);
    try {
      const data = await api.fetchAttendants();
      setLiveAttendants(data.attendants || []);
    } catch (err) {
      console.warn('[Admin] fetchAttendants failed:', err.message);
    } finally {
      setAttendantsLoading(false);
    }
  }, []);

  const fetchRealAuditLogs = useCallback(async () => {
    try {
      const data = await api.fetchAuditLogs();
      setRealAuditLogs(data.logs || []);
    } catch (err) {
      console.warn('[Admin] fetchAuditLogs failed:', err.message);
    }
  }, []);
`;
code = code.replace(/  \/\/ ── Admin: fetch live ambulance attendants[\s\S]*?\}, \[\]\);\n/, fetchAudit);

// Expose in provider
code = code.replace(
  'fetchAdminResourceChanges, fetchLiveAttendants,',
  'fetchAdminResourceChanges, fetchLiveAttendants, realAuditLogs, fetchRealAuditLogs,'
);

// Modify reportEmergency logic to dispatch a real ambulance
// We will modify the localIncident creation
const oldLocalIncident = `    // Build a local incident immediately for UI responsiveness
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
      assignedAmbulanceCallsign: 'Dispatching nearest unit...',
      paramedicName: 'Paramedic on the way',
      targetHospitalId: null,
      targetHospitalName: null,
      hospitalResponse: null,
      etaMinutes: 4,
      createdAt: new Date().toISOString(),
    };`;

const newLocalIncident = `    // Find nearest or available ambulance from liveAttendants state, fallback if empty
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
      assignedAmbulanceCallsign: assignedAmbulance.callsign + ' • ' + assignedAmbulance.badge_id,
      paramedicName: assignedAmbulance.name,
      targetHospitalId: null,
      targetHospitalName: null,
      hospitalResponse: null,
      etaMinutes: 4,
      createdAt: new Date().toISOString(),
    };`;

code = code.replace(oldLocalIncident, newLocalIncident);

// Add dependencies to reportEmergency
code = code.replace(
  '}, [userLocation, showToast, backendOnline]);',
  '}, [userLocation, showToast, backendOnline, liveAttendants]);'
);

fs.writeFileSync('frontend/frontend/src/context/CrisisCareContext.jsx', code);
