import express, { NextFunction, Request, Response, Router } from 'express';
import { pool, validationFunctions } from '../../core/utilities';

const bookRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;
const validISBN13 = validationFunctions.validISBN13;
const validRatingOrYear = validationFunctions.validRatingOrYear;

const formatKeep = (resultRow) => ({
    ...resultRow,
    formatted: `${resultRow.isbn13}, ${resultRow.authors}, ${resultRow.publication_year}, ${resultRow.original_title}, ${resultRow.title}, ${resultRow.rating_1}, ${resultRow.rating_2}, ${resultRow.rating_3}, ${resultRow.rating_4}, ${resultRow.rating_5}, ${resultRow.rating_count}, ${resultRow.rating_avg}, ${resultRow.image_url}, ${resultRow.image_small_url}`,
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

function mwValidAuthorQuery(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const author: string = request.query.author as string;
    if (isStringProvided(author)) {
        next();
    } else {
        console.error('Invalid or missing Author');
        response.status(400).send({
            message:
                'Invalid or missing Author - please refer to documentation',
        });
    }
}

function mwValidBookEntry(
    request: Request,
    response: Response,
    next: NextFunction
) {
    if (
        /* User must provide isbn, authors, pub year, original title, title, all individual rating counts.
        If a link to an image is provided, they must provide a link to both a big and small version. */
        validISBN13(request.body.isbn13) &&
        isStringProvided(request.body.authors) &&
        validRatingOrYear(request.body.publication_year) &&
        isStringProvided(request.body.original_title) &&
        isStringProvided(request.body.title) &&
        validRatingOrYear(request.body.rating_1) &&
        validRatingOrYear(request.body.rating_2) &&
        validRatingOrYear(request.body.rating_3) &&
        validRatingOrYear(request.body.rating_4) &&
        validRatingOrYear(request.body.rating_5) &&
        ((isStringProvided(request.body.image_small_url) &&
            isStringProvided(request.body.image_url)) ||
            (!isStringProvided(request.body.image_small_url) &&
                !isStringProvided(request.body.image_url)))
    ) {
        next();
    } else {
        console.error('Missing required information');
        response.status(400).send({
            message:
                'Missing or malformed required information - please refer to documentation',
        });
    }
}

bookRouter.get(
    '/:isbn',
    mwValidISBN13,
    (request: Request, response: Response) => {
        const query = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, rating_count, rating_avg, image_url, image_small_url 
            FROM BOOKS 
            JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id 
            JOIN RATINGS ON BOOKS.id = RATINGS.id 
            WHERE isbn13 = $1;`;
        const values = [request.params.isbn];

        pool.query(query, values)
            .then((result) => {
                if (result.rowCount == 1) {
                    response.send({
                        entry: formatKeep(result.rows[0]),
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
    }
);

bookRouter.get(
    '/',
    mwValidAuthorQuery,
    (request: Request, response: Response) => {
        const query = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, rating_count, rating_avg, image_url, image_small_url 
            FROM BOOKS 
            JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id 
            JOIN RATINGS ON BOOKS.id = RATINGS.id 
            WHERE UPPER(BOOKAUTHORS.authors) LIKE UPPER('%'||$1||'%');`;
        const values = [request.query.author];

        pool.query(query, values)
            .then((result) => {
                if (result.rowCount > 0) {
                    response.send({
                        entries: result.rows.map(formatKeep),
                    });
                } else {
                    response.status(404).send({
                        message:
                            'No books found. Try a different author query.',
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
    }
);

bookRouter.post(
    '/',
    mwValidBookEntry,
    async (request: Request, response: Response) => {
        const imageUrl = request.body.image_url || null;
        const imageSmallUrl = request.body.image_small_url || null;
        /* Inserting a book requires several queries, so we need to grab one client from the pool and run a transaction.
        Running a transaction on pool.query is not the way to go. */
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const booksInsert = `INSERT INTO BOOKS (isbn13, publication_year, original_title, title, image_url, image_small_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id`;
            const booksValues = [
                request.body.isbn13,
                request.body.publication_year,
                request.body.original_title,
                request.body.title,
                imageUrl,
                imageSmallUrl,
            ];
            const booksResult = await client.query(booksInsert, booksValues);

            if (booksResult.rowCount > 1) {
                client.query('ROLLBACK');
                response.status(500).send({
                    message: 'DB Error - contact support',
                });
            }

            const authorsInsert = `INSERT INTO BOOKAUTHORS (id, authors) VALUES ($1, $2)`;
            const authorsValues = [
                booksResult.rows[0].id,
                request.body.authors,
            ];
            await client.query(authorsInsert, authorsValues);

            const ratingsInsert = `INSERT INTO RATINGS (id, rating_1, rating_2, rating_3, rating_4, rating_5)
                VALUES ($1, $2, $3, $4, $5, $6)`;
            const ratingsValues = [
                booksResult.rows[0].id,
                request.body.rating_1,
                request.body.rating_2,
                request.body.rating_3,
                request.body.rating_4,
                request.body.rating_5,
            ];
            await client.query(ratingsInsert, ratingsValues);
            const infoSelect = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5,
                rating_count, rating_avg, image_url, image_small_url
                FROM BOOKS
                JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id
                JOIN RATINGS ON BOOKS.id = RATINGS.id
                WHERE isbn13 = $1`;
            const result = await client.query(infoSelect, [
                request.body.isbn13,
            ]);
            response.status(201).send({
                book: formatKeep(result.rows[0]),
            });
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
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
                console.error('server error on post whoops');
                console.error(error);
                response.status(500).send({
                    message: 'server error - contact support',
                });
            }
        } finally {
            client.release();
        }
    }
);

export { bookRouter };
