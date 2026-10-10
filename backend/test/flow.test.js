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
    assert.ok(res.json.data.ambulance.etaMinutes >= 1);
    assert.equal(res.json.data.callerPhone, undefined, "citizen view must not expose contact data");

    const citizenSocket = await openSocket();
    citizenSocket.emit("emergency:track", code);

    const crewState = await call("GET", "/ambulance/me", { token: crew.token });
    assert.equal(crewState.json.data.emergency.code, code);
    assert.equal(crewState.json.data.ambulance.status, "DISPATCHED");

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

    assert.equal((await step("START_TRANSPORT")).status, 409, "must be on scene first");
    assert.equal((await step("ARRIVE_SCENE")).status, 200);
    assert.equal((await step("HANDOVER")).status, 409);
    assert.equal((await step("START_TRANSPORT")).status, 200);
    assert.equal((await step("ARRIVE_HOSPITAL")).status, 200);
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
