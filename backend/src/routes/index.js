import { Router } from "express";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";

import { config } from "../config/env.js";
import * as c from "../controllers/index.js";
import { authenticate, authorize, ROLES } from "../middleware/authMiddleware.js";
import { validate } from "../utils/validate.js";
import authRoutes from "./authRoutes.js";

const router = Router();

const CODE_PATTERN = /^CC-[A-Z0-9]{8}$/;

export const EMERGENCY_TYPES = [
  "Traffic Accident",
  "Cardiac / Chest Pain",
  "Breathing Difficulty",
  "Severe Bleeding",
  "Unconscious Person",
  "Suspected Stroke",
  "Seizure / Convulsion",
  "Severe Burns",
  "Fall from Height",
  "Bone Fracture",
  "Poisoning",
  "Snakebite & Animal Bite",
  "Pregnancy Emergency",
  "Pediatric Emergency",
  "Allergic Anaphylaxis",
  "Electric Shock",
  "Other Emergency"
];

const emergencyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.emergencyRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many emergency reports from this connection. Call 112 directly."
  }
});

const optionalInt = (field, min, max) =>
  body(field).optional({ values: "null" }).isInt({ min, max }).toInt();

const optionalText = (field, max) =>
  body(field).optional({ values: "null" }).isString().trim().isLength({ max });

const PHONE = /^[0-9+()\-\s]{6,20}$/;

