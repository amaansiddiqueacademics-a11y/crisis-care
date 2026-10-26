import { config } from "../config/env.js";
import { etaMinutes, isValidCoordinate } from "./geo.js";

/**
 * Where an ambulance is in its job, from its own status. This is the single source of truth for
 * what the crew should navigate to and which leg an arrival time refers to.
 */
export const PHASES = {
  DISPATCHED: "TO_PATIENT",
  EN_ROUTE: "TO_PATIENT",
  AT_SCENE: "AT_PATIENT",
  TRANSPORTING: "TO_HOSPITAL",
  AT_HOSPITAL: "AT_HOSPITAL"
};

/** Freshness of the ambulance's own GPS reports (never of its seeded base-station position). */
export const gpsState = ({ lat, lng, lastUpdate, ageSeconds }) => {
  if (lat == null || lng == null) return "NONE";
  if (!isValidCoordinate(lat, lng)) return "INVALID";
  if (!lastUpdate || ageSeconds == null) return "NONE";
  return ageSeconds > config.gpsStaleSeconds ? "STALE" : "LIVE";
};

const GPS_MESSAGES = {
  NONE: "The ambulance is not sharing a live location yet, so no arrival time can be shown.",
  INVALID: "The ambulance sent an unusable location. Waiting for a valid GPS signal.",
  STALE: (ageSeconds) =>
    `The ambulance location is ${Math.round(ageSeconds / 60)} min old. The arrival time is hidden until a fresh GPS signal arrives.`
};

/**
 * Arrival time for the current leg. There is no road-routing or traffic provider, so the number is
 * always a straight-line estimate and says so. Missing, invalid or stale GPS gives no number.
 */
export const buildEta = ({ phase, gps, ageSeconds, distanceM }) => {
  const to = phase === "TO_HOSPITAL" ? "HOSPITAL" : "PATIENT";

  if (phase === "AT_PATIENT" || phase === "AT_HOSPITAL") {
    return { minutes: 0, to: phase === "AT_HOSPITAL" ? "HOSPITAL" : "PATIENT", status: "ARRIVED", method: null, message: null };
  }

  const unavailable = (message) => ({ minutes: null, to, status: "UNAVAILABLE", method: null, message });

  if (!phase) return unavailable(null);
  if (gps === "NONE" && distanceM != null) {
    // Demo/base-station estimate: the unit has not shared GPS, so its seeded base-station position is used.
    return {
      minutes: etaMinutes(distanceM),
      to,
      status: "ESTIMATE",
      method: "STRAIGHT_LINE",
      basis: "BASE_STATION",
      message: `Demo estimate from the unit's base-station position (no live GPS yet), straight-line at ${config.avgSpeedKmh} km/h. Not a road-route time and no traffic data.`
    };
  }
  if (gps !== "LIVE") {
    const message = GPS_MESSAGES[gps];
    return unavailable(typeof message === "function" ? message(ageSeconds) : message);
  }
  if (distanceM == null) return unavailable("The destination is not known yet.");

  return {
    minutes: etaMinutes(distanceM),
    to,
    status: "ESTIMATE",
    method: "STRAIGHT_LINE",
    message: `Rough estimate from straight-line distance at ${config.avgSpeedKmh} km/h. It is not a road-route time and does not include traffic.`
  };
};

/**
 * What the crew should navigate to right now:
 *   on the way to the patient          -> the patient
 *   with the patient, hospital accepted -> the accepted hospital (preview of the next leg)
 *   transporting                        -> the hospital
 * Otherwise there is nothing to navigate to, and `note` says what to do instead.
 */
export const buildNavigation = ({ phase, patient, hospital, hospitalAccepted }) => {
  if (!phase) return null;

  const toPatient = {
    phase,
    destination: { kind: "PATIENT", name: "Patient", lat: patient.lat, lng: patient.lng },
    label: "Navigate to Patient",
    note: null
  };
  const toHospital = hospital && {
    phase,
    destination: { kind: "HOSPITAL", name: hospital.name, lat: hospital.lat, lng: hospital.lng },
    label: "Navigate to Hospital",
    note: null
  };
  const none = (note) => ({ phase, destination: null, label: null, note });

  switch (phase) {
    case "TO_PATIENT":
      return toPatient;
    case "AT_PATIENT":
      return hospitalAccepted && toHospital
        ? toHospital
        : none("With the patient. Ask a hospital to accept; navigation to it starts once one does.");
    case "TO_HOSPITAL":
      return toHospital || none("Hospital unknown.");
    default:
      return none("At the hospital. Hand the patient over.");
  }
};
