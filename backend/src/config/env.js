import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

const requireEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`
    );
  }

  return value;
};

const jwtSecret = requireEnv("JWT_SECRET");

if (isProduction && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production.");
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 5000,
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  frontendOrigins: (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === "true",

  // Dispatch tuning. ETA is an estimate from straight-line distance / average speed.
  dispatchRadiusKm: Number(process.env.DISPATCH_RADIUS_KM) || 60,
  hospitalSearchRadiusKm: Number(process.env.HOSPITAL_SEARCH_RADIUS_KM) || 80,
  avgSpeedKmh: Number(process.env.AVG_SPEED_KMH) || 30,

  // Rate limits
  emergencyRateLimit: Number(process.env.EMERGENCY_RATE_LIMIT) || 15
};
