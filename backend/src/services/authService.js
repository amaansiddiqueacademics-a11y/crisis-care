import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import pool from "../config/db.js";
import { config } from "../config/env.js";
import { ROLES } from "../middleware/authMiddleware.js";
import { unauthorized } from "../utils/AppError.js";

const INVALID = "Invalid username or password";

// Compared against when the account does not exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const signToken = (payload) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const checkPassword = async (password, hash) =>
  bcrypt.compare(password, hash || DUMMY_HASH).then((ok) => ok && Boolean(hash));

/**
 * Hospital ER staff login (hospital_admins table).
 */
export const loginHospital = async (username, password) => {
  const { rows } = await pool.query(
    `
    SELECT ha.hospital_admin_id, ha.hospital_id, ha.username, ha.password_hash,
           ha.full_name, ha.is_active,
           h.name AS hospital_name, h.city, h.status AS hospital_status
    FROM hospital_admins ha
    JOIN hospitals h ON h.hospital_id = ha.hospital_id
    WHERE ha.username = $1
    `,
    [username]
  );

  const admin = rows[0];

  if (!(await checkPassword(password, admin?.password_hash))) {
    throw unauthorized(INVALID);
  }

  if (!admin.is_active || admin.hospital_status !== "ACTIVE") {
    throw unauthorized("This hospital account is inactive");
  }

  await pool.query(
    "UPDATE hospital_admins SET last_login_at = CURRENT_TIMESTAMP WHERE hospital_admin_id = $1",
    [admin.hospital_admin_id]
  );

  const user = {
    id: admin.hospital_admin_id,
    hospitalId: admin.hospital_id,
    username: admin.username,
    fullName: admin.full_name,
    role: ROLES.HOSPITAL_ADMIN,
    hospital: { id: admin.hospital_id, name: admin.hospital_name, city: admin.city }
  };

  return {
    token: signToken({
      userId: user.id,
      hospitalId: user.hospitalId,
      username: user.username,
      name: user.fullName,
      role: user.role
    }),
    user
  };
};

/**
 * Ambulance crew login (ambulance_crew table). The crew member must be assigned to an ambulance.
 */
export const loginAmbulanceCrew = async (username, password) => {
  const { rows } = await pool.query(
    `
    SELECT c.crew_id, c.employee_code, c.full_name, c.role, c.username, c.password_hash,
           c.ambulance_id, a.callsign, a.status AS ambulance_status
    FROM ambulance_crew c
    LEFT JOIN ambulances a ON a.ambulance_id = c.ambulance_id
    WHERE c.username = $1
    `,
    [username]
  );

  const crew = rows[0];

  if (!(await checkPassword(password, crew?.password_hash))) {
    throw unauthorized(INVALID);
  }

  if (!crew.ambulance_id) {
    throw unauthorized("This crew member is not assigned to an ambulance");
  }

  const user = {
    id: crew.crew_id,
    ambulanceId: crew.ambulance_id,
    username: crew.username,
    employeeCode: crew.employee_code,
    fullName: crew.full_name,
    crewRole: crew.role,
    role: ROLES.AMBULANCE_CREW,
    ambulance: { id: crew.ambulance_id, callsign: crew.callsign }
  };

  return {
    token: signToken({
      userId: user.id,
      ambulanceId: user.ambulanceId,
      username: user.username,
      name: user.fullName,
      role: user.role
    }),
    user
  };
};

/**
 * System administrator login (users table, role ADMIN). Identifier is the email.
 */
export const loginAdmin = async (email, password) => {
  const { rows } = await pool.query(
    `
    SELECT user_id, full_name, email, password_hash, is_active
    FROM users
    WHERE LOWER(email) = LOWER($1) AND role = 'ADMIN'
    `,
    [email]
  );

  const admin = rows[0];

  if (!(await checkPassword(password, admin?.password_hash))) {
    throw unauthorized(INVALID);
  }

  if (!admin.is_active) {
    throw unauthorized("This account is inactive");
  }

  const user = {
    id: admin.user_id,
    email: admin.email,
    fullName: admin.full_name,
    role: ROLES.ADMIN
  };

  return {
    token: signToken({
      userId: user.id,
      username: user.email,
      name: user.fullName,
      role: user.role
    }),
    user
  };
};
