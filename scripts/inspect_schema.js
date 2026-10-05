#!/usr/bin/env node
'use strict';
const { Client } = require('pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care'
});
c.connect().then(async () => {
  const { rows } = await c.query(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`
  );
  rows.forEach(r =>
    console.log(r.table_name.padEnd(22) + r.column_name.padEnd(32) + r.data_type)
  );
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
