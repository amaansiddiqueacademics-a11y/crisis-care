import jwt from "jsonwebtoken";

import { config } from "../config/env.js";
import { forbidden, unauthorized } from "../utils/AppError.js";

export const ROLES = Object.freeze({
  HOSPITAL_ADMIN: "HOSPITAL_ADMIN",
  AMBULANCE_CREW: "AMBULANCE_CREW",
  ADMIN: "ADMIN"
});

export const verifyToken = (token) =>
  jwt.verify(token, config.jwtSecret);

/**
 * Requires `Authorization: Bearer <token>` and attaches the decoded payload to req.user.
 */
export const authenticate = (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(unauthorized("Authentication token required"));
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return next(unauthorized("Invalid or expired token"));
  }
};

/**
 * Role-based authorization; use after `authenticate`.
 */
export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    return next(unauthorized());
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(forbidden());
  }

  return next();
};
