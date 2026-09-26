import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on("connect", () => {
  console.log("PostgreSQL client connected");
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

export const testDatabaseConnection = async () => {
  try {
    const result = await pool.query("SELECT NOW()");

    console.log(
      "PostgreSQL connected:",
      result.rows[0].now
    );
  } catch (error) {
    console.error(
      "PostgreSQL connection failed:",
      error.message
    );

    process.exit(1);
  }
};

export default pool;