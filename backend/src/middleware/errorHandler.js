import { AppError } from "../utils/AppError.js";
import { config } from "../config/env.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

// Postgres error codes that mean "the client sent something unusable".
const PG_CLIENT_ERRORS = {
  "23505": [409, "Resource already exists"],
  "23503": [400, "Referenced resource does not exist"],
  "23514": [400, "Value violates a data constraint"],
  "22P02": [400, "Malformed value"]
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.details ? { errors: error.details } : {})
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  const pgMapping = PG_CLIENT_ERRORS[error.code];

  if (pgMapping) {
    return res.status(pgMapping[0]).json({ success: false, message: pgMapping[1] });
  }

  console.error(error);

  return res.status(500).json({
    success: false,
    message: config.isProduction ? "Internal server error" : error.message
  });
};
