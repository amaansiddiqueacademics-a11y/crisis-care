import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import pool from "../config/db.js";


/*
|--------------------------------------------------------------------------
| Generate JWT
|--------------------------------------------------------------------------
*/

export const generateToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
            expiresIn:
                process.env.JWT_EXPIRES_IN || "1d"
        }
    );
};


/*
|--------------------------------------------------------------------------
| Hospital Login
|--------------------------------------------------------------------------
*/

export const loginHospital = async (
    username,
    password
) => {

    const result = await pool.query(
        `
        SELECT
            ha.hospital_admin_id,
            ha.hospital_id,
            ha.username,
            ha.password_hash,
            ha.full_name,
            ha.is_active,

            h.name AS hospital_name,
            h.city,
            h.status AS hospital_status

        FROM hospital_admins ha

        INNER JOIN hospitals h
            ON h.hospital_id = ha.hospital_id

        WHERE ha.username = $1

        LIMIT 1
        `,
        [username]
    );


    if (result.rows.length === 0) {

        throw new Error(
            "Invalid username or password"
        );
    }


    const admin = result.rows[0];


    /*
    |--------------------------------------------------------------------------
    | Check account status
    |--------------------------------------------------------------------------
    */

    if (!admin.is_active) {

        throw new Error(
            "Hospital account is inactive"
        );
    }


    if (
        admin.hospital_status !== "ACTIVE"
    ) {

        throw new Error(
            "Hospital is currently inactive"
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Verify password
    |--------------------------------------------------------------------------
    */

    const passwordValid =
        await bcrypt.compare(
            password,
            admin.password_hash
        );


    if (!passwordValid) {

        throw new Error(
            "Invalid username or password"
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Update last login
    |--------------------------------------------------------------------------
    */

    await pool.query(
        `
        UPDATE hospital_admins

        SET last_login_at = CURRENT_TIMESTAMP

        WHERE hospital_admin_id = $1
        `,
        [admin.hospital_admin_id]
    );


    /*
    |--------------------------------------------------------------------------
    | JWT payload
    |--------------------------------------------------------------------------
    */

    const token = generateToken({
        userId: admin.hospital_admin_id,

        hospitalId: admin.hospital_id,

        username: admin.username,

        role: "HOSPITAL_ADMIN"
    });


    /*
    |--------------------------------------------------------------------------
    | Return safe user information
    |--------------------------------------------------------------------------
    */

    return {

        token,

        user: {

            id: admin.hospital_admin_id,

            hospitalId:
                admin.hospital_id,

            username:
                admin.username,

            fullName:
                admin.full_name,

            role:
                "HOSPITAL_ADMIN",

            hospital: {

                id:
                    admin.hospital_id,

                name:
                    admin.hospital_name,

                city:
                    admin.city
            }
        }
    };
};