/**
 * Crisis Care — End-to-end smoke test
 *
 * Tests the full patient + admin flow against the live local stack.
 * Expects all services to be running (node scripts/dev.js).
 *
 * Usage:  node scripts/smoke-test.js
 */

'use strict';

const ROUTING_URL = 'http://localhost:8000';
const GATEWAY_URL = 'http://localhost:4000';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(label)   { console.log(`  ✅ ${label}`); }
function fail(label, err) { console.log(`  ❌ ${label}: ${err}`); process.exitCode = 1; }

async function json(url, opts = {}) {
  const res = await fetch(url, opts);
  const body = await res.json();
  return { status: res.status, body };
}

async function post(url, data) {
  return json(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

async function get(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return json(url, { headers });
}

async function put(url, data, token) {
  return json(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏥 Crisis Care — Smoke Test\n');

  // ──────────────── 1. Health checks ────────────────
  console.log('▸ Health checks');
  {
    const { body } = await get(`${ROUTING_URL}/health`);
    body.status === 'ok' && body.db === 'connected'
      ? ok(`Routing: ${body.status}, db: ${body.db}`)
      : fail('Routing health', JSON.stringify(body));
  }
  {
    const { body } = await get(`${GATEWAY_URL}/health`);
    body.status === 'ok' && body.db === 'connected'
      ? ok(`Gateway: ${body.status}, db: ${body.db}`)
      : fail('Gateway health', JSON.stringify(body));
  }

  // ──────────────── 2. Resource types ────────────────
  console.log('\n▸ Resource types');
  {
    const { body } = await get(`${ROUTING_URL}/resource-types`);
    const types = body.resource_types || [];
    types.length === 18
      ? ok(`${types.length} resource types returned`)
      : fail('Resource types', `Expected 18, got ${types.length}`);
  }

  // ──────────────── 3. Patient /match — real Mumbai location ────────────────
  console.log('\n▸ Patient match (icu_bed near Parel, Mumbai)');
  let matchedHospitalId;
  {
    const { status, body } = await post(`${ROUTING_URL}/match`, {
      lat: 18.975,
      lng: 72.835,
      resource_types: ['icu_bed'],
    });

    if (status === 200 && body.hospital) {
      matchedHospitalId = body.hospital.id;
      ok(`Matched: "${body.hospital.name}" (id=${body.hospital.id})`);
      ok(`Distance: ${body.distance_km} km, ETA: ${body.eta_seconds}s`);

      if (body.route_geometry) {
        ok(`Route geometry present (${body.route_geometry.length} chars polyline6)`);
      } else {
        fail('Route geometry', 'route_geometry is null');
      }
    } else if (status === 200 && body.message) {
      // No match found — not an error, but worth logging
      ok(`No match: "${body.message}" (this is valid if all ICU beds are stale/zero)`);
    } else {
      fail('Patient /match', `HTTP ${status}: ${JSON.stringify(body)}`);
    }
  }

  // ──────────────── 4. Admin login ────────────────
  console.log('\n▸ Admin login');
  let token, hospitalId;
  {
    const { status, body } = await post(`${GATEWAY_URL}/admin/auth/login`, {
      username: 'admin',
      password: 'crisis2024',
    });

    if (status === 200 && body.token) {
      token = body.token;
      hospitalId = body.hospital_id;
      ok(`Login success: hospital_id=${hospitalId}, token=${token.slice(0, 20)}…`);
    } else {
      fail('Admin login', `HTTP ${status}: ${JSON.stringify(body)}`);
      return; // can't continue without a token
    }
  }

  // ──────────────── 5. GET inventory ────────────────
  console.log('\n▸ Admin inventory');
  let resources;
  {
    const { status, body } = await get(`${GATEWAY_URL}/admin/inventory`, token);
    resources = body.resources || [];

    if (status === 200 && resources.length > 0) {
      ok(`${resources.length} resources for hospital ${body.hospital_id}`);
      const icuBed = resources.find(r => r.resource_type === 'icu_bed');
      if (icuBed) ok(`ICU bed current qty: ${icuBed.quantity_available} (id=${icuBed.id})`);
    } else {
      fail('GET inventory', `HTTP ${status}: ${JSON.stringify(body)}`);
    }
  }

  // ──────────────── 6. PUT inventory — change a quantity ────────────────
  console.log('\n▸ Admin inventory update');
  const targetResource = resources.find(r => r.resource_type === 'icu_bed');
  if (!targetResource) {
    fail('PUT inventory', 'No icu_bed resource found');
    return;
  }

  const newQty = targetResource.quantity_available === 99 ? 100 : 99;
  {
    const { status, body } = await put(
      `${GATEWAY_URL}/admin/inventory/${targetResource.id}`,
      { quantity_available: newQty },
      token,
    );

    if (status === 200 && body.resource) {
      ok(`Updated resource ${targetResource.id}: qty ${targetResource.quantity_available} → ${body.resource.quantity_available}`);
    } else {
      fail('PUT inventory', `HTTP ${status}: ${JSON.stringify(body)}`);
    }
  }

  // ──────────────── 7. Verify the admin edit is visible to the next patient /match ────────────────
  console.log('\n▸ Cross-service verification');
  if (hospitalId) {
    const { body: inv } = await get(`${GATEWAY_URL}/admin/inventory`, token);
    const updatedResource = (inv.resources || []).find(r => r.id === targetResource.id);

    if (updatedResource && updatedResource.quantity_available === newQty) {
      ok(`DB confirms: resource ${targetResource.id} qty = ${newQty}`);
    } else {
      fail('DB verify', `Expected qty ${newQty}, got ${updatedResource?.quantity_available}`);
    }

    // Zero out ICU beds at the admin hospital — routing reads the same DB with no cache.
    const zeroedQty = 0;
    {
      const { status, body } = await put(
        `${GATEWAY_URL}/admin/inventory/${targetResource.id}`,
        { quantity_available: zeroedQty },
        token,
      );
      if (status === 200 && body.resource?.quantity_available === zeroedQty) {
        ok(`Zeroed ICU beds at hospital ${hospitalId} (qty → 0)`);
      } else {
        fail('Zero inventory', `HTTP ${status}: ${JSON.stringify(body)}`);
      }
    }

    const { status, body } = await post(`${ROUTING_URL}/match`, {
      lat: 18.975,
      lng: 72.835,
      resource_types: ['icu_bed'],
    });

    if (status === 200) {
      if (body.hospital && body.hospital.id === hospitalId) {
        fail('Post-zero /match', `Admin hospital ${hospitalId} still matched after ICU qty set to 0`);
      } else if (body.hospital) {
        ok(`Post-zero /match skipped admin hospital ${hospitalId} — matched id=${body.hospital.id} "${body.hospital.name}"`);
      } else {
        ok('Post-zero /match returned no match (all nearby ICU beds unavailable — valid)');
      }
    } else {
      fail('Post-zero /match', `HTTP ${status}: ${JSON.stringify(body)}`);
    }

    // Restore inventory so repeated smoke runs stay idempotent
    {
      const { status } = await put(
        `${GATEWAY_URL}/admin/inventory/${targetResource.id}`,
        { quantity_available: targetResource.quantity_available },
        token,
      );
      status === 200
        ? ok(`Restored ICU bed qty to ${targetResource.quantity_available}`)
        : fail('Restore inventory', `HTTP ${status}`);
    }
  }

  // ──────────────── 8. 401 handling — invalid token ────────────────
  console.log('\n▸ Auth enforcement');
  {
    const { status } = await get(`${GATEWAY_URL}/admin/inventory`, 'invalid-token');
    status === 401
      ? ok('GET /admin/inventory with bad token → 401')
      : fail('Auth enforcement', `Expected 401, got ${status}`);
  }
  {
    const { status } = await get(`${GATEWAY_URL}/admin/inventory`);
    status === 401
      ? ok('GET /admin/inventory with no token → 401')
      : fail('Auth enforcement', `Expected 401, got ${status}`);
  }

  // ──────────────── Summary ────────────────
  console.log(`\n${'═'.repeat(50)}`);
  if (process.exitCode) {
    console.log('❌ Some tests failed — see above.');
  } else {
    console.log('✅ All smoke tests passed!');
  }
  console.log(`${'═'.repeat(50)}\n`);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
