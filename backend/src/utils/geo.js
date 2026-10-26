import { config } from "../config/env.js";

export const metersToKm = (meters) =>
  meters == null ? null : Math.round((meters / 1000) * 10) / 10;

/**
 * Estimated travel minutes from straight-line distance. This is an estimate,
 * not a routed ETA; the UI labels it as such.
 */
export const etaMinutes = (meters) =>
  meters == null
    ? null
    : Math.max(1, Math.round((meters / 1000 / config.avgSpeedKmh) * 60));

export const POINT_SQL = (lngParam, latParam) =>
  `ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography`;

/** A usable GPS fix: finite numbers inside the valid range, and not the (0, 0) "no fix" value. */
export const isValidCoordinate = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);
