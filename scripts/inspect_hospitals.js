#!/usr/bin/env node
'use strict';
const { Client } = require('pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://crisis_user:crisis_password@localhost:5433/crisis_care'
});
c.connect().then(async () => {
  const { rows } = await c.query(`
    SELECT column_name, character_maximum_length, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hospitals'
    ORDER BY ordinal_position
  `);
  rows.forEach(r =>
    console.log(r.column_name.padEnd(20), r.data_type.padEnd(25), 'max_len:', r.character_maximum_length)
  );
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
