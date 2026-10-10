import { validationResult } from "express-validator";

import { badRequest } from "./AppError.js";

/**
 * Express middleware: turns express-validator failures into a 400 AppError.
 */
export const validate = (req, _res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));

  return next(badRequest("Validation failed", details));
};
