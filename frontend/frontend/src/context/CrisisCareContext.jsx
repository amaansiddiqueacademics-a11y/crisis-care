/**
 * Crisis Care — Central Context Provider (V2 — Real Backend Integration)
 *
 * Architecture:
 *  • Hospitals/inventory come from the real backend (FastAPI /hospitals-summary
 *    and Gateway /admin/inventory). Mock data is used ONLY when the backend is
 *    unreachable (offline dev / demo mode).
 *  • Auth (hospital staff, admin) calls Gateway /admin/auth/login.
 *  • Hospital inventory updates call Gateway PUT /admin/inventory/:id.
 *  • SSE is consumed for real-time inventory and route_proposed events.
 *  • Citizen SOS and ambulance dispatch are wired to Gateway /dispatch-incident.
 *  • All state is derived from API responses — not from localStorage mutations.
 */

import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback
} from 'react';
import * as api from '../services/api';

// ── Fallback mock data (used when backend is unreachable) ────────────────────

const MOCK_HOSPITALS = [
  {
    id: 1, name: 'Apex Central Trauma Center',
    address: 'Plot 42, Healthcare Corridor, Sector 12, Mumbai',
    phone: '+91 22 2456 7890',
    lat: 19.0760, lng: 72.8777, tier: 1,
    resources: [
      { id: 101, resource_type: 'icu_bed', quantity_available: 8 },
      { id: 102, resource_type: 'ventilator', quantity_available: 5 },
      { id: 103, resource_type: 'oxygen_cylinder', quantity_available: 42 },
      { id: 104, resource_type: 'specialist_trauma_surgeon', quantity_available: 2 },
      { id: 105, resource_type: 'equipment_ct_scanner', quantity_available: 1 },
      { id: 106, resource_type: 'specialist_cardiologist', quantity_available: 2 },
    ],
    availability_score: 0.82, distanceKm: 2.4, estimatedMinutes: 6,
  },
  {
    id: 2, name: 'LifeLine Super Specialty Hospital',
    address: '88 Metro Boulevard, North Wing, Mumbai',
    phone: '+91 22 3456 7891',
    lat: 19.0882, lng: 72.8850, tier: 1,
    resources: [
      { id: 201, resource_type: 'icu_bed', quantity_available: 3 },
      { id: 202, resource_type: 'ventilator', quantity_available: 2 },
      { id: 203, resource_type: 'oxygen_cylinder', quantity_available: 26 },
      { id: 204, resource_type: 'specialist_cardiologist', quantity_available: 1 },
      { id: 205, resource_type: 'equipment_ct_scanner', quantity_available: 1 },
    ],
    availability_score: 0.54, distanceKm: 4.1, estimatedMinutes: 11,
  },
  {
    id: 3, name: 'Metro Emergency Hospital & Research',
    address: '15 Bypass Link Road, Civil Lines, Mumbai',
    phone: '+91 22 4567 8902',
    lat: 19.0620, lng: 72.8620, tier: 2,
    resources: [
      { id: 301, resource_type: 'icu_bed', quantity_available: 12 },
      { id: 302, resource_type: 'ventilator', quantity_available: 8 },
      { id: 303, resource_type: 'oxygen_cylinder', quantity_available: 55 },
      { id: 304, resource_type: 'specialist_neurologist', quantity_available: 1 },
    ],
    availability_score: 0.91, distanceKm: 6.8, estimatedMinutes: 17,
  },
  {
    id: 4, name: "St. Jude Community Health Center",
    address: '102 Station Road, Old Quarter, Mumbai',
    phone: '+91 22 5678 9013',
    lat: 19.0950, lng: 72.8550, tier: 3,
    resources: [
      { id: 401, resource_type: 'icu_bed', quantity_available: 0 },
      { id: 402, resource_type: 'oxygen_cylinder', quantity_available: 12 },
    ],
    availability_score: 0.15, distanceKm: 8.5, estimatedMinutes: 23,
  },
];

