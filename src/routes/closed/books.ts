import express, { NextFunction, Request, Response, Router } from 'express';
import { pool, validationFunctions } from '../../core/utilities';

const bookRouter: Router = express.Router();

function mwValidISBN13(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const isbnString: string = request.params.isbn;
    if (isbnString.length == 13 && /^\d+$/.test(isbnString)) {
        next();
    } else {
        response.status(400).send({
            message:
                'Invalid or missing ISBN13 - please refer to documentation',
        });
    }
}

bookRouter.get('/:isbn', (request: Request, response: Response) => {
    // etc.
});

export { bookRouter };
