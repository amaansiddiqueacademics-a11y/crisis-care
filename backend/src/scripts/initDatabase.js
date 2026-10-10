import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import pool from "../config/db.js";

const schemaFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../database/schema.sql"
);

/**
 * Applies database/schema.sql. The file is idempotent (IF NOT EXISTS / OR REPLACE).
 */
try {
  await pool.query(fs.readFileSync(schemaFile, "utf-8"));
  console.log("Database schema applied.");
} catch (error) {
  console.error("Failed to apply schema:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
