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
