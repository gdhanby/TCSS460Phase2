import express, { Request, Response, Router, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import {
    pool,
    validationFunctions,
    credentialingFunctions,
} from '../../core/utilities';

export interface Auth {
    email: string;
    password: string;
}

export interface IUserRequest extends Request {
    id: number;
}

export interface AuthRequest extends Request {
    auth: Auth;
}

const changePasswordRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;
const generateHash = credentialingFunctions.generateHash;
const generateSalt = credentialingFunctions.generateSalt;

const key = {
    secret: process.env.JSON_WEB_TOKEN,
};
// NOTE: these AuthRequests don't need to be AuthRequests(?)

changePasswordRouter.patch(
    '/changePassword',
    (request: AuthRequest, response: Response, next: NextFunction) => {
        if (
            isStringProvided(request.body.email) &&
            isStringProvided(request.body.oldPassword)
        ) {
            next();
        } else {
            response.status(404).send({
                message: 'Missing required login information.',
            });
        }
    },
    (request: AuthRequest, response: Response, next: NextFunction) => {
        if (isStringProvided(request.body.newPassword)) {
            next();
        } else {
            response.status(404).send({
                message: 'Missing new password information.',
            });
        }
    },
    (request: AuthRequest, response: Response, next: NextFunction) => {
        if (request.body.newPassword === request.body.oldPassword) {
            response.status(400).send({
                message: 'New password must not match old password.',
            });
        } else {
            next();
        }
    },
    (request: AuthRequest, response: Response, next: NextFunction) => {
        const theQuery = `SELECT salted_hash, salt, Account_Credential.account_id, account.Email, account.firstname, account.lastname, account.phone, account.username, account.account_role FROM Account_Credential
                      INNER JOIN Account ON
                      Account_Credential.account_id = Account.account_id 
                      WHERE Account.Email = $1`;
        const values = [request.body.email];
        pool.query(theQuery, values).then((result) => {
            if (result.rowCount == 0) {
                console.error('No user found with given email.');
                response.status(400).send({
                    message: 'Invalid Credentials.',
                });
                return;
            } else if (result.rowCount > 1) {
                console.error('Duplicate database entry error.');
                response.status(500).send({
                    message: 'DB error. Contact support.',
                });
                return;
            }
            const salt = result.rows[0].salt;
            const storedSaltedHash = result.rows[0].salted_hash;
            const providedSaltedHash = generateHash(
                request.body.oldPassword,
                salt
            );
            if (storedSaltedHash === providedSaltedHash) {
                next();
            } else {
                console.error('Password hash does not match.');
                response.status(400).send({
                    message: 'Invalid user credentials.',
                });
                return;
            }
        });
    },
    (request: IUserRequest, response: Response, next: NextFunction) => {
        const theSelectQuery = `SELECT * FROM Account
        WHERE UPPER(Email) LIKE UPPER('%'||$1||'%');`;
        const selectValues = [request.body.email];
        pool.query(theSelectQuery, selectValues)
            .then((result) => {
                // Stashing account ID in request for use in next function
                request.id = result.rows[0].account_id;
                request.body.firstname = result.rows[0].firstname;
                request.body.email = result.rows[0].email;
                next();
            })
            .catch((error) => {
                console.log(error);
                // Maybe add a message status and send portion?
            });
    },
    (request: IUserRequest, response: Response) => {
        const salt = generateSalt(32);
        const newSaltedHash = generateHash(request.body.newPassword, salt);
        const theUpdateQuery = `UPDATE Account_Credential
                                SET salted_hash = $1, salt = $2
                                WHERE Account_ID = $3`;
        const updateValues = [newSaltedHash, salt, request.id];
        pool.query(theUpdateQuery, updateValues).then((result) => {
            if (result.rowCount == 1) {
                const accessToken = jwt.sign(
                    {
                        name: request.body.firstname,
                        id: request.id,
                    },
                    key.secret,
                    {
                        expiresIn: '14 days',
                    }
                );
                response.status(201).send({
                    accessToken,
                    user: {
                        id: request.id,
                        email: request.body.email,
                        name: request.body.firstname,
                        role: 'Admin',
                    },
                });
            } else {
                console.log('row count more than 1 or 0.');
                response.status(400).send({
                    message: 'Error on updating account information.',
                });
            }
        });
    }
);

export { changePasswordRouter };
