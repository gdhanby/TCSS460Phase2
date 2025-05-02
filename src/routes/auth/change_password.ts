/**
 * @api {patch} /change_password Change the current user's password
 *
 * @apiDescription 
 * Allows an authenticated user to change their password. Uses the following steps:
 * - Verifies the current password is correct.
 * - Validates that both current and new passwords are provided.
 * - Hashes the new password using a new randomly generated salt.
 * - Replaces the existing salted hash and salt in the database.
 *
 * Passwords are stored securely using a salted SHA-512 hash.
 * 
 * The request must come from an authenticated user, with `request.id` populated by middleware.
 * 
 * @apiName PatchChangePassword
 * @apiGroup Auth
 *
 * @apiBody {String} currentPassword The user's current password.
 * @apiBody {String} newPassword The new password the user wants to set.
 *
 * @apiSuccess {String} message Confirmation of successful update.
 *
 * @apiError (400) MissingFields Both fields (currentPassword, newPassword) are required.
 * @apiError (401) IncorrectPassword Current password does not match the stored hash.
 * @apiError (404) UserNotFound No matching account found for the provided ID.
 * @apiError (500) ServerError Unexpected database or server error.
 */

import express, { Request, Response, Router } from 'express';
import { pool, credentialingFunctions, validationFunctions } from '../../core/utilities';

const changePasswordRouter: Router = express.Router();

// Helper functions for credentialing and validation
const generateHash = credentialingFunctions.generateHash;
const generateSalt = credentialingFunctions.generateSalt;
const isStringProvided = validationFunctions.isStringProvided;

// Extended request interface includes user ID set by auth middleware
export interface AuthenticatedRequest extends Request {
    id: number;
}

changePasswordRouter.patch(
    '/change-password',
    async (request: AuthenticatedRequest, response: Response) => {
        const { currentPassword, newPassword } = request.body;

        // Ensure both fields are provided
        if (!isStringProvided(currentPassword) || !isStringProvided(newPassword)) {
            return response.status(400).send({
                message: 'Missing required fields: currentPassword and/or newPassword',
            });
        }

        try {
            // Query the user's stored hash and salt from the database
            const query = `
                SELECT salted_hash, salt
                FROM Account_Credential
                WHERE account_id = $1
            `;
            const values = [request.id];
            const result = await pool.query(query, values);

            // If no matching user, return 404
            if (result.rowCount === 0) {
                return response.status(404).send({ message: 'User not found' });
            }

            const { salted_hash: storedHash, salt } = result.rows[0];

            // Hash the currentPassword using the stored salt
            const providedHash = generateHash(currentPassword, salt);

            // Compare it to the stored hash
            if (providedHash !== storedHash) {
                return response.status(401).send({ message: 'Current password is incorrect' });
            }

            // Generate a new salt and hash the new password
            const newSalt = generateSalt(32);
            const newHashedPassword = generateHash(newPassword, newSalt);

            // Update the database with the new hash and salt
            const updateQuery = `
                UPDATE Account_Credential
                SET salted_hash = $1, salt = $2
                WHERE account_id = $3
            `;
            await pool.query(updateQuery, [newHashedPassword, newSalt, request.id]);

            return response.status(200).send({ message: 'Password updated successfully' });

        } catch (error) {
            // Catch any unexpected server or database errors
            console.error('Error updating password:', error);
            return response.status(500).send({ message: 'Server error - contact support' });
        }
    }
);

export { changePasswordRouter };
