import { Router } from "express";

import {
    hospitalLogin
} from "../controllers/authController.js";


const router = Router();


/*
|--------------------------------------------------------------------------
| Hospital Authentication
|--------------------------------------------------------------------------
*/

router.post(
    "/hospital/login",
    hospitalLogin
);


export default router;