import express, { NextFunction, Request, Response, Router } from 'express';
import { pool, validationFunctions } from '../../core/utilities';

const bookRouter: Router = express.Router();

bookRouter.get('/:isbn', (request: Request, response: Response) => {
    // etc.
});

export { bookRouter };
