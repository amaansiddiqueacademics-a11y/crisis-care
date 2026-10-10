import { requestMeta } from "../services/auditService.js";
import {
  exportAuditCsv,
  getAdminOverview,
  getPublicStats,
  getSystemHealth,
  listAuditLogs
} from "../services/adminService.js";
import {
  advanceStage,
  cancelEmergency,
  createEmergency,
  dispatcherAssign,
  dispatcherCancel,
  getDispatchBoard,
  updatePatientByCrew,
  getAmbulanceOverview,
  getEmergencyByCode,
  listNearbyHospitals,
  saveAssessment,
  selectHospital,
  setAmbulanceAvailability,
  updateAmbulanceLocation
} from "../services/emergencyService.js";
import {
  getOwnHospital,
  listCities,
  listHospitals,
  listRequests,
  recommendHospitals,
  respondToRequest,
  updateErStatus,
  updateInventory,
  updateService,
  updateSurgeon
} from "../services/hospitalService.js";
import { notFound } from "../utils/AppError.js";

const ok = (res, data, message = "OK", status = 200) =>
  res.status(status).json({ success: true, message, data });

/** Authenticated user plus request metadata, as the services expect. */
const actorOf = (req) => ({ ...req.user, meta: requestMeta(req) });

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const health = async (_req, res) =>
  ok(res, { service: "crisis-care-backend", ...(await getSystemHealth()) });

export const stats = async (_req, res) => ok(res, await getPublicStats());

export const hospitals = async (req, res) =>
  ok(res, await listHospitals({ city: req.query.city }));

export const cities = async (_req, res) => ok(res, await listCities());

export const recommend = async (req, res) => ok(res, await recommendHospitals(req.query));

export const reportEmergency = async (req, res) => {
  const emergency = await createEmergency(req.body);

  ok(res, emergency, "Emergency reported", 201);
};

export const trackEmergency = async (req, res) => {
  const emergency = await getEmergencyByCode(req.params.code);

  if (!emergency) throw notFound("Emergency not found");

  ok(res, emergency);
};

export const cancelReportedEmergency = async (req, res) =>
  ok(res, await cancelEmergency(req.params.code), "Emergency cancelled");

// ---------------------------------------------------------------------------
// Ambulance crew
// ---------------------------------------------------------------------------

export const ambulanceMe = async (req, res) =>
  ok(res, await getAmbulanceOverview(req.user.ambulanceId));

export const ambulanceLocation = async (req, res) => {
  await updateAmbulanceLocation(req.user.ambulanceId, req.body.lat, req.body.lng);

  ok(res, null, "Location updated");
};

export const ambulanceAvailability = async (req, res) => {
  await setAmbulanceAvailability(req.user.ambulanceId, req.body.status);

  ok(res, await getAmbulanceOverview(req.user.ambulanceId), "Availability updated");
};

export const ambulanceHospitals = async (req, res) =>
  ok(res, await listNearbyHospitals(req.user.ambulanceId));

export const ambulanceAssessment = async (req, res) => {
  await saveAssessment(req.user.ambulanceId, req.user.userId, req.body);

  ok(res, await getAmbulanceOverview(req.user.ambulanceId), "Assessment saved", 201);
};

export const ambulancePatient = async (req, res) => {
  await updatePatientByCrew(req.user.ambulanceId, req.body);

  ok(res, await getAmbulanceOverview(req.user.ambulanceId), "Patient details saved");
};

export const ambulanceSelectHospital = async (req, res) => {
  await selectHospital(req.user.ambulanceId, req.body.hospitalId);

  ok(res, await getAmbulanceOverview(req.user.ambulanceId), "Hospital queried");
};

export const ambulanceStage = async (req, res) => {
  const user = actorOf(req);

  await advanceStage(req.user.ambulanceId, req.body.step, {
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    ...user.meta
  });

  ok(res, await getAmbulanceOverview(req.user.ambulanceId), "Status updated");
};

// ---------------------------------------------------------------------------
// Hospital staff
// ---------------------------------------------------------------------------

export const hospitalMe = async (req, res) => ok(res, await getOwnHospital(req.user.hospitalId));

export const hospitalRequests = async (req, res) =>
  ok(res, await listRequests(req.user.hospitalId));

export const hospitalRespond = async (req, res) => {
  await respondToRequest(actorOf(req), req.params.responseId, req.body);

  ok(res, await listRequests(req.user.hospitalId), "Response recorded");
};

export const hospitalInventory = async (req, res) =>
  ok(res, await updateInventory(actorOf(req), req.params.resourceCode, req.body), "Inventory updated");

export const hospitalSurgeon = async (req, res) =>
  ok(res, await updateSurgeon(actorOf(req), req.body), "Surgeon updated");

export const hospitalErStatus = async (req, res) => {
  await updateErStatus(actorOf(req), req.body);

  ok(res, await getOwnHospital(req.user.hospitalId), "Emergency room status updated");
};

export const hospitalService = async (req, res) => {
  await updateService(actorOf(req), req.params.serviceCode, req.body.available);

  ok(res, await getOwnHospital(req.user.hospitalId), "Service updated");
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminOverview = async (_req, res) => ok(res, await getAdminOverview());

const dispatcherOf = (req) => {
  const user = actorOf(req);
  return { actorId: user.userId, actorName: user.name, actorRole: user.role, ...user.meta };
};

export const adminDispatchBoard = async (_req, res) => ok(res, await getDispatchBoard());

export const adminAssign = async (req, res) => {
  await dispatcherAssign(req.params.code, req.body.ambulanceId, dispatcherOf(req));

  ok(res, await getDispatchBoard(), "Ambulance assigned");
};

export const adminCancel = async (req, res) => {
  await dispatcherCancel(req.params.code, req.body.reason, dispatcherOf(req));

  ok(res, await getDispatchBoard(), "Emergency cancelled");
};

export const adminAuditLogs = async (req, res) =>
  ok(
    res,
    await listAuditLogs({
      hospitalId: req.query.hospitalId,
      search: req.query.search,
      limit: req.query.limit
    })
  );

export const adminAuditCsv = async (req, res) => {
  const csv = await exportAuditCsv({
    hospitalId: req.query.hospitalId,
    search: req.query.search
  });

  res
    .type("text/csv")
    .set("Content-Disposition", 'attachment; filename="crisis-care-audit-log.csv"')
    .send(csv);
};
