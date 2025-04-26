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
    const query =
        'SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, image_url, image_small_url FROM BOOKS JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id JOIN RATINGS ON BOOKS.id = RATINGS.id WHERE isbn13 = $1;';
    const values = [request.params.name];

    mwValidISBN13;
    pool.query(query, values)
        .then((result) => {
            if (result.rowCount == 1) {
                response.send({
                    entry: result.rows[0],
                });
            } else {
                response.status(404).send({
                    message: 'ISBN not found',
                });
            }
        })
        .catch((error) => {
            //log the error
            console.error('DB Query error on GET /:name');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        });
});

export { bookRouter };
