import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

const app = express();

if (config.trustProxy) {
  app.set("trust proxy", 1);
}

app.use(helmet());

app.use(
  cors({
    origin: config.frontendOrigins,
    credentials: true
  })
);

// Large enough for one compressed photo attached to an emergency report.
app.use(express.json({ limit: "600kb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(config.isProduction ? "combined" : "dev"));
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." }
});

app.get("/", (_req, res) => {
  res.json({ success: true, message: "Crisis Care Backend API is running" });
});

app.use("/api/v1", apiLimiter, apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