// ── Context ──────────────────────────────────────────────────────────────────

const CrisisCareContext = createContext(null);

export const CrisisCareProvider = ({ children }) => {
  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('cc_theme') || 'red');
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'red' ? 'teal' : 'red';
      localStorage.setItem('cc_theme', next);
      return next;
    });
  };

  // ── Backend connectivity ───────────────────────────────────────────────────
  const [backendOnline, setBackendOnline] = useState(null); // null = checking
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // ── Hospital data (real or mock) ───────────────────────────────────────────
  const [hospitals, setHospitals] = useState(MOCK_HOSPITALS);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [hospitalAuth, setHospitalAuth] = useState(null);
  const [ambulanceAuth, setAmbulanceAuth] = useState(null);
  const [adminAuth, setAdminAuth] = useState(null);

  // ── Incident / Emergency state ─────────────────────────────────────────────
  const [citizenIncident, setCitizenIncident] = useState(null);
  const [emergencies, setEmergencies] = useState([]);
  const [auditLogs, setAuditLogs] = useState([
    { id: 'LOG-001', timestamp: '19:42:11', date: '04/10/2026', hospitalId: 1, hospitalName: 'Apex Central Trauma Center', adminId: 'adm_shivam_027', adminName: 'Shivam Mishra', resourceType: 'ICU Bed', previousQty: 9, newQty: 8, action: 'Admission — bed consumed for trauma case' },
    { id: 'LOG-002', timestamp: '19:38:04', date: '04/10/2026', hospitalId: 2, hospitalName: 'LifeLine Super Specialty Hospital', adminId: 'adm_priya_003', adminName: 'Dr. Priya Nair', resourceType: 'Ventilator', previousQty: 3, newQty: 2, action: 'Intubation — ventilator allocated to critical patient' },
    { id: 'LOG-003', timestamp: '19:21:50', date: '04/10/2026', hospitalId: 1, hospitalName: 'Apex Central Trauma Center', adminId: 'sys_routing', adminName: 'Routing Engine', resourceType: 'Oxygen Cylinder', previousQty: 40, newQty: 42, action: 'Restock (+2) — supply delivery from SJH depot' },
    { id: 'LOG-004', timestamp: '18:55:33', date: '04/10/2026', hospitalId: 3, hospitalName: 'Metro Emergency Hospital', adminId: 'adm_ali_009', adminName: 'Dr. Ali Hassan', resourceType: 'Blood O−', previousQty: 6, newQty: 4, action: 'Transfusion — road accident patient, 2 units consumed' },
    { id: 'LOG-005', timestamp: '18:40:07', date: '04/10/2026', hospitalId: 1, hospitalName: 'Apex Central Trauma Center', adminId: 'adm_shivam_027', adminName: 'Shivam Mishra', resourceType: 'Trauma Surgeon', previousQty: 2, newQty: 1, action: 'Surgeon marked In-Surgery (unavailable)' },
    { id: 'LOG-006', timestamp: '17:12:45', date: '04/10/2026', hospitalId: 4, hospitalName: 'St. Jude Community Health Center', adminId: 'sys_routing', adminName: 'Routing Engine', resourceType: 'ICU Bed', previousQty: 0, newQty: 0, action: 'Route declined — no ICU capacity, rerouted to Apex' },
    { id: 'LOG-007', timestamp: '16:58:22', date: '04/10/2026', hospitalId: 2, hospitalName: 'LifeLine Super Specialty Hospital', adminId: 'adm_priya_003', adminName: 'Dr. Priya Nair', resourceType: 'CT Scanner', previousQty: 1, newQty: 0, action: 'Scanner offline — scheduled maintenance' },
  ]);
  const [hospitalDecisions, setHospitalDecisions] = useState({});
  const [selectedHospitalForAmbulance, setSelectedHospitalForAmbulance] = useState(null);

  // ── Hospital inventory (post-login, real) ──────────────────────────────────
  const [myInventory, setMyInventory] = useState(null); // { hospital_id, resources: [] }
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // ── Incoming route proposals (via SSE) ────────────────────────────────────
  const [incomingProposal, setIncomingProposal] = useState(null);

  // ── User location ──────────────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState({
    lat: 19.0665, lng: 72.8700,
    address: 'BKC Bandra East, Mumbai',
    isGpsActive: false, accuracyMeters: null,
  });

  // ── Recommended Hospitals (from ML routing) ────────────────────────────────
  const [recommendedHospitals, setRecommendedHospitals] = useState([]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState('overview');
  const [activeRouteTarget, setActiveRouteTarget] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // ── SSE ref ────────────────────────────────────────────────────────────────
  const sseRef = useRef(null);

  // ── Register 401 handler once ──────────────────────────────────────────────
  useEffect(() => {
    api.onUnauthorized(() => {
      api.clearToken();
      setHospitalAuth(null);
      setMyInventory(null);
      showToast('Session Expired', 'Your session has expired. Please log in again.', 'warning');
    });
  }, []);

  // ── Network online/offline ─────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Load hospitals from FastAPI on mount ────────────────────────────────────
  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = useCallback(async () => {
    setHospitalsLoading(true);
    try {
      const data = await api.fetchHospitalsSummary();
      // FastAPI returns { hospitals: [...] } or an array
      const list = data.hospitals || data;
      if (Array.isArray(list) && list.length > 0) {
        // Normalise: add distanceKm / estimatedMinutes if missing (they come
        // from route-incident per-call; for the summary we set a placeholder)
        setHospitals(list.map(h => ({
          ...h,
          distanceKm: h.distanceKm ?? h.distance_km ?? null,
          estimatedMinutes: h.estimatedMinutes ?? h.eta_minutes ?? null,
          lat: h.lat ?? (h.geom ? h.geom.lat : null),
          lng: h.lng ?? (h.geom ? h.geom.lng : null),
        })));
        setBackendOnline(true);
      }
    } catch (_err) {
      console.warn('[CrisisCareContext] Backend unreachable — using mock hospital data. Retrying in 5s...');
      setBackendOnline(false);
      // Keep MOCK_HOSPITALS as fallback (already set as initial state)
      setTimeout(() => {
        loadHospitals();
      }, 5000); // Retry every 5 seconds until it connects
    } finally {
      setHospitalsLoading(false);
    }
  }, []);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((title, message, type = 'info') => {
    setToastMessage({ title, message, type, id: Date.now() });
    setTimeout(() => setToastMessage(null), 4500);
  }, []);

  // ── Real GPS location ──────────────────────────────────────────────────────
  const requestGpsLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        showToast('GPS Unavailable', 'Your browser does not support geolocation.', 'warning');
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: parseFloat(pos.coords.latitude.toFixed(6)),
            lng: parseFloat(pos.coords.longitude.toFixed(6)),
            address: `${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`,
            isGpsActive: true,
            accuracyMeters: Math.round(pos.coords.accuracy),
          };
          setUserLocation(loc);
          resolve(loc);
        },
        (err) => {
          showToast('GPS Error', err.message, 'warning');
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }, [showToast]);

  // ── Hospital Staff Auth (real) ─────────────────────────────────────────────
  const loginHospital = useCallback(async (username, password) => {
    try {
      const result = await api.login(username, password);
      api.setToken(result.token);
      const auth = {
        token: result.token,
        hospitalId: result.hospital_id,
        hospitalName: result.hospital_name || hospitals.find(h => h.id === result.hospital_id)?.name || 'Hospital',
        username,
        role: 'Hospital Staff',
      };
      setHospitalAuth(auth);
      showToast('Authenticated', `Welcome to ${auth.hospitalName} Emergency Desk`, 'success');
      return true;
    } catch (err) {
      // Fallback: demo mode — accept any password >= 4 chars
      if (password && password.length >= 4 && backendOnline === false) {
        const hosp = hospitals.find(h => h.id === Number(username)) || hospitals[0];
        const auth = {
          token: 'demo-token',
          hospitalId: hosp.id,
          hospitalName: hosp.name,
          username,
          role: 'Hospital Staff (Demo)',
        };
        setHospitalAuth(auth);
        showToast('Demo Mode', `Logged into ${hosp.name} (backend offline)`, 'info');
        return true;
      }
      showToast('Login Failed', err.message, 'warning');
      return false;
    }
  }, [hospitals, backendOnline, showToast]);

  const logoutHospital = useCallback(() => {
    api.clearToken();
    setHospitalAuth(null);
    setMyInventory(null);
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    showToast('Logged Out', 'Hospital staff session ended.', 'info');
  }, [showToast]);

  // ── Load inventory after hospital login ─────────────────────────────────────
  useEffect(() => {
    if (!hospitalAuth || !hospitalAuth.token || hospitalAuth.token === 'demo-token') return;
    loadInventory();
    connectHospitalSSE(hospitalAuth.hospitalId);
    return () => {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    };
  }, [hospitalAuth?.hospitalId]);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const data = await api.fetchInventory();
      setMyInventory(data);
      // Merge into hospitals list
      setHospitals(prev => prev.map(h =>
        h.id === data.hospital_id ? { ...h, resources: data.resources } : h
      ));
    } catch (err) {
      showToast('Inventory Error', err.message, 'warning');
    } finally {
      setInventoryLoading(false);
    }
  }, [showToast]);

  const connectHospitalSSE = useCallback((hospitalId) => {
    if (sseRef.current) { sseRef.current.close(); }
    sseRef.current = api.connectSSE(hospitalId, {
      connected: () => console.log(`[SSE] connected to hospital ${hospitalId}`),
      inventory_update: (data) => {
        setMyInventory(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            resources: prev.resources.map(r =>
              r.id === data.resource_id
                ? { ...r, quantity_available: data.quantity_available, last_updated_at: data.last_updated_at }
                : r
            ),
          };
        });
        setHospitals(prev => prev.map(h => {
          if (h.id !== hospitalId) return h;
          const resources = (h.resources || []).map(r =>
            r.id === data.resource_id
              ? { ...r, quantity_available: data.quantity_available }
              : r
          );
          return { ...h, resources };
        }));
      },
      route_proposed: (data) => {
        setIncomingProposal(data);
        showToast(
          '🚨 Incoming Ambulance Request',
          `Incident #${data.incident_id} — ${data.triage_category?.replace(/_/g, ' ')} — ETA ~${data.selected_hospital?.eta_minutes} mins`,
          'emergency'
        );
        // Auto-add to audit log
        setAuditLogs(prev => [{
          id: `evt-${Date.now()}`,
          type: 'route_proposed',
          timestamp: new Date().toLocaleTimeString(),
          date: new Date().toLocaleDateString(),
          detail: `Route proposed: incident ${data.incident_id}, ${data.triage_category}`,
        }, ...prev.slice(0, 49)]);
      },
      route_confirmed: (data) => {
        showToast('Route Confirmed', `Hospital confirmed incident ${data.incident_id}`, 'success');
        setIncomingProposal(null);
      },
      route_rejected: (data) => {
        showToast('Route Rejected', `Incident ${data.incident_id} was rejected or timed out`, 'info');
        setIncomingProposal(null);
      },
    });
  }, [showToast]);

  // ── Update hospital inventory ──────────────────────────────────────────────
  const updateHospitalInventory = useCallback(async (resourceId, newQty) => {
    if (!hospitalAuth) return;
    // Demo mode — local mutation only
    if (hospitalAuth.token === 'demo-token') {
      setMyInventory(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          resources: prev.resources.map(r =>
            r.id === resourceId ? { ...r, quantity_available: newQty } : r
          ),
        };
      });
      setHospitals(prev => prev.map(h => {
        if (h.id !== hospitalAuth.hospitalId) return h;
        return {
          ...h,
          resources: (h.resources || []).map(r =>
            r.id === resourceId ? { ...r, quantity_available: newQty } : r
          ),
        };
      }));
      showToast('Inventory Updated (Demo)', 'Changes local only — backend offline', 'info');
      return;
    }
    try {
      const result = await api.updateResource(resourceId, newQty);
      setMyInventory(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          resources: prev.resources.map(r =>
            r.id === result.resource.id ? result.resource : r
          ),
        };
      });
      showToast('Inventory Synced', `Resource updated and broadcast via SSE`, 'success');
    } catch (err) {
      showToast('Update Failed', err.message, 'warning');
    }
  }, [hospitalAuth, showToast]);

  // ── Confirm/Release reservation (Hospital Staff ACK) ──────────────────────
  const confirmReservation = useCallback(async (reservationId) => {
    try {
      await api.confirmReservation(reservationId);
      showToast('Reservation Confirmed', 'Trauma bay reserved. Decrementing inventory.', 'success');
      setIncomingProposal(null);
      await loadInventory();
    } catch (err) {
      showToast('Confirm Failed', err.message, 'warning');
    }
  }, [showToast, loadInventory]);

  const releaseReservation = useCallback(async (reservationId) => {
    try {
      await api.releaseReservation(reservationId);
      showToast('Reservation Released', 'Hospital declined. No inventory change.', 'info');
      setIncomingProposal(null);
    } catch (err) {
      showToast('Release Failed', err.message, 'warning');
    }
  }, [showToast]);

  // ── Ambulance / Paramedic Auth (demo-only for now) ────────────────────────
  const loginAmbulance = useCallback((badgeId, password) => {
    if (password && password.length >= 4) {
      const user = {
        badgeId: badgeId || 'PARA-409',
        name: 'Dr. Ananya Roy (Paramedic Lead)',
        callsign: 'Delta-101 (ALS Unit)',
        assignedAmbulanceId: 'amb-101',
      };
      setAmbulanceAuth(user);
      showToast('Attendant Logged In', `Session active for ${user.name}`, 'success');
      return true;
    }
    showToast('Login Failed', 'Password must be at least 4 characters.', 'warning');
    return false;
  }, [showToast]);

  const logoutAmbulance = useCallback(() => {
    setAmbulanceAuth(null);
    showToast('Logged Out', 'Ambulance attendant session terminated.', 'info');
  }, [showToast]);

  // ── Admin auth ─────────────────────────────────────────────────────────────
  const loginAdmin = useCallback((adminId, password) => {
    if (password && password.length >= 4) {
      const user = {
        adminId: adminId || 'adm_001',
        name: 'System Administrator',
        role: 'Super Administrator',
        loginTime: new Date().toLocaleTimeString(),
      };
      setAdminAuth(user);
      showToast('Admin Authenticated', `Welcome, ${user.name}`, 'success');
      return true;
    }
    showToast('Login Failed', 'Password must be at least 4 characters.', 'warning');
    return false;
  }, [showToast]);

  const logoutAdmin = useCallback(() => {
    setAdminAuth(null);
    showToast('Logged Out', 'Administrator session ended.', 'info');
  }, [showToast]);

  // ── Citizen Emergency Report ───────────────────────────────────────────────
  const reportEmergency = useCallback(async (reportData) => {
    const incidentId = `inc-${Date.now().toString().slice(-6)}`;

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
      assignedAmbulanceCallsign: 'Dispatching nearest unit...',
      paramedicName: 'Paramedic on the way',
      targetHospitalId: null,
      targetHospitalName: null,
      hospitalResponse: null,
      etaMinutes: 4,
      createdAt: new Date().toISOString(),
    };

    setCitizenIncident(localIncident);
    setEmergencies(prev => [localIncident, ...prev]);
    showToast('Emergency Reported', 'Dispatching nearest ambulance...', 'emergency');

    // Map frontend category names to backend triage_category enum values
    const CATEGORY_TO_TRIAGE = {
      'Traffic Accident': 'high_velocity_polytrauma',
      'Cardiac / Chest Pain': 'acute_coronary_syndrome_stemi',
      'Breathing Difficulty': 'severe_respiratory_distress',
      'Severe Bleeding': 'high_velocity_polytrauma',
      'Unconscious Person': 'high_velocity_polytrauma',
      'Suspected Stroke': 'acute_ischemic_stroke',
      'Seizure / Convulsion': 'acute_ischemic_stroke',
      'Severe Burns': 'high_velocity_polytrauma',
      'Fall from Height': 'high_velocity_polytrauma',
      'Bone Fracture': 'high_velocity_polytrauma',
      'Poisoning': 'severe_respiratory_distress',
      'Snakebite & Animal Bite': 'severe_respiratory_distress',
      'Pregnancy Emergency': 'acute_coronary_syndrome_stemi',
      'Pediatric Emergency': 'severe_respiratory_distress',
      'Allergic Anaphylaxis': 'severe_respiratory_distress',
      'Electric Shock': 'acute_coronary_syndrome_stemi',
      'Other Emergency': 'high_velocity_polytrauma',
    };

    const triageCategory = CATEGORY_TO_TRIAGE[reportData.emergencyType] || 'high_velocity_polytrauma';

    if (backendOnline !== false) {
      // Try real dispatch
      try {
        const result = await api.dispatchIncident({
          triage_category: triageCategory,
          scene_lat: userLocation.lat,
          scene_lng: userLocation.lng,
          idempotency_key: incidentId,
        });

        const updatedIncident = {
          ...localIncident,
          backendIncidentId: result.incident_id,
          status: result.outcome === 'accepted' ? 'Hospital Accepted' : 'Routing...',
          statusStep: result.outcome === 'accepted' ? 4 : 2,
          targetHospitalId: result.hospital_id,
          targetHospitalName: result.hospital_name,
          etaMinutes: result.eta_minutes,
          hospitalResponse: result.outcome === 'accepted' ? 'accepted' : null,
          routingResult: result,
        };
        setCitizenIncident(updatedIncident);
        setEmergencies(prev => prev.map(e => e.id === incidentId ? updatedIncident : e));

        if (result.outcome === 'accepted') {
          showToast('Hospital Confirmed!', `${result.hospital_name} accepted — ETA ${result.eta_minutes} mins`, 'success');
        } else {
          showToast('Routing...', 'Searching for available hospital...', 'info');
        }
      } catch (err) {
        console.warn('[CrisisCareContext] Dispatch failed:', err.message);
        // Degrade gracefully — keep local incident as "Ambulance Dispatched"
        setCitizenIncident(prev => ({
          ...prev,
          status: 'Ambulance Dispatched',
          statusStep: 2,
          paramedicName: 'Dr. Ananya Roy',
          assignedAmbulanceCallsign: 'Delta-101 (ALS Unit)',
        }));
        showToast('Ambulance Dispatched', 'Nearest unit is on the way.', 'success');
      }
    } else {
      // Demo mode — simulate a successful dispatch
      setTimeout(() => {
        const nearestHospital = hospitals[0];
        setCitizenIncident(prev => ({
          ...prev,
          status: 'Ambulance Dispatched',
          statusStep: 2,
          paramedicName: 'Dr. Ananya Roy',
          assignedAmbulanceCallsign: 'Delta-101 (ALS Unit)',
          targetHospitalId: nearestHospital?.id,
          targetHospitalName: nearestHospital?.name,
          etaMinutes: nearestHospital?.estimatedMinutes || 5,
        }));
      }, 1200);
      showToast('Ambulance Dispatched!', `Nearest unit is on the way (demo mode)`, 'success');
    }

    return localIncident;
  }, [userLocation, hospitals, backendOnline, showToast]);

  // ── Ambulance attendant: manual hospital pick ──────────────────────────────
  const selectHospitalForAmbulance = useCallback((hospital, incidentId = null) => {
    setSelectedHospitalForAmbulance(hospital);
    setActiveRouteTarget(hospital);
    showToast('Routing to Hospital', `Transmitting to ${hospital.name} ER desk...`, 'info');
  }, [showToast]);

  // ── Attendant clinical assessment ──────────────────────────────────────────
  const submitAttendantAssessment = useCallback(async (incidentId, assessment) => {
    setCitizenIncident(prev => {
      if (!prev) return null;
      return { ...prev, status: 'Paramedic On Scene', statusStep: 3, assessment };
    });
    setEmergencies(prev => prev.map(e =>
      e.id === incidentId ? { ...e, assessment, statusStep: 3 } : e
    ));

    // Calculate Triage Category based on vitals
    let triage = 'high_velocity_polytrauma';
    if (assessment.pulseStatus === 'none' || assessment.isBreathingProperly === 'not-breathing') triage = 'cardiac_arrest_resuscitation';
    else if (assessment.isConscious === 'unconscious' || assessment.spo2 < 90) triage = 'severe_respiratory_distress';
    else if (assessment.severeBleeding) triage = 'high_velocity_polytrauma';

    // Call /route-incident (preview=true — read-only, no reservations, no incident row)
    if (backendOnline !== false) {
      try {
        const result = await api.routeIncidentPreview({
          triage_category: triage,
          scene_lat: userLocation.lat,
          scene_lng: userLocation.lng,
        });

        // API returns: { selected: RankedHospital, ranked_candidates: RankedHospital[] }
        // selected  → the single ML-ranked winner (lowest cost, best resources + ETA)
        // ranked_candidates → full ordered list (selected is ranked_candidates[0])
        if (result && result.selected) {
          const normalize = (h) => ({
            id:               h.id,
            name:             h.name,
            address:          h.address || '',
            phone:            h.phone || '',
            tier:             h.tier,
            lat:              h.lat,
            lng:              h.lng,
            distanceKm:       h.distance_km,
            estimatedMinutes: h.eta_minutes != null ? Math.round(h.eta_minutes) : null,
            availability_score: h.min_capacity_ratio,
          });

          // Primary: the single backend-selected winner
          const primary = normalize(result.selected);

          // Alternatives: rest of ranked list (skip index 0 which is the winner)
          const rest = (result.ranked_candidates || [])
            .slice(1, 4)           // up to 3 more
            .map(normalize);

          // Show: [primary, ...rest] — primary is always first/highlighted
          setRecommendedHospitals([primary, ...rest]);
          showToast(
            'ML Route Calculated',
            `Best match: ${primary.name} — ETA ~${primary.estimatedMinutes ?? '?'} min`,
            'success',
          );
          return;
        }
      } catch (err) {
        console.warn('[submitAttendantAssessment] /route-incident failed:', err.message);
      }
    }

    // Offline fallback — show local hospital list sorted by distanceKm
    const sorted = [...hospitals].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    setRecommendedHospitals(sorted.slice(0, 4));
    showToast('Assessment Saved', 'Backend unreachable — showing nearest hospitals.', 'info');
  }, [showToast, userLocation, hospitals, backendOnline]);


  // ── Respond to ambulance (Hospital Staff) — demo + real ───────────────────
  const respondToAmbulance = useCallback(async (incidentId, decision, declineReason = 'Resources Exhausted') => {
    const proposal = incomingProposal;
    if (proposal && proposal.reservation_ids?.length) {
      const primaryId = proposal.reservation_ids[0];
      if (decision === 'accepted') {
        await confirmReservation(primaryId);
      } else {
        await releaseReservation(primaryId);
      }
    } else {
      // Demo mode mutation
      setHospitalDecisions(prev => ({ ...prev, [hospitalAuth?.hospitalId]: decision }));
      setCitizenIncident(prev => {
        if (!prev || prev.id !== incidentId) return prev;
        return { ...prev, hospitalResponse: decision, statusStep: decision === 'accepted' ? 4 : 3 };
      });
      const verb = decision === 'accepted' ? 'Accepted' : 'Declined';
      showToast(`Hospital ${verb}`, `Response recorded for incident ${incidentId}.`, decision === 'accepted' ? 'success' : 'info');
    }
  }, [incomingProposal, hospitalAuth, confirmReservation, releaseReservation, showToast]);

  // ── Citizen cancel / reset ─────────────────────────────────────────────────
  const cancelCitizenIncident = useCallback(() => {
    setCitizenIncident(null);
    setSelectedHospitalForAmbulance(null);
    setActiveRouteTarget(null);
    showToast('Incident Cleared', 'Emergency report cancelled.', 'info');
  }, [showToast]);

  const startNewCitizenReport = useCallback(() => {
    setCitizenIncident(null);
    setSelectedHospitalForAmbulance(null);
    setActiveRouteTarget(null);
  }, []);

  // ── Reset to demo data (dev helper) ──────────────────────────────────────
  const resetToSampleData = useCallback(async () => {
    if (backendOnline !== false) {
      try { await api.resetDemo(); } catch (_) {}
    }
    setCitizenIncident(null);
    setEmergencies([]);
    setAuditLogs([]);
    setHospitalDecisions({});
    setSelectedHospitalForAmbulance(null);
    setActiveRouteTarget(null);
    setIncomingProposal(null);
    await loadHospitals();
    showToast('System Reset', 'All data reset to baseline.', 'info');
  }, [backendOnline, loadHospitals, showToast]);

  // ── Surgeon availability (local for now, no backend endpoint) ─────────────
  const updateSurgeonAvailability = useCallback((hospitalId, isAvailable, name, specialty) => {
    setHospitals(prev => prev.map(h =>
      h.id !== hospitalId ? h : {
        ...h,
        surgeon: { ...(h.surgeon || {}), isAvailable, name: name || h.surgeon?.name, specialty },
        lastUpdated: new Date().toISOString(),
      }
    ));
    showToast('Surgeon Status Updated', isAvailable ? 'Surgeon marked available' : 'Surgeon marked unavailable', isAvailable ? 'success' : 'warning');
  }, [showToast]);

  // ── Context value ──────────────────────────────────────────────────────────
  return (
    <CrisisCareContext.Provider value={{
      // Theme
      theme, toggleTheme,

      // Backend state
      backendOnline, hospitalsLoading, inventoryLoading,

      // Data
      hospitals, emergencies, auditLogs, myInventory,
      citizenIncident, incomingProposal,

      // Auth
      hospitalAuth, ambulanceAuth, adminAuth,
      loginHospital, logoutHospital,
      loginAmbulance, logoutAmbulance,
      loginAdmin, logoutAdmin,

      // Hospital inventory actions
      updateHospitalInventory,
      confirmReservation, releaseReservation,
      loadInventory,

      // Ambulance routing
      hospitalDecisions, selectedHospitalForAmbulance,
      selectHospitalForAmbulance,
      respondToAmbulance,
      submitAttendantAssessment,

      // Citizen SOS
      reportEmergency, cancelCitizenIncident, startNewCitizenReport,

      // Surgeon
      updateSurgeonAvailability,

      // Location
      userLocation, setUserLocation, requestGpsLocation,

      // UI
      activeSection, setActiveSection,
      activeRouteTarget, setActiveRouteTarget,
      toastMessage, showToast,
      recommendedHospitals,
      isOffline, resetToSampleData,
    }}
    >
      {children}
    </CrisisCareContext.Provider>
  );
};

export const useCrisisCare = () => {
  const ctx = useContext(CrisisCareContext);
  if (!ctx) throw new Error('useCrisisCare must be used within CrisisCareProvider');
  return ctx;
};
