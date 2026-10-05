#!/usr/bin/env node
/**
 * Crisis Care — Local Dev Orchestrator
 *
 * Starts the entire stack with one command:
 *
 *   1. Ensures Docker Postgres+PostGIS is running
 *   2. Bootstraps .env files (shared DATABASE_URL + JWT_SECRET)
 *   3. Runs migrations (idempotent)
 *   4. Seeds Mumbai hospitals + inventory + admin users (idempotent)
 *   5. Starts backend/gateway        → http://localhost:4000
 *   6. Starts services/routing       → http://localhost:8000
 *   7. Starts frontend/patient-app   → http://localhost:5173
 *   8. Starts frontend/admin-dashboard → http://localhost:5174
 *
 * Usage:
 *   node scripts/dev.js
 *   npm run dev                (from project root)
 *
 * Ctrl+C stops all services.
 */

'use strict';

const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

const SHARED_DATABASE_URL =
  'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care';

// ── Color codes for log prefixes ────────────────────────────────────────────
const COLORS = {
  reset:   '\x1b[0m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  gray:    '\x1b[90m',
};

const SERVICES = [
  { name: 'gateway',   color: COLORS.cyan,    cwd: 'backend/gateway',          cmd: 'node', args: ['index.js'] },
  { name: 'routing',   color: COLORS.magenta, cwd: 'services/routing',         cmd: null, args: null },
  { name: 'admin',     color: COLORS.yellow,  cwd: 'frontend/frontend', cmd: 'npx', args: ['vite', '--port', '5174', '--host', '127.0.0.1'] },
];

const children = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(prefix, color, msg) {
  const tag = `${color}[${prefix}]${COLORS.reset}`;
  msg.toString().split('\n').forEach(line => {
    if (line.trim()) console.log(`${tag} ${line}`);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function run(label, cmd, opts = {}) {
  log('dev', COLORS.gray, `Running: ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', ...opts });
  } catch (err) {
    log('dev', COLORS.red, `${label} failed: ${err.stderr?.toString() || err.message}`);
    throw err;
  }
}

function readEnvValue(envPath, key) {
  if (!fs.existsSync(envPath)) return null;
  const match = fs.readFileSync(envPath, 'utf8').match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

function writeEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, 'm').test(content)) {
    return content.replace(new RegExp(`^${key}=.*$`, 'm'), line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

/**
 * Ensure a service .env exists. Creates from .env.example on first run.
 * Shared JWT_SECRET is generated once and reused across backend services.
 */
function ensureEnvFile(relDir, sharedJwtSecret) {
  const dir = path.join(ROOT, relDir);
  const examplePath = path.join(dir, '.env.example');
  const envPath = path.join(dir, '.env');

  if (!fs.existsSync(examplePath)) {
    log('dev', COLORS.yellow, `No .env.example in ${relDir} — skipping`);
    return;
  }

  let content;
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
    log('dev', COLORS.gray, `Using existing ${relDir}/.env`);
  } else {
    content = fs.readFileSync(examplePath, 'utf8');
    log('dev', COLORS.green, `Created ${relDir}/.env from .env.example`);
  }

  content = writeEnvValue(content, 'DATABASE_URL', SHARED_DATABASE_URL);
  if (content.includes('JWT_SECRET=')) {
    const current = content.match(/^JWT_SECRET=(.+)$/m)?.[1]?.trim();
    if (!current || current === 'replace_with_a_secure_random_string') {
      content = writeEnvValue(content, 'JWT_SECRET', sharedJwtSecret);
    }
  }

  fs.writeFileSync(envPath, content);
}

function ensureFrontendEnv(relDir, mapboxToken) {
  const dir = path.join(ROOT, relDir);
  const examplePath = path.join(dir, '.env.example');
  const envPath = path.join(dir, '.env');

  if (!fs.existsSync(examplePath)) return;

  let content;
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  } else {
    content = fs.readFileSync(examplePath, 'utf8');
    log('dev', COLORS.green, `Created ${relDir}/.env from .env.example`);
  }

  const currentToken = content.match(/^VITE_MAPBOX_TOKEN=(.+)$/m)?.[1]?.trim();
  if (!currentToken || currentToken.includes('your_mapbox')) {
    content = writeEnvValue(content, 'VITE_MAPBOX_TOKEN', mapboxToken);
  }

  fs.writeFileSync(envPath, content);
}

function ensureDependencies() {
  const checks = [
    { label: 'root', cwd: ROOT, marker: 'node_modules/pg' },
    { label: 'gateway', cwd: path.join(ROOT, 'backend/gateway'), marker: 'node_modules/express' },
    { label: 'admin-dashboard', cwd: path.join(ROOT, 'frontend/frontend'), marker: 'node_modules/vite' },
  ];

  for (const { label, cwd, marker } of checks) {
    if (!fs.existsSync(path.join(cwd, marker))) {
      log('dev', COLORS.yellow, `Installing ${label} dependencies…`);
      execSync('npm install', { cwd, stdio: 'inherit' });
    }
  }

  const routingDir = path.join(ROOT, 'services/routing');
  const isWindows = process.platform === 'win32';
  const venvPython = isWindows
    ? path.join(routingDir, 'venv', 'Scripts', 'python.exe')
    : path.join(routingDir, 'venv', 'bin', 'python');

  if (!fs.existsSync(venvPython)) {
    log('dev', COLORS.yellow, 'Creating Python venv for routing service…');
    execSync('python -m venv venv', { cwd: routingDir, stdio: 'inherit' });
    execSync(`"${venvPython}" -m pip install -r requirements.txt`, {
      cwd: routingDir,
      stdio: 'inherit',
      shell: isWindows,
    });
  }
}

function spawnService(svc) {
  const cwd = path.join(ROOT, svc.cwd);
  const isWindows = process.platform === 'win32';

  let cmd = svc.cmd;
  let args = svc.args;

  if (svc.name === 'routing') {
    const venvPython = isWindows
      ? path.join(cwd, 'venv', 'Scripts', 'python.exe')
      : path.join(cwd, 'venv', 'bin', 'python');

    if (!fs.existsSync(venvPython)) {
      log(svc.name, svc.color, `ERROR: Python venv not found at ${venvPython}`);
      process.exit(1);
    }

    cmd = venvPython;
    args = ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'];
  }

  log(svc.name, svc.color, `Starting in ${svc.cwd}...`);

  const child = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: svc.name !== 'routing' && isWindows,
    env: {
      ...process.env,
      DATABASE_URL: SHARED_DATABASE_URL,
      FORCE_COLOR: '1',
    },
  });

  child.stdout.on('data', (d) => log(svc.name, svc.color, d));
  child.stderr.on('data', (d) => log(svc.name, svc.color, d));
  child.on('exit', (code) => {
    log(svc.name, svc.color, `Exited with code ${code}`);
  });

  children.push(child);
  return child;
}

async function waitForPostgres(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = execSync('docker inspect -f "{{.State.Health.Status}}" crisis-care-db', {
        cwd: ROOT, stdio: 'pipe', encoding: 'utf8',
      }).trim();
      if (status.includes('healthy')) return;
    } catch (_) {}
    await sleep(2000);
  }
  throw new Error('Postgres did not become healthy in time');
}

// ── Graceful shutdown ───────────────────────────────────────────────────────

function shutdown() {
  log('dev', COLORS.gray, 'Shutting down all services...');
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch (_) {}
  }
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${COLORS.blue}╔═══════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.blue}║   🏥 Crisis Care — Local Dev Stack        ║${COLORS.reset}`);
  console.log(`${COLORS.blue}╚═══════════════════════════════════════════╝${COLORS.reset}\n`);

  ensureDependencies();

  // Shared JWT for gateway + routing (.env.example placeholders)
  const gatewayEnv = path.join(ROOT, 'backend/gateway/.env');
  const existingJwt =
    readEnvValue(gatewayEnv, 'JWT_SECRET') ||
    readEnvValue(path.join(ROOT, 'services/routing/.env'), 'JWT_SECRET');
  const jwtSecret =
    existingJwt && existingJwt !== 'replace_with_a_secure_random_string'
      ? existingJwt
      : crypto.randomBytes(32).toString('hex');

  ensureEnvFile('backend/gateway', jwtSecret);
  ensureEnvFile('services/routing', jwtSecret);

  const mapboxFromGateway =
    readEnvValue(gatewayEnv, 'MAPBOX_API_KEY') ||
    readEnvValue(path.join(ROOT, 'backend/gateway/.env.example'), 'MAPBOX_API_KEY');
  ensureFrontendEnv('frontend/frontend', mapboxFromGateway);

  log('dev', COLORS.gray, `DATABASE_URL → ${SHARED_DATABASE_URL}`);

  // 1. Docker Postgres
  log('dev', COLORS.gray, 'Checking Docker Postgres container...');
  try {
    const status = execSync('docker inspect -f "{{.State.Health.Status}}" crisis-care-db', {
      cwd: ROOT, stdio: 'pipe', encoding: 'utf8',
    }).trim();
    if (status.includes('healthy')) {
      log('dev', COLORS.green, '✓ Postgres container is running and healthy');
    } else {
      log('dev', COLORS.yellow, `Container status: ${status} — starting...`);
      run('docker-compose', 'docker-compose up -d');
      await waitForPostgres();
      log('dev', COLORS.green, '✓ Postgres is ready');
    }
  } catch {
    log('dev', COLORS.yellow, 'Container not found — starting docker-compose...');
    run('docker-compose', 'docker-compose up -d');
    await waitForPostgres();
    log('dev', COLORS.green, '✓ Postgres is ready');
  }

  // 2. Migrations
  log('dev', COLORS.gray, 'Running migrations...');
  try {
    const out = execSync('node scripts/migrate.js', {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: SHARED_DATABASE_URL },
    });
    log('migrate', COLORS.gray, out);
  } catch (err) {
    log('migrate', COLORS.red, err.stdout?.toString() || err.message);
  }

  // 3. Seed data (idempotent)
  log('dev', COLORS.gray, 'Seeding Mumbai hospitals...');
  try {
    const seedOut = execSync('node scripts/data-import/import_hospitals.js --seed', {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: SHARED_DATABASE_URL },
    });
    log('seed', COLORS.gray, seedOut.trim());
  } catch (err) {
    log('seed', COLORS.yellow, `Hospital seed: ${err.stdout?.toString() || err.message}`);
  }

  log('dev', COLORS.gray, 'Seeding inventory...');
  try {
    const invOut = execSync('node scripts/synthetic-data/generate_inventory.js', {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: SHARED_DATABASE_URL },
    });
    log('seed', COLORS.gray, invOut.trim());
  } catch (err) {
    log('seed', COLORS.yellow, `Inventory seed: ${err.message}`);
  }

  log('dev', COLORS.gray, 'Seeding admin users...');
  try {
    const admOut = execSync('node backend/gateway/scripts/seed-admin.js', {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: SHARED_DATABASE_URL },
    });
    log('seed', COLORS.gray, admOut.trim());
  } catch (err) {
    log('seed', COLORS.yellow, `Admin seed: ${err.message}`);
  }

  // 4. Start all services
  console.log('');
  log('dev', COLORS.blue, '═══ Starting services ═══');
  console.log('');

  for (const svc of SERVICES) {
    spawnService(svc);
  }

  setTimeout(() => {
    console.log('');
    log('dev', COLORS.blue, '═══════════════════════════════════════════');
    log('dev', COLORS.yellow,  '  Dispatch Console: http://localhost:5174');
    log('dev', COLORS.cyan,    '  Gateway API:      http://localhost:4000');
    log('dev', COLORS.magenta, '  Routing API:      http://localhost:8000');
    log('dev', COLORS.gray,    '  Postgres:         localhost:5433');
    log('dev', COLORS.blue, '═══════════════════════════════════════════');
    console.log('');
    log('dev', COLORS.gray,  '  Admin login: admin / crisis2024');
    log('dev', COLORS.gray,  '  Smoke test:  npm run test:smoke');
    log('dev', COLORS.gray,  '  Press Ctrl+C to stop all services');
    console.log('');
  }, 3000);
}

main().catch(err => {
  console.error(`\n${COLORS.red}[dev] Fatal: ${err.message}${COLORS.reset}\n`);
  shutdown();
});
