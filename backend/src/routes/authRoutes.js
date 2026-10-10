import { Router } from "express";
import { body } from "express-validator";
import rateLimit from "express-rate-limit";

import {
  adminLogin,
  ambulanceLogin,
  hospitalLogin
} from "../controllers/authController.js";
import { validate } from "../utils/validate.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again later." }
});

const credentials = [
  body("username").isString().trim().notEmpty().isLength({ max: 255 }),
  body("password").isString().notEmpty().isLength({ max: 200 }),
  validate
];

router.post("/hospital/login", loginLimiter, credentials, hospitalLogin);
router.post("/ambulance/login", loginLimiter, credentials, ambulanceLogin);
// Admins sign in with their email, sent in the `username` field.
router.post("/admin/login", loginLimiter, credentials, adminLogin);

export default router;
