import http from "http";

import app from "./app.js";
import pool, { testDatabaseConnection } from "./config/db.js";
import { config } from "./config/env.js";
import { initSocket } from "./realtime/socket.js";

const startServer = async () => {
  await testDatabaseConnection();

  const server = http.createServer(app);

  initSocket(server);

  server.listen(config.port, () => {
    console.log(`Crisis Care backend listening on port ${config.port}`);
  });

  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
