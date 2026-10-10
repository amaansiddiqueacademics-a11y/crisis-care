import pg from "pg";

import { config } from "./env.js";

const { Pool } = pg;

// Return BIGINT/COUNT values as numbers (ids and counts here are far below 2^53).
pg.types.setTypeParser(20, (value) => Number(value));

const pool = new Pool({
  connectionString: config.databaseUrl
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

export const testDatabaseConnection = async () => {
  const result = await pool.query(
    "SELECT NOW() AS now, PostGIS_Version() AS postgis"
  );

  console.log(
    `PostgreSQL connected (PostGIS ${result.rows[0].postgis})`
  );
};

/**
 * Run `work(client)` inside a transaction; commits on success, rolls back on error.
 */
export const withTransaction = async (work) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
