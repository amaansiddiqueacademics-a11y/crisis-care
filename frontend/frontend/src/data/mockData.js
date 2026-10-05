// Mock data updated with expanded emergency resources and On-Duty Trauma Surgeon details

export const INITIAL_HOSPITALS = [
  {
    id: "hosp-001",
    name: "Apex Central Trauma Center",
    tagline: "Level 1 Comprehensive Trauma & Neuro Resuscitation",
    address: "Plot 42, Healthcare Corridor, Sector 12",
    lat: 19.0760,
    lng: 72.8777,
    phone: "+91 22 2456 7890",
    distanceKm: 2.4,
    estimatedMinutes: 6,
    isVerified: true,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    traumaLevel: "Level 1 Trauma Center",
    staffOnDuty: 34,
    surgeon: {
      isAvailable: true,
      name: "Dr. Rajeshwar Sharma, MS, MCh",
      specialty: "Chief Trauma & Vascular Surgeon",
      contact: "+91 98200 44111",
      dutyShift: "24x7 Emergency Call"
    },
    inventory: {
      icuBeds: 8,
      ventilators: 5,
      oxygenCylinders: 42,
      emergencyOT: 2,
      ctScanReady: true,
      cardiacDefibrillators: 6,
      burnUnitAvailable: true,
      bloodUnits: {
        "O-": 4,
        "O+": 18,
        "A+": 12,
        "B+": 9,
        "AB+": 6
      }
    }
  },
  {
    id: "hosp-002",
    name: "LifeLine Super Specialty Hospital",
    tagline: "Comprehensive Multi-Specialty & Cardiac Emergency",
    address: "88 Metro Boulevard, North Wing",
    lat: 19.0882,
    lng: 72.8850,
    distanceKm: 4.1,
    estimatedMinutes: 11,
    isVerified: true,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    traumaLevel: "Level 2 Trauma Center",
    staffOnDuty: 28,
    surgeon: {
      isAvailable: true,
      name: "Dr. Priya Kulkarni, MS",
      specialty: "Senior Emergency & General Surgeon",
      contact: "+91 98200 77222",
      dutyShift: "Evening Resuscitation Shift"
    },
    inventory: {
      icuBeds: 3,
      ventilators: 2,
      oxygenCylinders: 26,
      emergencyOT: 1,
      ctScanReady: true,
      cardiacDefibrillators: 4,
      burnUnitAvailable: false,
      bloodUnits: {
        "O-": 1,
        "O+": 10,
        "A+": 7,
        "B+": 5,
        "AB+": 3
      }
    }
  },
  {
    id: "hosp-003",
    name: "Metro Emergency Hospital & Research",
    tagline: "Pediatric & Critical Care Response Center",
    address: "15 Bypass Link Road, Civil Lines",
    lat: 19.0620,
    lng: 72.8620,
    distanceKm: 6.8,
    estimatedMinutes: 17,
    isVerified: true,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    traumaLevel: "Level 1 Pediatric & Adult",
    staffOnDuty: 45,
    surgeon: {
      isAvailable: true,
      name: "Dr. Farhan Qureshi, MCh",
      specialty: "Critical Care & Trauma Specialist",
      contact: "+91 98200 88333",
      dutyShift: "Night Resuscitation Shift"
    },
    inventory: {
      icuBeds: 12,
      ventilators: 8,
      oxygenCylinders: 55,
      emergencyOT: 3,
      ctScanReady: true,
      cardiacDefibrillators: 8,
      burnUnitAvailable: true,
      bloodUnits: {
        "O-": 6,
        "O+": 24,
        "A+": 15,
        "B+": 11,
        "AB+": 8
      }
    }
  },
  {
    id: "hosp-004",
    name: "St. Jude Community Health Center",
    tagline: "Primary Urgent Care & Stabilization Clinic",
    address: "102 Station Road, Old Quarter",
    lat: 19.0950,
    lng: 72.8550,
    distanceKm: 8.5,
    estimatedMinutes: 23,
    isVerified: true,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
    traumaLevel: "Urgent Clinic",
    staffOnDuty: 14,
    surgeon: {
      isAvailable: false,
      name: "No On-Duty Surgeon Available",
      specialty: "General Outpatient Clinic Only",
      contact: "N/A",
      dutyShift: "Refer to Apex Central"
    },
    inventory: {
      icuBeds: 0,
      ventilators: 0,
      oxygenCylinders: 12,
      emergencyOT: 0,
      ctScanReady: false,
      cardiacDefibrillators: 1,
      burnUnitAvailable: false,
      bloodUnits: {
        "O-": 0,
        "O+": 3,
        "A+": 2,
        "B+": 1,
        "AB+": 0
      }
    }
  }
];

export const INITIAL_AMBULANCES = [
  {
    id: "amb-101",
    callsign: "Delta-101 (ALS Unit)",
    driverName: "Vikram Rathore",
    paramedicName: "Dr. Ananya Roy",
    phone: "+91 98201 11223",
    status: "En Route",
    lat: 19.0720,
    lng: 72.8730,
    speedKmH: 48,
    assignedIncidentId: "inc-901",
    destinationHospitalId: "hosp-001",
    etaMinutes: 5,
    vitals: {
      pulse: 104,
      bp: "115/78",
      spo2: "94%",
      isConscious: "semi-conscious",
      isBreathingProperly: "labored",
      pulseStatus: "rapid",
      severeBleeding: true,
      triageLevel: "Red (Critical)"
    }
  },
  {
    id: "amb-102",
    callsign: "Echo-204 (BLS Unit)",
    driverName: "Rajesh Shinde",
    paramedicName: "Kavita Nair",
    phone: "+91 98201 44556",
    status: "Available",
    lat: 19.0850,
    lng: 72.8800,
    speedKmH: 0,
    assignedIncidentId: null,
    destinationHospitalId: null,
    etaMinutes: null,
    vitals: null
  }
];

export const INITIAL_EMERGENCIES = [
  {
    id: "inc-901",
    type: "Road Traffic Accident",
    patientCategory: "Accident / Collision",
    patientCount: 2,
    locationName: "Bandra-Kurla Complex Flyover junction",
    lat: 19.0670,
    lng: 72.8680,
    patientDetails: "Two motorbikes collision, one person semi-conscious, heavy arterial leg bleeding",
    assignedAmbulanceId: "amb-101",
    assignedAmbulanceCallsign: "Delta-101 (ALS Unit)",
    paramedicName: "Dr. Ananya Roy",
    targetHospitalId: "hosp-001",
    targetHospitalName: "Apex Central Trauma Center",
    hospitalResponse: "pending",
    declineReason: null,
    status: "Ambulance Dispatched",
    statusStep: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString()
  }
];

export const INITIAL_AUDIT_LOGS = [
  {
    id: "log-501",
    adminId: "adm_shivam_027",
    adminName: "Shivam Mishra (Lead Administrator)",
    hospitalId: "hosp-001",
    hospitalName: "Apex Central Trauma Center",
    resourceType: "ICU Beds",
    previousQty: 10,
    newQty: 8,
    action: "Admitted 2 Critical Trauma Patients",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: new Date().toLocaleDateString()
  }
];
