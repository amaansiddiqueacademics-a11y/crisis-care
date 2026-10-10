/**
 * Demo cases for presentations: a handful of realistic emergencies at different stages, so the
 * ambulance, hospital and dispatch screens have something to show.
 *
 *   npm run db:demo            create the cases (does nothing if demo cases are still open)
 *   npm run db:demo -- --reset cancel the open demo cases, then create fresh ones
 *
 * Cases are ordinary emergencies created through the same services the website uses, marked by
 * the caller name "Demo caller". Run `npm run db:setup` first.
 */
import pool from "../config/db.js";
import {
  advanceStage,
  cancelEmergency,
  createEmergency,
  listNearbyHospitals,
  saveAssessment,
  selectHospital,
  updateAmbulanceLocation,
  updatePatientByCrew
} from "../services/emergencyService.js";
import { respondToRequest } from "../services/hospitalService.js";

const DEMO = "Demo caller";

const openDemo = async () =>
  (
    await pool.query(
      `SELECT emergency_code FROM emergency_requests
       WHERE caller_name = $1 AND status NOT IN ('CLOSED', 'CANCELLED')`,
      [DEMO]
    )
  ).rows.map((r) => r.emergency_code);

const crewOf = async (ambulanceId) =>
  (await pool.query("SELECT crew_id FROM ambulance_crew WHERE ambulance_id = $1 LIMIT 1", [ambulanceId])).rows[0]
    ?.crew_id;

/** Ask the best-fitting hospital for this crew's patient, as the crew would. */
const askBestHospital = async (ambulanceId) => {
  const ranked = await listNearbyHospitals(ambulanceId);
  const best = ranked.find((h) => h.recommended) || ranked[0];
  await selectHospital(ambulanceId, best.id);
  return best;
};

const hospitalUser = async (hospitalId) => {
  const { rows } = await pool.query(
    "SELECT hospital_admin_id, full_name FROM hospital_admins WHERE hospital_id = $1 LIMIT 1",
    [hospitalId]
  );
  return { userId: rows[0]?.hospital_admin_id, name: rows[0]?.full_name || "Emergency desk", role: "HOSPITAL_ADMIN", hospitalId, meta: {} };
};

const respond = async (hospitalId, decision, reason) => {
  const { rows } = await pool.query(
    `SELECT response_id FROM hospital_emergency_responses
     WHERE hospital_id = $1 AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1`,
    [hospitalId]
  );
  await respondToRequest(await hospitalUser(hospitalId), rows[0].response_id, { decision, reason });
};

const report = (input) => createEmergency({ callerName: DEMO, patientCount: 1, ...input });

async function main() {
  if (process.argv.includes("--reset")) {
    for (const code of await openDemo()) await cancelEmergency(code);
  }

  if ((await openDemo()).length > 0) {
    console.log("Demo cases are already open. Use --reset to recreate them.");
    return;
  }

  // 1. Heart attack at Parel: next to the KEM-based unit MUM-ALS-01. On scene, assessed, hospital asked.
  const heart = await report({
    type: "Cardiac / Chest Pain", lat: 19.0017, lng: 72.8419, callerPhone: "9820011122",
    locationText: "Parel · outside Parel station, east side", symptoms: ["Chest pain", "Heavy sweating"], painLevel: 5,
    problemKind: "inside", reporterRelation: "BYSTANDER"
  });
  const heartAmb = heart.ambulance.id;
  await advanceStage(heartAmb, "ARRIVE_SCENE", {});
  await updatePatientByCrew(heartAmb, {
    fullName: "Suresh Naik", ageGroup: "SENIOR", sex: "MALE", bloodGroup: "B+",
    knownConditions: ["Diabetes", "High BP"], allergies: ["Aspirin / NSAIDs"], emergencyContactPhone: "9820033344"
  });
  await saveAssessment(heartAmb, await crewOf(heartAmb), {
    consciousness: "conscious", breathing: "labored", pulseStatus: "rapid", severeBleeding: false,
    heartRate: 112, spo2: 92, systolicBp: 98, diastolicBp: 64,
    notes: "Crushing chest pain for 40 minutes, sweating, pale.",
    categoryFindings: { stElevation: true, painMinutes: 40 }
  });
  const heartHospital = await askBestHospital(heartAmb);

  // 2. Road accident at Kurla: ambulance just dispatched.
  await report({
    type: "Traffic Accident", lat: 19.0726, lng: 72.8845, callerPhone: "9867755500",
    locationText: "Kurla · LBS Marg near Kamani junction", problemKind: "outside", bodyArea: "Leg", reporterRelation: "BYSTANDER", patientCount: 2
  });

  // 3. Stroke at Andheri: just dispatched.
  await report({
    type: "Suspected Stroke", lat: 19.1136, lng: 72.8697, callerPhone: "9930011223",
    locationText: "Andheri East · Chakala, near Marol Naka", symptoms: ["Cannot move an arm or leg", "Confusion"],
    problemKind: "inside", reporterRelation: "FAMILY"
  });

  // 4. Labour at Thane: accepted by a hospital, now transporting.
  const labour = await report({
    type: "Pregnancy Emergency", lat: 19.2183, lng: 72.9781, callerPhone: "9892200145",
    locationText: "Thane West · Naupada", reporterRelation: "FAMILY"
  });
  const labourAmb = labour.ambulance.id;
  await advanceStage(labourAmb, "ARRIVE_SCENE", {});
  await updatePatientByCrew(labourAmb, { ageGroup: "ADULT", sex: "FEMALE", bloodGroup: "O+", knownConditions: ["Pregnant"] });
  await saveAssessment(labourAmb, await crewOf(labourAmb), {
    consciousness: "conscious", breathing: "normal", pulseStatus: "rapid", severeBleeding: false,
    heartRate: 104, spo2: 98, systolicBp: 118, diastolicBp: 76, categoryFindings: { weeks: 38, contractionsMin: 4, heavyBleeding: false }
  });
  const labourHospital = await askBestHospital(labourAmb);
  await respond(labourHospital.id, "ACCEPT");
  await advanceStage(labourAmb, "START_TRANSPORT", {});

  // 5. Snakebite at Dahanu.
  await report({
    type: "Snakebite & Animal Bite", lat: 19.9712, lng: 72.7312, callerPhone: "9422211300",
    locationText: "Dahanu · Gholvad road, farm", problemKind: "outside", bodyArea: "Foot", reporterRelation: "FAMILY"
  });

  // 6. Breathing difficulty at Nashik: out of range of every unit, so it waits in the queue.
  await report({
    type: "Breathing Difficulty", lat: 19.9975, lng: 73.7898, callerPhone: "9890033221",
    locationText: "Nashik Road · near the bus stand", symptoms: ["Hard to breathe"], problemKind: "inside", reporterRelation: "SELF"
  });

  // Move one en-route unit slightly so GPS positions differ from the base stations.
  await updateAmbulanceLocation(heartAmb, 19.0021, 72.8425);

  console.log("Demo cases created:");
  console.log(`  Chest pain at Parel: unit ${heart.ambulance.callsign}, asked ${heartHospital.name} (sign in as that hospital to accept)`);
  console.log(`  Labour at Thane: accepted by ${labourHospital.name}, ambulance transporting`);
  console.log("  Road accident (Kurla), stroke (Andheri), snakebite (Dahanu): ambulance dispatched");
  console.log("  Breathing difficulty (Nashik): waiting, no unit in range");
}

try {
  await main();
} catch (error) {
  console.error("Demo seed failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
