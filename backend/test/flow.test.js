/**
 * End-to-end test of the emergency lifecycle against a throwaway PostGIS database.
 * Needs DATABASE_URL pointing at a server where the user may CREATE DATABASE.
 * The test creates `<dbname>_test`, applies schema + seed, and drops it afterwards.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
import pg from "pg";
import { io as connect } from "socket.io-client";

dotenv.config();

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = new URL(process.env.DATABASE_URL);
const testDbName = `${baseUrl.pathname.slice(1)}_test`;

const adminUrl = new URL(baseUrl);
adminUrl.pathname = "/postgres";

const testUrl = new URL(baseUrl);
testUrl.pathname = `/${testDbName}`;

const ADMIN_EMAIL = "test-admin@crisiscare.local";
const ADMIN_PASSWORD = "TestAdminPass-2026";
const CREW_PASSWORD = "TestCrewPass-2026";

const credentials = parse(
  fs.readFileSync(path.join(backendDir, "data/hospital_admin_credentials.csv"), "utf-8"),
  { columns: true, skip_empty_lines: true, trim: true }
);
const passwordFor = (username) =>
  credentials.find((c) => c.username === username).password_demo_only;

let server;
let api;
let db;
const sockets = [];

const call = async (method, url, { token, body } = {}) => {
  const res = await fetch(`${api}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // CSV or empty body
  }
  return { status: res.status, json, text };
};

const login = async (kind, username, password) => {
  const res = await call("POST", `/auth/${kind}/login`, { body: { username, password } });
  assert.equal(res.status, 200, `${kind} login failed: ${res.text}`);
  return res.json.data;
};

const waitFor = (socket, event, predicate = () => true, timeoutMs = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    const handler = (payload) => {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };
    socket.on(event, handler);
  });

const openSocket = async (token) => {
  const socket = connect(api.replace("/api/v1", ""), {
    auth: token ? { token } : {},
    transports: ["websocket"]
  });
  sockets.push(socket);
  await waitFor(socket, "connect");
  return socket;
};

before(async () => {
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${testDbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${testDbName}"`);
  await admin.end();

  const env = {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
    SEED_ADMIN_EMAIL: ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
    SEED_CREW_PASSWORD: CREW_PASSWORD,
    NODE_ENV: "test"
  };

  const extension = new pg.Client({ connectionString: testUrl.toString() });
  await extension.connect();
  await extension.query("CREATE EXTENSION IF NOT EXISTS postgis");
  await extension.end();

  execFileSync("node", ["src/scripts/initDatabase.js"], { cwd: backendDir, env, stdio: "pipe" });
  execFileSync("node", ["src/scripts/seedDatabase.js"], { cwd: backendDir, env, stdio: "pipe" });

  Object.assign(process.env, env, { EMERGENCY_RATE_LIMIT: "1000" });

  const { default: app } = await import("../src/app.js");
  const { initSocket } = await import("../src/realtime/socket.js");

  server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  api = `http://127.0.0.1:${server.address().port}/api/v1`;

  db = new pg.Client({ connectionString: testUrl.toString() });
  await db.connect();
});

after(async () => {
  for (const s of sockets) s.close();
  await new Promise((resolve) => server?.close(resolve));
  await db?.end();
  const { default: pool } = await import("../src/config/db.js");
  await pool.end();

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${testDbName}" WITH (FORCE)`);
  await admin.end();
});

describe("security", () => {
  it("rejects bad credentials and unauthenticated access", async () => {
    const bad = await call("POST", "/auth/admin/login", {
      body: { username: ADMIN_EMAIL, password: "wrong-password" }
    });
    assert.equal(bad.status, 401);

    assert.equal((await call("GET", "/admin/overview")).status, 401);
    assert.equal((await call("GET", "/hospital/me")).status, 401);
    assert.equal((await call("GET", "/ambulance/me", { token: "garbage" })).status, 401);
  });

  it("enforces role-based access", async () => {
    const hospital = await login("hospital", "kem_mumbai", passwordFor("kem_mumbai"));
    const crew = await login("ambulance", "mum-als-01", CREW_PASSWORD);

    assert.equal((await call("GET", "/admin/overview", { token: hospital.token })).status, 403);
    assert.equal((await call("GET", "/hospital/me", { token: crew.token })).status, 403);
    assert.equal((await call("GET", "/ambulance/me", { token: hospital.token })).status, 403);
  });

  it("validates emergency reports", async () => {
    const res = await call("POST", "/emergencies", {
      body: { type: "Not a real type", lat: 200, lng: 72.8 }
    });
    assert.equal(res.status, 400);
    assert.ok(res.json.errors.length >= 2);
  });

  it("seeds the 28-unit demo fleet with its initial availability", async () => {
    const { rows } = await db.query("SELECT callsign, status, registration_number FROM ambulances ORDER BY callsign");
    assert.equal(rows.length, 28);
    assert.ok(rows.every((r) => r.registration_number.startsWith("DEV-")), "all fixtures are labelled development data");
    assert.equal(rows.find((r) => r.callsign === "THN-BLS-23").status, "OFFLINE");
    assert.equal(rows.find((r) => r.callsign === "NVM-BLS-26").status, "MAINTENANCE");
    assert.equal(rows.filter((r) => r.status === "AVAILABLE").length, 26);
  });

  it("never stores plaintext passwords", async () => {
    const { rows } = await db.query(
      "SELECT password_hash FROM hospital_admins UNION ALL SELECT password_hash FROM ambulance_crew UNION ALL SELECT password_hash FROM users"
    );
    assert.ok(rows.length > 80);
    for (const r of rows) assert.match(r.password_hash, /^\$2[aby]\$/);
  });
});

describe("emergency lifecycle", () => {
  let hospital;
  let crew;
  let adminSession;
  let code;
  let kemId;
  let declinerId;
  let decliner;

  it("signs everyone in", async () => {
    hospital = await login("hospital", "kem_mumbai", passwordFor("kem_mumbai"));
    crew = await login("ambulance", "mum-als-01", CREW_PASSWORD);
    adminSession = await login("admin", ADMIN_EMAIL, ADMIN_PASSWORD);
    kemId = hospital.user.hospitalId;
  });

  it("lets hospital staff set stock and records it as hospital-reported", async () => {
    const res = await call("PATCH", "/hospital/inventory/ICU_BED", {
      token: hospital.token,
      body: { quantity: 3 }
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.quantity, 3);
    assert.equal(res.json.data.confirmed, true);

    const list = await call("GET", "/hospitals?city=Mumbai");
    const kem = list.json.data.find((h) => h.id === kemId);
    assert.equal(kem.available.ICU_BED, 3);
    assert.equal(kem.inventoryConfirmed, true);
  });

  it("dispatches the nearest ambulance and pushes realtime updates", async () => {
    const res = await call("POST", "/emergencies", {
      body: {
        type: "Traffic Accident",
        lat: 19.0021,
        lng: 72.8425,
        patientCount: 2,
        description: "Two-wheeler collision",
        locationText: "Parel junction"
      }
    });
    assert.equal(res.status, 201);
    code = res.json.data.code;
    assert.match(code, /^CC-[A-Z0-9]{8}$/);
    assert.equal(res.json.data.status, "AMBULANCE_ASSIGNED");
    assert.equal(res.json.data.ambulance.callsign, "MUM-ALS-01");
    // A seeded base-station position is not a live GPS fix: no arrival time is shown for it
    assert.equal(res.json.data.ambulance.gps.state, "NONE");
    assert.equal(res.json.data.ambulance.eta.status, "ESTIMATE");
    assert.equal(res.json.data.ambulance.eta.basis, "BASE_STATION");
    assert.ok(res.json.data.ambulance.etaMinutes >= 1);
    assert.match(res.json.data.ambulance.eta.message, /no live GPS/);
    assert.equal(res.json.data.ambulance.phase, "TO_PATIENT");
    assert.equal(res.json.data.navigation.label, "Navigate to Patient");
    assert.deepEqual(
      [res.json.data.navigation.destination.lat, res.json.data.navigation.destination.lng],
      [19.0021, 72.8425]
    );
    assert.equal(res.json.data.callerPhone, undefined, "citizen view must not expose contact data");

    const citizenSocket = await openSocket();
    citizenSocket.emit("emergency:track", code);

    const crewState = await call("GET", "/ambulance/me", { token: crew.token });
    assert.equal(crewState.json.data.emergency.code, code);
    assert.equal(crewState.json.data.ambulance.status, "DISPATCHED");

    // Invalid fixes are refused and never stored
    for (const bad of [{ lat: 0, lng: 0 }, { lat: 95, lng: 72.8 }, { lat: "x", lng: 72.8 }]) {
      assert.equal((await call("PUT", "/ambulance/location", { token: crew.token, body: bad })).status, 400);
    }

    // Live GPS: the citizen sees the unit exactly where it reported itself, with a labelled estimate
    const moved = waitFor(citizenSocket, "emergency:changed", (p) => p.code === code);
    const fix = await call("PUT", "/ambulance/location", { token: crew.token, body: { lat: 19.0301, lng: 72.8501 } });
    assert.equal(fix.status, 200);
    await moved;
    const live = (await call("GET", `/emergencies/${code}`)).json.data.ambulance;
    assert.equal(live.gps.state, "LIVE");
    assert.deepEqual([live.lat, live.lng], [19.0301, 72.8501]);
    assert.ok(live.eta.minutes >= 1);
    assert.equal(live.eta.status, "ESTIMATE");
    assert.equal(live.eta.method, "STRAIGHT_LINE");
    assert.equal(live.eta.basis, undefined, "live estimates are not base-station estimates");

    const nearby = await call("GET", `/emergencies/${code}/nearby-ambulances`);
    assert.equal(nearby.status, 200);
    assert.equal(nearby.json.data[0].callsign, "MUM-ALS-01");
    assert.equal(nearby.json.data[0].assigned, true);
    assert.ok(nearby.json.data.length > 1);
    assert.ok(nearby.json.data.every((u) => u.crew === undefined));
    assert.match(live.eta.message, /not a road-route time/);

    // The estimate follows the unit: closer to the patient means fewer minutes
    await call("PUT", "/ambulance/location", { token: crew.token, body: { lat: 19.0023, lng: 72.8427 } });
    const closer = (await call("GET", `/emergencies/${code}`)).json.data.ambulance;
    assert.deepEqual([closer.lat, closer.lng], [19.0023, 72.8427]);
    assert.ok(closer.eta.minutes < live.eta.minutes);

    // A stale fix hides the number instead of showing a misleading one
    await db.query(
      "UPDATE ambulances SET last_location_update = NOW() - INTERVAL '20 minutes' WHERE callsign = 'MUM-ALS-01'"
    );
    const stale = (await call("GET", `/emergencies/${code}`)).json.data.ambulance;
    assert.equal(stale.gps.state, "STALE");
    assert.equal(stale.etaMinutes, null);
    assert.match(stale.eta.message, /hidden until a fresh GPS/);
    assert.deepEqual([stale.lat, stale.lng], [19.0023, 72.8427], "last known position is still shown");
    await call("PUT", "/ambulance/location", { token: crew.token, body: { lat: 19.0023, lng: 72.8427 } });

    const changed = waitFor(citizenSocket, "emergency:changed", (p) => p.code === code);
    const saved = await call("POST", "/ambulance/emergency/assessment", {
      token: crew.token,
      body: {
        consciousness: "semi-conscious",
        breathing: "labored",
        pulseStatus: "rapid",
        severeBleeding: true,
        heartRate: 112,
        spo2: 91
      }
    });
    assert.equal(saved.status, 201);
    assert.deepEqual(await changed, { code });

    const tracked = await call("GET", `/emergencies/${code}`);
    assert.equal(tracked.json.data.assessment.breathing, "labored");
    assert.equal(tracked.json.data.statusStep, 3);
  });

  it("lets a hospital decline, and blocks re-querying it", async () => {
    const nearby = await call("GET", "/ambulance/emergency/hospitals", { token: crew.token });
    assert.equal(nearby.status, 200);
    assert.ok(nearby.json.data.length >= 2);
    const distances = nearby.json.data.map((h) => h.distanceKm);
    assert.deepEqual(distances, [...distances].sort((a, b) => a - b), "ordered by distance");

    declinerId = nearby.json.data.find((h) => h.id !== kemId).id;
    const { rows } = await db.query("SELECT seed_key FROM hospitals WHERE hospital_id = $1", [declinerId]);
    decliner = await login("hospital", rows[0].seed_key, passwordFor(rows[0].seed_key));

    const hospitalSocket = await openSocket(decliner.token);
    const notified = waitFor(hospitalSocket, "emergency:changed", (p) => p.code === code);

    const selected = await call("POST", "/ambulance/emergency/select-hospital", {
      token: crew.token,
      body: { hospitalId: declinerId }
    });
    assert.equal(selected.status, 200);
    await notified;

    const requests = await call("GET", "/hospital/requests", { token: decliner.token });
    assert.equal(requests.json.data.length, 1);
    const [request] = requests.json.data;
    assert.equal(request.status, "pending");
    assert.equal(request.emergency.assessment.heartRate, 112);
    assert.equal(request.emergency.callerPhone, undefined);

    // KEM must not see another hospital's request or respond to it
    const kemRequests = await call("GET", "/hospital/requests", { token: hospital.token });
    assert.equal(kemRequests.json.data.length, 0);
    const foreign = await call("POST", `/hospital/requests/${request.responseId}/respond`, {
      token: hospital.token,
      body: { decision: "ACCEPT" }
    });
    assert.equal(foreign.status, 404);

    const noReason = await call("POST", `/hospital/requests/${request.responseId}/respond`, {
      token: decliner.token,
      body: { decision: "DECLINE" }
    });
    assert.equal(noReason.status, 400);

    const declined = await call("POST", `/hospital/requests/${request.responseId}/respond`, {
      token: decliner.token,
      body: { decision: "DECLINE", reason: "ICU at capacity" }
    });
    assert.equal(declined.status, 200);

    const view = await call("GET", `/emergencies/${code}`);
    assert.equal(view.json.data.status, "HOSPITAL_DECLINED");
    assert.equal(view.json.data.hospital.response, "declined");
    assert.equal(view.json.data.hospital.declineReason, "ICU at capacity");

    const again = await call("POST", "/ambulance/emergency/select-hospital", {
      token: crew.token,
      body: { hospitalId: declinerId }
    });
    assert.equal(again.status, 409);

    const twice = await call("POST", `/hospital/requests/${request.responseId}/respond`, {
      token: decliner.token,
      body: { decision: "ACCEPT" }
    });
    assert.equal(twice.status, 409);
  });

  it("reserves an ICU bed on accept and protects reserved stock", async () => {
    const selected = await call("POST", "/ambulance/emergency/select-hospital", {
      token: crew.token,
      body: { hospitalId: kemId }
    });
    assert.equal(selected.status, 200);

    const [request] = (await call("GET", "/hospital/requests", { token: hospital.token })).json.data;
    const accepted = await call("POST", `/hospital/requests/${request.responseId}/respond`, {
      token: hospital.token,
      body: { decision: "ACCEPT" }
    });
    assert.equal(accepted.status, 200);

    const view = await call("GET", `/emergencies/${code}`);
    assert.equal(view.json.data.status, "HOSPITAL_ACCEPTED");
    assert.equal(view.json.data.hospital.response, "accepted");

    const own = await call("GET", "/hospital/me", { token: hospital.token });
    const icu = own.json.data.inventory.find((i) => i.code === "ICU_BED");
    assert.equal(icu.quantity, 3);
    assert.equal(icu.reserved, 1);
    assert.equal(icu.available, 2);

    const tooLow = await call("PATCH", "/hospital/inventory/ICU_BED", {
      token: hospital.token,
      body: { quantity: 0 }
    });
    assert.equal(tooLow.status, 409);
  });

  it("walks the ambulance through every stage and consumes the bed on handover", async () => {
    const step = (s) => call("POST", "/ambulance/emergency/stage", { token: crew.token, body: { step: s } });

    const nav = async () => (await call("GET", `/emergencies/${code}`)).json.data;

    assert.equal((await step("START_TRANSPORT")).status, 409, "must be on scene first");

    // Hospital already accepted, but the patient is not on board: still heading to the patient
    let v = await nav();
    assert.equal(v.ambulance.phase, "TO_PATIENT");
    assert.equal(v.navigation.destination.kind, "PATIENT");
    assert.equal(v.navigation.label, "Navigate to Patient");

    assert.equal((await step("ARRIVE_SCENE")).status, 200);
    v = await nav();
    assert.equal(v.ambulance.phase, "AT_PATIENT");
    assert.equal(v.ambulance.eta.status, "ARRIVED");
    assert.equal(v.navigation.destination.kind, "HOSPITAL", "accepted hospital becomes the destination");
    assert.equal(v.navigation.destination.lat, v.hospital.lat);
    assert.equal(v.navigation.destination.lng, v.hospital.lng);

    assert.equal((await step("HANDOVER")).status, 409);
    assert.equal((await step("START_TRANSPORT")).status, 200);
    v = await nav();
    assert.equal(v.ambulance.phase, "TO_HOSPITAL");
    assert.equal(v.navigation.label, "Navigate to Hospital");
    assert.equal(v.ambulance.eta.to, "HOSPITAL");
    assert.equal(v.ambulance.eta.status, "ESTIMATE", "estimate is from the unit's live position to the hospital");

    assert.equal((await step("ARRIVE_HOSPITAL")).status, 200);
    v = await nav();
    assert.equal(v.ambulance.phase, "AT_HOSPITAL");
    assert.equal(v.navigation.destination, null);
    assert.equal((await step("HANDOVER")).status, 200);

    const view = await call("GET", `/emergencies/${code}`);
    assert.equal(view.json.data.status, "CLOSED");
    assert.equal(view.json.data.isOpen, false);

    const own = await call("GET", "/hospital/me", { token: hospital.token });
    const icu = own.json.data.inventory.find((i) => i.code === "ICU_BED");
    assert.equal(icu.quantity, 2);
    assert.equal(icu.reserved, 0);

    const me = await call("GET", "/ambulance/me", { token: crew.token });
    assert.equal(me.json.data.ambulance.status, "AVAILABLE");
    assert.equal(me.json.data.emergency, null);
  });

  it("queues an out-of-range emergency, dispatches it when a unit frees up, and supports cancel", async () => {
    // Far from every ambulance in the seed fleet
    const far = await call("POST", "/emergencies", {
      body: { type: "Other Emergency", lat: 28.61, lng: 77.2 }
    });
    assert.equal(far.json.data.status, "SEARCHING");
    assert.equal(far.json.data.ambulance, null);

    const cancelled = await call("POST", `/emergencies/${far.json.data.code}/cancel`);
    assert.equal(cancelled.json.data.status, "CANCELLED");
    assert.equal((await call("POST", `/emergencies/${far.json.data.code}/cancel`)).status, 409);

    // Take the only nearby unit offline, report, then bring it back: pending call is auto-dispatched
    const offline = await call("PUT", "/ambulance/availability", {
      token: crew.token,
      body: { status: "OFFLINE" }
    });
    assert.equal(offline.status, 200);
    await db.query("UPDATE ambulances SET status = 'OFFLINE' WHERE callsign <> 'MUM-ALS-01'");

    const waiting = await call("POST", "/emergencies", {
      body: { type: "Breathing Difficulty", lat: 19.0021, lng: 72.8425 }
    });
    assert.equal(waiting.json.data.status, "SEARCHING");

    const waitingSocket = await openSocket();
    waitingSocket.emit("emergency:track", waiting.json.data.code);
    const assigned = waitFor(waitingSocket, "emergency:changed", (p) => p.code === waiting.json.data.code);

    await call("PUT", "/ambulance/availability", { token: crew.token, body: { status: "AVAILABLE" } });
    await assigned;

    const final = await call("GET", `/emergencies/${waiting.json.data.code}`);
    assert.equal(final.json.data.status, "AMBULANCE_ASSIGNED");
    assert.equal(final.json.data.ambulance.callsign, "MUM-ALS-01");

    const busy = await call("PUT", "/ambulance/availability", {
      token: crew.token,
      body: { status: "OFFLINE" }
    });
    assert.equal(busy.status, 409, "cannot go offline mid-emergency");
  });

  it("exposes an immutable audit trail to admins only", async () => {
    const overview = await call("GET", "/admin/overview", { token: adminSession.token });
    assert.equal(overview.status, 200);
    assert.equal(overview.json.data.health.postgis.startsWith("3."), true);
    assert.ok(overview.json.data.stats.totalEmergencies >= 3);

    const logs = await call("GET", "/admin/audit-logs?search=ICU", { token: adminSession.token });
    assert.ok(logs.json.data.length >= 3);
    const actions = logs.json.data.map((l) => l.action).join("\n");
    assert.match(actions, /ICU bed reserved/);
    assert.match(actions, /ICU bed consumed/);

    const csv = await call("GET", "/admin/audit-logs/export", { token: adminSession.token });
    assert.equal(csv.status, 200);
    assert.match(csv.text.split("\r\n")[0], /^id,timestamp,hospital,actor/);

    await assert.rejects(db.query("DELETE FROM audit_logs"), /append-only/);
    await assert.rejects(db.query("UPDATE audit_logs SET action = 'tampered'"), /append-only/);
  });
});

describe("cancellation and fleet", () => {
  const report = (lat = 19.0021, lng = 72.8425, type = "Traffic Accident") =>
    call("POST", "/emergencies", { body: { type, lat, lng } });
  const crewOf = (callsign) => login("ambulance", callsign.toLowerCase(), CREW_PASSWORD);
  const icuReserved = async (hospitalId) =>
    (
      await db.query(
        `SELECT reserved_quantity FROM hospital_inventory hi JOIN resources r USING (resource_id)
         WHERE hi.hospital_id = $1 AND r.resource_code = 'ICU_BED'`,
        [hospitalId]
      )
    ).rows[0].reserved_quantity;
  let kem;
  let kemId;
  let admin;

  before(async () => {
    kem = await login("hospital", "kem_mumbai", passwordFor("kem_mumbai"));
    kemId = kem.user.hospitalId;
    admin = await login("admin", ADMIN_EMAIL, ADMIN_PASSWORD);
    await call("PATCH", "/hospital/inventory/ICU_BED", { token: kem.token, body: { quantity: 5 } });
    // Earlier tests parked the whole fleet offline: restore the seeded availability.
    await db.query(
      `UPDATE ambulances SET status = CASE callsign
         WHEN 'THN-BLS-23' THEN 'OFFLINE' WHEN 'NVM-BLS-26' THEN 'MAINTENANCE' ELSE 'AVAILABLE' END
       WHERE current_emergency_id IS NULL`
    );
  });

  /** Report, assess, ask KEM and have KEM accept: leaves a unit with an accepted hospital. */
  const acceptedCall = async () => {
    const created = await report();
    assert.equal(created.status, 201);
    const code = created.json.data.code;
    const crew = await crewOf(created.json.data.ambulance.callsign);
    await call("POST", "/ambulance/emergency/assessment", {
      token: crew.token,
      body: { consciousness: "conscious", breathing: "normal", pulseStatus: "normal", severeBleeding: false }
    });
    await call("POST", "/ambulance/emergency/select-hospital", { token: crew.token, body: { hospitalId: kemId } });
    const [request] = (await call("GET", "/hospital/requests", { token: kem.token })).json.data.filter(
      (r) => r.status === "pending" && r.emergency.code === code
    );
    const accepted = await call("POST", `/hospital/requests/${request.responseId}/respond`, {
      token: kem.token,
      body: { decision: "ACCEPT" }
    });
    assert.equal(accepted.status, 200);
    return { code, crew, callsign: created.json.data.ambulance.callsign };
  };

  it("citizen cancellation releases the bed and the unit, and tells every screen", async () => {
    const before = await icuReserved(kemId);
    const { code, crew, callsign } = await acceptedCall();
    assert.equal(await icuReserved(kemId), before + 1);

    const crewSocket = await openSocket(crew.token);
    const kemSocket = await openSocket(kem.token);
    const crewNotified = waitFor(crewSocket, "emergency:changed", (p) => p.code === code);
    const kemNotified = waitFor(kemSocket, "emergency:changed", (p) => p.code === code);

    const res = await call("POST", `/emergencies/${code}/cancel`);
    assert.equal(res.status, 200);
    assert.equal(res.json.data.status, "CANCELLED");
    assert.equal(res.json.data.isOpen, false);
    assert.equal(res.json.data.ambulance.lat, null, "a finished call does not keep tracking a unit");
    assert.equal(res.json.data.navigation, null);
    await crewNotified;
    await kemNotified;

    assert.equal(await icuReserved(kemId), before, "ICU reservation released");
    const unit = (await db.query("SELECT status, current_emergency_id FROM ambulances WHERE callsign = $1", [callsign])).rows[0];
    assert.equal(unit.status, "AVAILABLE");
    assert.equal(unit.current_emergency_id, null);
    assert.equal((await call("GET", "/ambulance/me", { token: crew.token })).json.data.emergency, null);

    // The hospital no longer has an active request for it
    const list = (await call("GET", "/hospital/requests", { token: kem.token })).json.data;
    assert.ok(!list.some((r) => r.emergency.code === code && r.status === "pending"));

    // Cancelling twice is refused with a clear reason, and nothing is released twice
    const again = await call("POST", `/emergencies/${code}/cancel`);
    assert.equal(again.status, 409);
    assert.match(again.json.message, /already cancelled/);
    assert.equal(await icuReserved(kemId), before);

    // A cancelled call can no longer be driven by the crew
    const stage = await call("POST", "/ambulance/emergency/stage", { token: crew.token, body: { step: "ARRIVE_SCENE" } });
    assert.equal(stage.status, 409);

    const audit = await call("GET", `/admin/audit-logs?search=${code}`, { token: admin.token });
    assert.ok(audit.json.data.some((l) => /Citizen cancelled/.test(l.action)));
  });

  it("refuses cancellation once transport has started, for citizen and dispatcher", async () => {
    const { code, crew } = await acceptedCall();
    const step = (s) => call("POST", "/ambulance/emergency/stage", { token: crew.token, body: { step: s } });
    assert.equal((await step("ARRIVE_SCENE")).status, 200);
    assert.equal((await step("START_TRANSPORT")).status, 200);

    const citizen = await call("POST", `/emergencies/${code}/cancel`);
    assert.equal(citizen.status, 409);
    assert.match(citizen.json.message, /on the way to the hospital/);

    const dispatcher = await call("POST", `/admin/emergencies/${code}/cancel`, {
      token: admin.token,
      body: { reason: "Duplicate report" }
    });
    assert.equal(dispatcher.status, 409);

    // Still fully active
    const view = await call("GET", `/emergencies/${code}`);
    assert.equal(view.json.data.status, "TRANSPORTING");
    assert.equal(await icuReserved(kemId) >= 1, true);

    assert.equal((await step("ARRIVE_HOSPITAL")).status, 200);
    assert.equal((await step("HANDOVER")).status, 200);
  });

  it("dispatcher cancellation needs a reason, is audited and cannot be repeated", async () => {
    const created = await report();
    const code = created.json.data.code;
    const callsign = created.json.data.ambulance.callsign;

    const none = await call("POST", `/admin/emergencies/${code}/cancel`, { token: admin.token, body: {} });
    assert.equal(none.status, 400);
    const short = await call("POST", `/admin/emergencies/${code}/cancel`, { token: admin.token, body: { reason: "x" } });
    assert.equal(short.status, 400);
    assert.equal((await call("GET", `/emergencies/${code}`)).json.data.status, "AMBULANCE_ASSIGNED", "nothing changed");

    const done = await call("POST", `/admin/emergencies/${code}/cancel`, { token: admin.token, body: { reason: "Prank call" } });
    assert.equal(done.status, 200);
    assert.equal((await call("GET", `/emergencies/${code}`)).json.data.status, "CANCELLED");

    const unit = (await db.query("SELECT status, current_emergency_id FROM ambulances WHERE callsign = $1", [callsign])).rows[0];
    assert.equal(unit.status, "AVAILABLE");
    assert.equal(unit.current_emergency_id, null);

    const repeat = await call("POST", `/admin/emergencies/${code}/cancel`, { token: admin.token, body: { reason: "Prank call" } });
    assert.equal(repeat.status, 409);

    const audit = await call("GET", `/admin/audit-logs?search=${code}`, { token: admin.token });
    const entries = audit.json.data.filter((l) => /Dispatcher cancelled/.test(l.action));
    assert.equal(entries.length, 1, "exactly one audit entry despite the repeated request");
    assert.match(entries[0].action, /Prank call/);

    // Not allowed for non-admins
    assert.equal((await call("POST", `/admin/emergencies/${code}/cancel`, { token: kem.token, body: { reason: "Prank call" } })).status, 403);
  });

  it("only gives a call to an eligible unit: a cancelled call frees it for the next one, never twice", async () => {
    const first = await report();
    const second = await report();
    assert.notEqual(first.json.data.ambulance.callsign, second.json.data.ambulance.callsign);

    // Cancelling the first must not free the unit that works on the second
    await call("POST", `/emergencies/${first.json.data.code}/cancel`);
    const busy = (
      await db.query("SELECT status, current_emergency_id FROM ambulances WHERE callsign = $1", [second.json.data.ambulance.callsign])
    ).rows[0];
    assert.equal(busy.status, "DISPATCHED");
    assert.notEqual(busy.current_emergency_id, null);
    await call("POST", `/emergencies/${second.json.data.code}/cancel`);

    const { rows } = await db.query(
      "SELECT ambulance_id FROM ambulances WHERE current_emergency_id IS NOT NULL GROUP BY ambulance_id HAVING COUNT(*) > 1"
    );
    assert.equal(rows.length, 0);
  });

  it("has the extended demo fleet, and OFFLINE or MAINTENANCE units are never dispatched", async () => {
    // THN-BLS-23 (offline) is stationed in Ulhasnagar and NVM-BLS-26 (maintenance) in Panvel:
    // right at those spots, someone else must be sent.
    for (const [lat, lng, excluded] of [[19.2183, 73.1612, "THN-BLS-23"], [18.9893, 73.1168, "NVM-BLS-26"]]) {
      const created = await report(lat, lng, "Other Emergency");
      assert.equal(created.json.data.status, "AMBULANCE_ASSIGNED");
      assert.notEqual(created.json.data.ambulance.callsign, excluded);
      await call("POST", `/emergencies/${created.json.data.code}/cancel`);
    }

    // The dispatcher cannot force an unavailable unit onto a call either
    const open = await report();
    const offline = (await db.query("SELECT ambulance_id FROM ambulances WHERE callsign = 'THN-BLS-23'")).rows[0].ambulance_id;
    const forced = await call("POST", `/admin/emergencies/${open.json.data.code}/assign`, { token: admin.token, body: { ambulanceId: offline } });
    assert.equal(forced.status, 409);
    await call("POST", `/emergencies/${open.json.data.code}/cancel`);

    // Every added crew can sign in and sees only its own unit
    const crew = await crewOf("NVM-ALS-24");
    assert.equal((await call("GET", "/ambulance/me", { token: crew.token })).json.data.ambulance.callsign, "NVM-ALS-24");

    // Dispatch sees all of them
    const board = await call("GET", "/admin/dispatch", { token: admin.token });
    assert.equal(board.json.data.ambulances.length, 28);
  });

  it("seeding again creates no duplicate units, crews or accounts", async () => {
    const count = async () =>
      (await db.query("SELECT (SELECT COUNT(*) FROM ambulances) a, (SELECT COUNT(*) FROM ambulance_crew) c")).rows[0];
    const statusBefore = (await db.query("SELECT callsign, status FROM ambulances ORDER BY callsign")).rows;
    const before = await count();
    execFileSync("node", ["src/scripts/seedDatabase.js"], { cwd: backendDir, env: process.env, stdio: "pipe" });
    const after = await count();
    assert.deepEqual(after, before);
    assert.deepEqual((await db.query("SELECT callsign, status FROM ambulances ORDER BY callsign")).rows, statusBefore, "re-seeding keeps live status");
  });
});
