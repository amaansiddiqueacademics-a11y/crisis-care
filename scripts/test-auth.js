/**
 * Crisis Care — Auth endpoint acceptance test
 *
 * Tests all four acceptance criteria for the login fix:
 *   1. Wrong username  → 401 + JSON (not 500)
 *   2. Wrong password  → 401 + JSON (not 500)
 *   3. Correct creds   → 200 + JWT + hospital_id
 *   4. JWT_SECRET missing → tested manually (fail-fast at startup)
 */

'use strict';

const GATEWAY = 'http://localhost:4000';

function ok(msg)   { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); process.exitCode = 1; }

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  console.log('\n🔐 Auth Endpoint — Acceptance Tests\n');

  // 1. Wrong username → 401
  console.log('▸ Wrong username');
  {
    const { status, body } = await post(`${GATEWAY}/admin/auth/login`, {
      username: 'nonexistent_user',
      password: 'whatever',
    });
    if (status === 401 && body.error === 'Invalid credentials') {
      ok(`HTTP ${status}: "${body.error}"`);
    } else {
      fail(`Expected 401, got HTTP ${status}: ${JSON.stringify(body)}`);
    }
  }

  // 2. Wrong password → 401
  console.log('\n▸ Wrong password (correct username)');
  {
    const { status, body } = await post(`${GATEWAY}/admin/auth/login`, {
      username: 'admin',
      password: 'wrong_password_here',
    });
    if (status === 401 && body.error === 'Invalid credentials') {
      ok(`HTTP ${status}: "${body.error}"`);
    } else {
      fail(`Expected 401, got HTTP ${status}: ${JSON.stringify(body)}`);
    }
  }

  // 3. Correct credentials → 200 + token + hospital_id
  console.log('\n▸ Correct credentials');
  {
    const { status, body } = await post(`${GATEWAY}/admin/auth/login`, {
      username: 'admin',
      password: 'crisis2024',
    });
    if (status === 200 && body.token && body.hospital_id) {
      ok(`HTTP ${status}: token=${body.token.slice(0, 20)}… hospital_id=${body.hospital_id}`);
    } else {
      fail(`Expected 200+token, got HTTP ${status}: ${JSON.stringify(body)}`);
    }
  }

  // 4. Missing fields → 400
  console.log('\n▸ Missing fields');
  {
    const { status, body } = await post(`${GATEWAY}/admin/auth/login`, {});
    if (status === 400) {
      ok(`HTTP ${status}: "${body.error}"`);
    } else {
      fail(`Expected 400, got HTTP ${status}: ${JSON.stringify(body)}`);
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(50)}`);
  if (process.exitCode) {
    console.log('❌ Some tests failed.');
  } else {
    console.log('✅ All auth tests passed!');
  }
  console.log(`${'═'.repeat(50)}\n`);
}

main().catch(err => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
