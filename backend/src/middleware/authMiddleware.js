import jwt from "jsonwebtoken";


/*
|--------------------------------------------------------------------------
| Authentication Middleware
|--------------------------------------------------------------------------
*/

export const authenticate = (
    req,
    res,
    next
) => {

    try {

        const authHeader =
            req.headers.authorization;


        if (!authHeader) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication token required"
            });
        }


        /*
        |--------------------------------------------------------------------------
        | Expected:
        |
        | Authorization: Bearer TOKEN
        |--------------------------------------------------------------------------
        */

        const parts =
            authHeader.split(" ");


        if (
            parts.length !== 2 ||
            parts[0] !== "Bearer"
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authorization format"
            });
        }


        const token =
            parts[1];


        /*
        |--------------------------------------------------------------------------
        | Verify token
        |--------------------------------------------------------------------------
        */

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        /*
        |--------------------------------------------------------------------------
        | Attach user to request
        |--------------------------------------------------------------------------
        */

        req.user = decoded;


        next();

    } catch (error) {

        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired token"
        });
    }
};


/*
|--------------------------------------------------------------------------
| Role Authorization
|--------------------------------------------------------------------------
*/

export const authorize =
    (...allowedRoles) => {

        return (
            req,
            res,
            next
        ) => {

            if (!req.user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Authentication required"
                });
            }


            if (
                !allowedRoles.includes(
                    req.user.role
                )
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Access denied"
                });
            }


            next();
        };
    };