import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);
app.use(
    "/api/v1/auth",
    authRoutes
);
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Crisis Care Backend API is running"
  });
});

app.get("/api/v1/health", (req, res) => {
  res.json({
    success: true,
    service: "crisis-care-backend",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

export default app;