import http from "http";

import app from "./app.js";
import { testDatabaseConnection } from "./config/db.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await testDatabaseConnection();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(
        `Crisis Care Backend running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

startServer();