/** Optional patient profile; every field is a tap answer or a short optional text. */
const patientRules = (prefix) => [
  optionalText(`${prefix}fullName`, 150),
  body(`${prefix}ageGroup`).optional({ values: "null" }).isIn(["INFANT", "CHILD", "TEEN", "ADULT", "SENIOR"]),
  body(`${prefix}sex`).optional({ values: "null" }).isIn(["FEMALE", "MALE", "OTHER"]),
  body(`${prefix}bloodGroup`).optional({ values: "null" }).isIn(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  body(`${prefix}knownConditions`).optional({ values: "null" }).isArray({ max: 12 }),
  body(`${prefix}knownConditions.*`).isString().trim().isLength({ max: 40 }),
  body(`${prefix}allergies`).optional({ values: "null" }).isArray({ max: 12 }),
  body(`${prefix}allergies.*`).isString().trim().isLength({ max: 40 }),
  optionalText(`${prefix}medications`, 300),
  optionalText(`${prefix}emergencyContactName`, 150),
  body(`${prefix}emergencyContactPhone`).optional({ values: "falsy" }).matches(PHONE).withMessage("Invalid phone number")
];

// --- Auth -------------------------------------------------------------------
router.use("/auth", authRoutes);

// --- Public -----------------------------------------------------------------
router.get("/health", c.health);
router.get("/stats", c.stats);
router.get(
  "/hospitals",
  query("city").optional().isString().trim().isLength({ max: 100 }),
  validate,
  c.hospitals
);
router.get("/hospitals/cities", c.cities);
router.get(
  "/hospitals/recommend",
  [
    query("type").isIn(EMERGENCY_TYPES),
    query("lat").isFloat({ min: -90, max: 90 }).toFloat(),
    query("lng").isFloat({ min: -180, max: 180 }).toFloat(),
    validate
  ],
  c.recommend
);

router.post(
  "/emergencies",
  emergencyLimiter,
  [
    body("type").isIn(EMERGENCY_TYPES),
    body("lat").isFloat({ min: -90, max: 90 }).toFloat(),
    body("lng").isFloat({ min: -180, max: 180 }).toFloat(),
    body("patientCount").optional().isInt({ min: 1, max: 20 }).toInt(),
    body("description").optional({ values: "null" }).isString().trim().isLength({ max: 300 }),
    body("locationText").optional({ values: "null" }).isString().trim().isLength({ max: 300 }),
    body("callerName").optional({ values: "null" }).isString().trim().isLength({ max: 150 }),
    body("callerPhone")
      .optional({ values: "falsy" })
      .matches(/^[0-9+()\-\s]{6,20}$/)
      .withMessage("Invalid phone number"),
    body("problemKind").optional({ values: "null" }).isIn(["outside", "inside"]),
    optionalText("bodyArea", 30),
    body("symptoms").optional({ values: "null" }).isArray({ max: 15 }),
    body("symptoms.*").isString().trim().isLength({ max: 40 }),
    optionalInt("painLevel", 1, 5),
    body("photo")
      .optional({ values: "null" })
      .isString()
      .isLength({ max: 500000 })
      .matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
      .withMessage("Photo must be a JPEG/PNG under about 350 KB"),
    body("reporterRelation").optional({ values: "null" }).isIn(["SELF", "FAMILY", "BYSTANDER"]),
    body("patient").optional({ values: "null" }).isObject(),
    ...patientRules("patient."),
    validate
  ],
  (req, _res, next) => {
    req.body.patientCount ??= 1;
    next();
  },
  c.reportEmergency
);
router.get("/emergencies/:code", param("code").matches(CODE_PATTERN), validate, c.trackEmergency);
router.get("/emergencies/:code/nearby-ambulances", param("code").matches(CODE_PATTERN), validate, c.nearbyUnits);
router.post(
  "/emergencies/:code/cancel",
  param("code").matches(CODE_PATTERN),
  validate,
  c.cancelReportedEmergency
);

// --- Ambulance crew -----------------------------------------------------------
const ambulance = Router();
ambulance.use(authenticate, authorize(ROLES.AMBULANCE_CREW));

ambulance.get("/me", c.ambulanceMe);
ambulance.put(
  "/location",
  [
    body("lat").isFloat({ min: -90, max: 90 }).toFloat(),
    body("lng").isFloat({ min: -180, max: 180 }).toFloat(),
    validate
  ],
  c.ambulanceLocation
);
ambulance.put(
  "/availability",
  body("status").isIn(["AVAILABLE", "OFFLINE"]),
  validate,
  c.ambulanceAvailability
);
ambulance.get("/emergency/hospitals", c.ambulanceHospitals);
ambulance.post(
  "/emergency/assessment",
  [
    body("consciousness").isIn(["conscious", "semi-conscious", "unconscious"]),
    body("breathing").isIn(["normal", "labored", "not-breathing"]),
    body("pulseStatus").isIn(["normal", "rapid", "weak", "none"]),
    body("severeBleeding").isBoolean().toBoolean(),
    optionalInt("heartRate", 0, 300),
    optionalInt("spo2", 0, 100),
    optionalInt("systolicBp", 0, 300),
    optionalInt("diastolicBp", 0, 200),
    body("notes").optional({ values: "null" }).isString().trim().isLength({ max: 500 }),
    body("categoryFindings")
      .optional({ values: "null" })
      .isObject()
      .custom((v) => {
        if (JSON.stringify(v).length > 2000) throw new Error("Findings too long");
        return true;
      }),
    validate
  ],
  c.ambulanceAssessment
);
ambulance.put("/emergency/patient", [...patientRules(""), validate], c.ambulancePatient);
ambulance.post(
  "/emergency/select-hospital",
  body("hospitalId").isInt({ min: 1 }).toInt(),
  validate,
  c.ambulanceSelectHospital
);
ambulance.post(
  "/emergency/stage",
  body("step").isIn(["ARRIVE_SCENE", "START_TRANSPORT", "ARRIVE_HOSPITAL", "HANDOVER"]),
  validate,
  c.ambulanceStage
);
router.use("/ambulance", ambulance);

// --- Hospital staff -------------------------------------------------------------
const hospital = Router();
hospital.use(authenticate, authorize(ROLES.HOSPITAL_ADMIN));

hospital.get("/me", c.hospitalMe);
hospital.get("/requests", c.hospitalRequests);
hospital.post(
  "/requests/:responseId/respond",
  [
    param("responseId").isInt({ min: 1 }).toInt(),
    body("decision").isIn(["ACCEPT", "DECLINE"]),
    body("reason")
      .if(body("decision").equals("DECLINE"))
      .isString()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage("A decline reason is required"),
    validate
  ],
  c.hospitalRespond
);
hospital.patch(
  "/inventory/:resourceCode",
  [
    param("resourceCode").matches(/^[A-Z_]{3,50}$/),
    body("quantity").optional().isInt({ min: 0, max: 100000 }).toInt(),
    body("delta").optional().isInt({ min: -1000, max: 1000 }).toInt(),
    body().custom((value) => {
      const hasOne = (value.quantity !== undefined) !== (value.delta !== undefined);
      if (!hasOne) throw new Error("Provide exactly one of quantity or delta");
      return true;
    }),
    validate
  ],
  c.hospitalInventory
);
hospital.put(
  "/surgeon",
  [
    body("status").isIn(["AVAILABLE", "IN_SURGERY", "OFFLINE", "ON_CALL"]),
    body("fullName").optional().isString().trim().isLength({ min: 2, max: 150 }),
    body("specialization").optional().isString().trim().isLength({ min: 2, max: 100 }),
    validate
  ],
  c.hospitalSurgeon
);
hospital.put(
  "/er-status",
  [
    body("status").isIn(["ACCEPTING", "LIMITED", "DIVERSION"]),
    optionalText("note", 200),
    validate
  ],
  c.hospitalErStatus
);
hospital.put(
  "/services/:serviceCode",
  [
    param("serviceCode").isIn([
      "TRAUMA", "CATH_LAB", "STROKE", "BURNS", "MATERNITY", "NICU",
      "PAEDIATRIC", "DIALYSIS", "TOXICOLOGY", "ANTIVENOM"
    ]),
    body("available").isBoolean().toBoolean(),
    validate
  ],
  c.hospitalService
);
router.use("/hospital", hospital);

// --- Admin ----------------------------------------------------------------------
const admin = Router();
admin.use(authenticate, authorize(ROLES.ADMIN));

const auditFilters = [
  query("hospitalId").optional().isInt({ min: 1 }).toInt(),
  query("search").optional().isString().trim().isLength({ max: 100 }),
  query("limit").optional().isInt({ min: 1, max: 1000 }).toInt(),
  validate
];

admin.get("/overview", c.adminOverview);
admin.get("/audit-logs", auditFilters, c.adminAuditLogs);
admin.get("/audit-logs/export", auditFilters, c.adminAuditCsv);
admin.get("/dispatch", c.adminDispatchBoard);
admin.post(
  "/emergencies/:code/assign",
  [param("code").matches(CODE_PATTERN), body("ambulanceId").isInt({ min: 1 }).toInt(), validate],
  c.adminAssign
);
admin.post(
  "/emergencies/:code/cancel",
  [
    param("code").matches(CODE_PATTERN),
    body("reason").isString().trim().isLength({ min: 3, max: 200 }),
    validate
  ],
  c.adminCancel
);
router.use("/admin", admin);

export default router;
