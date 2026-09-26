import {
    loginHospital
} from "../services/authService.js";


/*
|--------------------------------------------------------------------------
| Hospital Login Controller
|--------------------------------------------------------------------------
*/

export const hospitalLogin = async (
    req,
    res
) => {

    try {

        const {
            username,
            password
        } = req.body;


        /*
        |--------------------------------------------------------------------------
        | Validation
        |--------------------------------------------------------------------------
        */

        if (
            !username ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Username and password are required"
            });
        }


        /*
        |--------------------------------------------------------------------------
        | Login
        |--------------------------------------------------------------------------
        */

        const result =
            await loginHospital(
                username,
                password
            );


        /*
        |--------------------------------------------------------------------------
        | Response
        |--------------------------------------------------------------------------
        */

        return res.status(200).json({

            success: true,

            message:
                "Hospital login successful",

            data: result
        });

    } catch (error) {

        console.error(
            "Hospital login error:",
            error.message
        );


        return res.status(401).json({

            success: false,

            message:
                error.message
        });
    }
};