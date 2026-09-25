import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_HOSPITALS, INITIAL_AMBULANCES, INITIAL_EMERGENCIES, INITIAL_AUDIT_LOGS } from '../data/mockData';

const CrisisCareContext = createContext();

export const CrisisCareProvider = ({ children }) => {
  // Theme state: default 'red' as requested by user, with toggle support
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('cc_theme') || 'red';
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'red' ? 'teal' : 'red';
      localStorage.setItem('cc_theme', next);
      return next;
    });
  };

  const [hospitals, setHospitals] = useState(INITIAL_HOSPITALS);
  const [ambulances, setAmbulances] = useState(INITIAL_AMBULANCES);
  const [emergencies, setEmergencies] = useState(INITIAL_EMERGENCIES);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [citizenIncident, setCitizenIncident] = useState(null);
  const [ambulanceAuth, setAmbulanceAuth] = useState(null);
  const [hospitalAuth, setHospitalAuth] = useState(null);
  const [adminAuth, setAdminAuth] = useState(null);
  const [hospitalDecisions, setHospitalDecisions] = useState({});
  const [selectedHospitalForAmbulance, setSelectedHospitalForAmbulance] = useState(null);

  // Clear stale session cache on fresh page load so refreshing the link resets everything
  useEffect(() => {
    localStorage.removeItem('cc_citizen_incident_v4');
    localStorage.removeItem('cc_hospital_decisions_v4');
    localStorage.removeItem('cc_amb_auth_v4');
    localStorage.removeItem('cc_hosp_auth_v4');
    localStorage.removeItem('cc_admin_auth_v4');
    localStorage.removeItem('cc_hospitals_v4');
    localStorage.removeItem('cc_ambulances_v4');
    localStorage.removeItem('cc_emergencies_v4');
    localStorage.removeItem('cc_audit_logs_v4');
  }, []);

  const [userLocation, setUserLocation] = useState({
    lat: 19.0665,
    lng: 72.8700,
    address: 'BKC Bandra East, Mumbai',
    isGpsActive: false,
    accuracyMeters: 15
  });

  const [activeSection, setActiveSection] = useState('overview');
  const [activeRouteTarget, setActiveRouteTarget] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('cc_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('cc_hospitals_v4', JSON.stringify(hospitals));
  }, [hospitals]);

  useEffect(() => {
    localStorage.setItem('cc_ambulances_v4', JSON.stringify(ambulances));
  }, [ambulances]);

  useEffect(() => {
    localStorage.setItem('cc_emergencies_v4', JSON.stringify(emergencies));
  }, [emergencies]);

  useEffect(() => {
    localStorage.setItem('cc_audit_logs_v4', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('cc_hospital_decisions_v4', JSON.stringify(hospitalDecisions));
  }, [hospitalDecisions]);

  useEffect(() => {
    if (citizenIncident) {
      localStorage.setItem('cc_citizen_incident_v4', JSON.stringify(citizenIncident));
    } else {
      localStorage.removeItem('cc_citizen_incident_v4');
    }
  }, [citizenIncident]);

  useEffect(() => {
    if (ambulanceAuth) {
      localStorage.setItem('cc_amb_auth_v4', JSON.stringify(ambulanceAuth));
    } else {
      localStorage.removeItem('cc_amb_auth_v4');
    }
  }, [ambulanceAuth]);

  useEffect(() => {
    if (hospitalAuth) {
      localStorage.setItem('cc_hosp_auth_v4', JSON.stringify(hospitalAuth));
    } else {
      localStorage.removeItem('cc_hosp_auth_v4');
    }
  }, [hospitalAuth]);

  // Real-time synchronization across multiple browser tabs
  useEffect(() => {
    const handleStorageEvent = (e) => {
      if (e.key === 'cc_citizen_incident_v4') {
        setCitizenIncident(e.newValue ? JSON.parse(e.newValue) : null);
      }
      if (e.key === 'cc_emergencies_v4' && e.newValue) {
        setEmergencies(JSON.parse(e.newValue));
      }
      if (e.key === 'cc_hospitals_v4' && e.newValue) {
        setHospitals(JSON.parse(e.newValue));
      }
      if (e.key === 'cc_hospital_decisions_v4' && e.newValue) {
        setHospitalDecisions(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, []);

  const showToast = (title, message, type = 'info') => {
    setToastMessage({ title, message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Ambulance login
  const loginAmbulance = (badgeId, password) => {
    if (password && password.length >= 4) {
      const user = {
        badgeId: badgeId || 'PARA-409',
        name: 'Dr. Ananya Roy (Paramedic Lead)',
        callsign: 'Delta-101 (ALS Unit)',
        assignedAmbulanceId: 'amb-101'
      };
      setAmbulanceAuth(user);
      showToast('Attendant Logged In', `Session active for ${user.name}`, 'success');
      return true;
    }
    showToast('Login Failed', 'Password must be at least 4 characters.', 'warning');
    return false;
  };

  const logoutAmbulance = () => {
    setAmbulanceAuth(null);
    showToast('Logged Out', 'Ambulance attendant session terminated.', 'info');
  };

  // Hospital login
  const loginHospital = (hospitalId, email, password) => {
    const targetHosp = hospitals.find((h) => h.id === hospitalId) || hospitals[0];
    if (password && password.length >= 4) {
      const staffUser = {
        hospitalId: targetHosp.id,
        hospitalName: targetHosp.name,
        staffName: 'Dr. Shivam Mishra (ER Chief)',
        email: email || 'er.chief@crisiscare.org',
        role: 'Trauma Operations Lead'
      };
      setHospitalAuth(staffUser);
      showToast('Hospital Authenticated', `Logged into ${targetHosp.name} Emergency Desk`, 'success');
      return true;
    }
    showToast('Authentication Error', 'Invalid credentials (min 4 characters).', 'warning');
    return false;
  };

  const logoutHospital = () => {
    setHospitalAuth(null);
    showToast('Logged Out', 'Hospital administrator session ended.', 'info');
  };

  // Super Admin login
  const loginAdmin = (adminId, password) => {
    if (password && password.length >= 4) {
      const user = {
        adminId: adminId || 'adm_shivam_027',
        name: 'Shivam Mishra',
        title: 'Lead System Architect & National Dispatch Director',
        email: 'shivam.mishra@crisiscare.gov',
        role: 'Super Administrator',
        clearanceLevel: 'Level 5 (Cryptographic Audit & National Dispatch Authority)',
        loginTime: new Date().toLocaleTimeString(),
        token: 'JWT_SECURE_AUTH_' + Math.random().toString(36).substring(2, 10).toUpperCase()
      };
      setAdminAuth(user);
      showToast('Admin Authenticated', `Welcome, ${user.name} (${user.role})`, 'success');
      return true;
    }
    showToast('Admin Login Failed', 'Password must be at least 4 characters.', 'warning');
    return false;
  };

  const logoutAdmin = () => {
    setAdminAuth(null);
    localStorage.removeItem('cc_admin_auth_v4');
    showToast('Logged Out', 'Super Administrator session ended safely.', 'info');
  };

  // Toggle on-duty surgeon
  const updateSurgeonAvailability = (hospitalId, isAvailable, name, specialty) => {
    setHospitals((prev) =>
      prev.map((h) => {
        if (h.id !== hospitalId) return h;
        const currentSurgeon = h.surgeon || {};
        return {
          ...h,
          surgeon: {
            ...currentSurgeon,
            isAvailable,
            name: name || currentSurgeon.name,
            specialty: specialty || currentSurgeon.specialty
          },
          lastUpdated: new Date().toISOString()
        };
      })
    );

    showToast(
      'Surgeon Status Updated',
      `On-Duty Trauma Surgeon: ${isAvailable ? (name || 'Available') : 'Unavailable / In Surgery'}`,
      isAvailable ? 'success' : 'warning'
    );
  };

  // Ambulance attendant clicks on a hospital name to start tracking and query that hospital
  const selectHospitalForAmbulance = (hospital, specificIncidentId = null) => {
    setSelectedHospitalForAmbulance(hospital);
    setActiveRouteTarget(hospital);

    const targetId = specificIncidentId || (citizenIncident ? citizenIncident.id : 'inc-901');

    // Update only the specific emergency
    setEmergencies((prev) =>
      prev.map((e) =>
        e.id === targetId
          ? {
              ...e,
              targetHospitalId: hospital.id,
              targetHospitalName: hospital.name,
              destinationHospital: hospital,
              etaToHospital: hospital.estimatedMinutes || 6,
              hospitalResponse: hospitalDecisions[hospital.id] || 'pending'
            }
          : e
      )
    );

    // Update citizenIncident only if it matches
    setCitizenIncident((prev) => {
      if (!prev || prev.id !== targetId) return prev;
      return {
        ...prev,
        targetHospitalId: hospital.id,
        targetHospitalName: hospital.name,
        destinationHospital: hospital,
        etaToHospital: hospital.estimatedMinutes || 6,
        hospitalResponse: hospitalDecisions[hospital.id] || 'pending'
      };
    });

    showToast(
      'Tracking Started',
      `Routing ambulance to ${hospital.name} (~${hospital.estimatedMinutes} mins). Transmitting patient details to their ER desk.`,
      'info'
    );
  };

  // Hospital responds (ACCEPT or DECLINE)
  const respondToAmbulance = (incidentId, decision, declineReason = 'Resources Exhausted') => {
    const currentHosp = hospitals.find((h) => h.id === (hospitalAuth?.hospitalId || 'hosp-001')) || hospitals[0];

    // Record decision for this hospital
    setHospitalDecisions((prev) => ({
      ...prev,
      [currentHosp.id]: decision === 'accepted' ? 'accepted' : 'declined'
    }));

    if (decision === 'accepted') {
      setEmergencies((prev) =>
        prev.map((e) =>
          e.id === incidentId
            ? { 
                ...e, 
                hospitalResponse: 'accepted', 
                status: 'Accepted by Hospital Trauma Bay',
                statusStep: 4,
                declineReason: null,
                targetHospitalId: currentHosp.id,
                targetHospitalName: currentHosp.name
              }
            : e
        )
      );

      setCitizenIncident((prev) => {
        if (!prev || prev.id !== incidentId) return prev;
        return {
          ...prev,
          hospitalResponse: 'accepted',
          statusStep: 4,
          status: 'Accepted by Hospital Trauma Bay',
          destinationHospital: currentHosp,
          targetHospitalId: currentHosp.id,
          targetHospitalName: currentHosp.name,
          etaToHospital: currentHosp.estimatedMinutes || 5
        };
      });

      // Deduct 1 bed
      setHospitals((prev) =>
        prev.map((h) =>
          h.id === currentHosp.id
            ? {
                ...h,
                inventory: {
                  ...h.inventory,
                  icuBeds: Math.max(0, (h.inventory.icuBeds || 1) - 1)
                }
              }
            : h
        )
      );

      showToast(
        'Emergency Accepted!',
        `Trauma Bay 1 reserved at ${currentHosp.name}. Staff alerted.`,
        'success'
      );
    } else {
      // DECLINED: Resources not available for THIS incident only
      setEmergencies((prev) =>
        prev.map((e) =>
          e.id === incidentId
            ? {
                ...e,
                hospitalResponse: 'declined',
                declineReason,
                status: `Declined by ${currentHosp.name} (Resources Not Available)`
              }
            : e
        )
      );

      setCitizenIncident((prev) => {
        if (!prev || prev.id !== incidentId) return prev;
        return {
          ...prev,
          hospitalResponse: 'declined',
          declineReason,
          status: `Declined by ${currentHosp.name} (Resources Not Available)`
        };
      });

      showToast(
        'Hospital Declined',
        `${currentHosp.name} declined: Resources not available (${declineReason}). Please select another hospital in Ambulance Portal.`,
        'emergency'
      );
    }
  };

  // Update Inventory
  const updateHospitalInventory = (hospitalId, resourceType, subKey, newValue, reason = 'Inventory Adjust') => {
    let numericVal = typeof newValue === 'boolean' ? newValue : Math.max(0, parseInt(newValue, 10) || 0);
    let oldVal = 0;
    let hospName = '';

    setHospitals((prev) =>
      prev.map((h) => {
        if (h.id !== hospitalId) return h;
        hospName = h.name;
        const newInv = { ...h.inventory };
        if (subKey && newInv.bloodUnits) {
          oldVal = newInv.bloodUnits[subKey] || 0;
          newInv.bloodUnits = { ...newInv.bloodUnits, [subKey]: numericVal };
        } else {
          oldVal = newInv[resourceType];
          newInv[resourceType] = numericVal;
        }

        return {
          ...h,
          inventory: newInv,
          lastUpdated: new Date().toISOString()
        };
      })
    );

    const newLog = {
      id: `log-${Date.now().toString().slice(-4)}`,
      adminId: hospitalAuth ? hospitalAuth.staffName : 'Shivam Mishra',
      adminName: hospitalAuth ? hospitalAuth.staffName : 'Shivam Mishra',
      hospitalId,
      hospitalName: hospName || 'Selected Hospital',
      resourceType: subKey ? `Blood ${subKey}` : resourceType,
      previousQty: oldVal ?? 0,
      newQty: numericVal,
      action: reason,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date().toLocaleDateString()
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    showToast('Inventory Updated', `Sync applied for ${newLog.resourceType}`, 'success');
  };

  // Citizen SOS report: Simple, NO clinical questions!
  const reportEmergency = (reportData) => {
    const newId = `inc-${Math.floor(100 + Math.random() * 900)}`;
    const availableAmb = ambulances.find((a) => a.status === 'Available') || ambulances[0];

    const newIncident = {
      id: newId,
      patientDetails: reportData.patientDetails || 'Emergency reported by citizen',
      patientCategory: reportData.emergencyType,
      type: reportData.emergencyType,
      patientCount: reportData.patientCount || 1,
      locationName: reportData.locationName || userLocation.address,
      lat: userLocation.lat,
      lng: userLocation.lng,
      status: 'Ambulance Dispatched',
      statusStep: 2,
      assignedAmbulanceId: availableAmb ? availableAmb.id : 'amb-101',
      assignedAmbulanceCallsign: availableAmb ? availableAmb.callsign : 'Delta-101 (ALS Unit)',
      paramedicName: availableAmb ? availableAmb.paramedicName : 'Dr. Ananya Roy',
      targetHospitalId: null,
      targetHospitalName: null,
      hospitalResponse: null,
      declineReason: null,
      etaMinutes: 4,
      assessment: null,
      destinationHospital: null,
      createdAt: new Date().toISOString()
    };

    setCitizenIncident(newIncident);
    setEmergencies((prev) => [newIncident, ...prev]);

    if (availableAmb) {
      setAmbulances((prev) =>
        prev.map((a) =>
          a.id === availableAmb.id
            ? {
                ...a,
                status: 'Dispatched to Scene',
                assignedIncidentId: newId,
                etaMinutes: 4
              }
            : a
        )
      );
    }

    showToast('Emergency Dispatched!', `Ambulance dispatched to ${newIncident.locationName}.`, 'emergency');
    return newIncident;
  };

  // Paramedic clinical check submission (Attendant only)
  const submitAttendantAssessment = (incidentId, assessment) => {
    setCitizenIncident((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'Attended by Paramedic',
        statusStep: 3,
        assessment
      };
    });

    setEmergencies((prev) =>
      prev.map((e) =>
        e.id === incidentId || (citizenIncident && e.id === citizenIncident.id)
          ? {
              ...e,
              assessment,
              statusStep: 3
            }
          : e
      )
    );

    showToast('Clinical Check Recorded', 'Assessment saved. Now select a nearest hospital below to route and query resources.', 'info');
  };

  const startNewCitizenReport = () => {
    localStorage.removeItem('cc_citizen_incident_v4');
    setCitizenIncident(null);
    setSelectedHospitalForAmbulance(null);
    setActiveRouteTarget(null);
    showToast('Report Emergency', 'Form ready. Please answer the emergency details below.', 'info');
  };

  const cancelCitizenIncident = () => {
    localStorage.removeItem('cc_citizen_incident_v4');
    setCitizenIncident(null);
    setSelectedHospitalForAmbulance(null);
    setActiveRouteTarget(null);
    showToast('Emergency Reset', 'Citizen report cleared.', 'info');
  };

  const resetToSampleData = () => {
    localStorage.clear();
    setHospitals(INITIAL_HOSPITALS);
    setAmbulances(INITIAL_AMBULANCES);
    setEmergencies(INITIAL_EMERGENCIES);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setHospitalDecisions({});
    setCitizenIncident(null);
    setAmbulanceAuth(null);
    setHospitalAuth(null);
    setAdminAuth(null);
    setSelectedHospitalForAmbulance(null);
    setActiveRouteTarget(null);
    showToast('System Reset', 'All data reset to baseline.', 'info');
  };

  return (
    <CrisisCareContext.Provider
      value={{
        theme,
        toggleTheme,
        hospitals,
        ambulances,
        emergencies,
        auditLogs,
        citizenIncident,
        ambulanceAuth,
        hospitalAuth,
        adminAuth,
        hospitalDecisions,
        selectedHospitalForAmbulance,
        selectHospitalForAmbulance,
        loginAmbulance,
        logoutAmbulance,
        loginHospital,
        logoutHospital,
        loginAdmin,
        logoutAdmin,
        updateSurgeonAvailability,
        respondToAmbulance,
        submitAttendantAssessment,
        cancelCitizenIncident,
        startNewCitizenReport,
        userLocation,
        setUserLocation,
        activeSection,
        setActiveSection,
        activeRouteTarget,
        setActiveRouteTarget,
        updateHospitalInventory,
        reportEmergency,
        toastMessage,
        showToast,
        isOffline,
        setIsOffline,
        resetToSampleData
      }}
    >
      {children}
    </CrisisCareContext.Provider>
  );
};

export const useCrisisCare = () => {
  const context = useContext(CrisisCareContext);
  if (!context) {
    throw new Error('useCrisisCare must be used within a CrisisCareProvider');
  }
  return context;
};
