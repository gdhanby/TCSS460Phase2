import express, { NextFunction, Request, Response, Router } from 'express';
import { pool, validationFunctions } from '../../core/utilities';

const bookRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;
const isNumberProvided = validationFunctions.isNumberProvided;

const formatKeep = (resultRow) => ({
    ...resultRow,
    formatted: `${resultRow.isbn13}, ${resultRow.authors}, ${resultRow.publication_year},
    ${resultRow.original_title}, ${resultRow.title}, ${resultRow.rating_1},
    ${resultRow.rating_2}, ${resultRow.rating_3}, ${resultRow.rating_4},
    ${resultRow.rating_5}, ${resultRow.image_url}, ${resultRow.image_small_url}`,
});

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

function mwValidBookEntry(
    request: Request,
    response: Response,
    next: NextFunction
) {
    if (
        isNumberProvided(request.body.isbn13) &&
        isStringProvided(request.body.authors) &&
        isNumberProvided(request.body.publication_year) && 
        isStringProvided(request.body.original_title) &&
        isStringProvided(request.body.title) &&
        isNumberProvided(request.body.rating_1) &&
        isNumberProvided(request.body.rating_2) &&
        isNumberProvided(request.body.rating_3) &&
        isNumberProvided(request.body.rating_4) &&
        isNumberProvided(request.body.rating_5) &&
        isStringProvided(request.body.image_url) &&
        isStringProvided(request.body.image_small_url)
    ) {
        next();
    } else {
        console.error('Missing required information');
        response.status(400).send({
            message:
                'Missing required information - please refer to documentation',
        });
    }
}

bookRouter.get('/:isbn', mwValidISBN13, (request: Request, response: Response) => {
    const query =
        'SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, image_url, image_small_url FROM BOOKS JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id JOIN RATINGS ON BOOKS.id = RATINGS.id WHERE isbn13 = $1;';
    const values = [request.params.isbn];

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
            console.error('DB Query error on GET /:isbn');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        });
});

bookRouter.get('/', (request: Request, response: Response) => {
    const query = 'SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, image_url, image_small_url FROM BOOKS JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id JOIN RATINGS ON BOOKS.id = RATINGS.id WHERE authors LIKE "%$1%";'
    const values = [request.query.author];

    pool.query(query, values)
        .then((result) => {
            if (result.rowCount > 0) {
                response.send({
                    entries: result.rows.map(formatKeep),
                });
            } else {
                response.status(404).send({
                    message: 'Author not found',
                });
            }
        })
        .catch((error) => {
            //log the error
            console.error('DB Query error on GET /');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        });
});

bookRouter.post('/', mwValidBookEntry, (request: Request, response: Response) => {
    const theQuery = 'INSERT INTO BOOKS(isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, image_url, image_small_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *'
    const theValues = [request.body.isbn13, request.body.authors, request.body.publication_year, request.body.original_title, request.body.title, request.body.rating_1, request.body.rating_2, request.body.rating_3, request.body.rating_4, request.body.rating_5, request.body.image_url, request.body.image_small_url];

    pool.query(theQuery, theValues)
        .then((result) => {
            response.status(201).send({
                entry: formatKeep(result.rows[0]),
            });
        })
        .catch((error) => {
            if (
                error.detail != undefined &&
                (error.detail as string).endsWith('already exists.')
            ) {
                console.error('ISBN exists');
                response.status(400).send({
                    message: 'ISBN exists',
                });
            } else {
                //log the error
                console.error('DB Query error on POST');
                console.error(error);
                response.status(500).send({
                    message: 'server error - contact support',
                });
            }
        });
});


export { bookRouter };
