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
    const isbnString: string = request.params.isbn13;
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
    if (isStringProvided(author.trim())) {
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

/**
 * @apiDefine JWT
 * @apiHeader {String} Authorization The string "Bearer " + a valid JSON Web Token (JWT).
 */

/**
 * @api {get} /books/:isbn13 Request to retrieve a book entry by ISBN
 *
 * @apiDescription Request to retrieve the complete book entry for <code>isbn13</code>.
 *
 * @apiName GetBookByISBN
 * @apiGroup Books
 *
 * @apiParam {string} isbn13 the ISBN13 to look up
 *
 * @apiSuccess {Object} book the book entry object for <code>isbn13</code>
 * @apiSuccess {string} book.isbn13 <code>isbn13</code>
 * @apiSuccess {string} book.authors the author(s) associated with <code>isbn13</code>
 * @apiSuccess {number} book.publication_year the publication year associated with <code>isbn13</code>
 * @apiSuccess {string} book.original_title the original title associated with <code>isbn13</code>
 * @apiSuccess {string} book.title the title associated with <code>isbn13</code>
 * @apiSuccess {number} book.rating_1 the number of 1 star ratings associated with <code>isbn13</code>
 * @apiSuccess {number} book.rating_2 the number of 2 star ratings associated with <code>isbn13</code>
 * @apiSuccess {number} book.rating_3 the number of 3 star ratings associated with <code>isbn13</code>
 * @apiSuccess {number} book.rating_4 the number of 4 star ratings associated with <code>isbn13</code>
 * @apiSuccess {number} book.rating_5 the number of 5 star ratings associated with <code>isbn13</code>
 * @apiSuccess {number} book.rating_count the total number of ratings the book has
 * @apiSuccess {string} book.rating_avg the average rating of the book as a numeric string rounded to two decimal places
 * @apiSuccess {string|null} book.image_url the image URL associated with <code>isbn13</code>
 * @apiSuccess {string|null} book.image_small_url the small image URL associated with <code>isbn13</code>
 * @apiSuccess {string} book.formatted the aggregate of the book as a string with format:
 *      "<code>isbn13</code>, <code>authors</code>, <code>publication_year</code>, <code>original_title</code>,
 *       <code>title</code>, <code>rating_1</code>, <code>rating_2</code>, <code>rating_3</code>, <code>rating_4</code>, <code>rating_5</code>,
 *       <code>rating_count</code>, <code>rating_avg</code>, <code>image_url</code>, <code>image_small_url</code>"
 *
 * @apiError (400: Invalid/missing ISBN13) {string} message "Invalid or missing ISBN13 - please refer to documentation"
 * @apiError (404: ISBN13 Not Found) {string} message "ISBN not found"
 */
bookRouter.get(
    '/:isbn13',
    mwValidISBN13,
    (request: Request, response: Response) => {
        const query = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, rating_count, rating_avg, image_url, image_small_url 
            FROM BOOKS 
            JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id 
            JOIN RATINGS ON BOOKS.id = RATINGS.id 
            WHERE isbn13 = $1;`;
        const values = [request.params.isbn13];

        pool.query(query, values)
            .then((result) => {
                if (result.rowCount == 1) {
                    response.send({
                        book: formatKeep(result.rows[0]),
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

/**
 * @api {get} /c/books Request to retrieve books by author
 *
 * @apiDescription Request to retrieve all book entries with <code>author</code>. Case-insensitive
 *
 * @apiName GetBooksByAuthor
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiQuery {string} author the author from which to retrieve all book entries containing the query
 *
 * @apiSuccess {Object[]} books the book entry objects of all books with <code>author</code>
 * @apiSuccess {string} books.isbn13 the ISBN associated with the book entry
 * @apiSuccess {string} books.authors the author(s) associated with the book entry
 * @apiSuccess {number} books.publication_year the publication year associated with the book entry
 * @apiSuccess {string} books.original_title the original title associated with the book entry
 * @apiSuccess {string} books.title the title associated with the book entry
 * @apiSuccess {number} books.rating_1 the number of 1 star ratings associated with the book entry
 * @apiSuccess {number} books.rating_2 the number of 2 star ratings associated with the book entry
 * @apiSuccess {number} books.rating_3 the number of 3 star ratings associated with the book entry
 * @apiSuccess {number} books.rating_4 the number of 4 star ratings associated with the book entry
 * @apiSuccess {number} books.rating_5 the number of 5 star ratings associated with the book entry
 * @apiSuccess {number} books.rating_count the total number of ratings the book has
 * @apiSuccess {string} books.rating_avg the average rating of the book as a numeric string rounded to two decimal places
 * @apiSuccess {string|null} books.image_url the image URL associated with the book if present. Null if not
 * @apiSuccess {string|null} books.image_small_url the small image URL associated with the book if present. Null if not
 * @apiSuccess {string} books.formatted the aggregate of each book as a string with format:
 *      "<code>isbn13</code>, <code>authors</code>, <code>publication_year</code>, <code>original_title</code>,
 *       <code>title</code>, <code>rating_1</code>, <code>rating_2</code>, <code>rating_3</code>, <code>rating_4</code>, <code>rating_5</code>,
 *       <code>rating_count</code>, <code>rating_avg</code>, <code>image_url</code>, <code>image_small_url</code>"
 *
 * @apiError (400: Invalid Author) {String} message "Invalid or missing author  - please refer to documentation"
 * @apiError (404: No Author) {String} message "No books found. Try a different author query."
 */
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
                        books: result.rows.map(formatKeep),
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

/**
 * @api {post} /c/books Request to add a book entry
 *
 * @apiDescription Request to add a book entry to the DB. The image and small image URLs are optional, but if you provide one, you must
 * provide both.
 *
 * @apiName AddBook
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiBody {number} isbn13 the book's ISBN *unique
 * @apiBody {string} authors the book's author(s)
 * @apiBody {number} publication_year the book's publication year
 * @apiBody {string} original_title the book's original title
 * @apiBody {string} title the book's current title
 * @apiBody {number} rating_1 the number of 1 star ratings towards the book
 * @apiBody {number} rating_2 the number of 2 star ratings towards the book
 * @apiBody {number} rating_3 the number of 3 star ratings towards the book
 * @apiBody {number} rating_4 the number of 4 star ratings towards the book
 * @apiBody {number} rating_5 the number of 5 star ratings towards the book
 * @apiBody {string} [image_url] the book's image URL
 * @apiBody {string} [image_small_url] the book's small image URL
 *
 * @apiSuccess (Success 201) {Object} book the newly created book
 * @apiSuccess (Success 201) {string} book.isbn13 <code>isbn13</code>
 * @apiSuccess (Success 201) {string} book.authors <code>authors</code>
 * @apiSuccess (Success 201) {number} book.publication_year <code>publication_year</code>
 * @apiSuccess (Success 201) {string} book.original_title <code>original_title</code>
 * @apiSuccess (Success 201) {string} book.title <code>title</code>
 * @apiSuccess (Success 201) {number} book.rating_1 <code>rating_1</code>
 * @apiSuccess (Success 201) {number} book.rating_2 <code>rating_2</code>
 * @apiSuccess (Success 201) {number} book.rating_3 <code>rating_3</code>
 * @apiSuccess (Success 201) {number} book.rating_4 <code>rating_4</code>
 * @apiSuccess (Success 201) {number} book.rating_5 <code>rating_5</code>
 * @apiSuccess (Success 201) {number} book.rating_count the total number of ratings the book has
 * @apiSuccess (Success 201) {string} book.rating_avg the average rating of the book as a numeric string rounded to two decimal places
 * @apiSuccess (Success 201) {string|null} book.image_url <code>image_url</code> if provided, <code>null</code> if not
 * @apiSuccess (Success 201) {string|null} book.image_small_url <code>image_small_url</code> if provided, <code>null</code> if not
 * @apiSuccess (Success 201) {string} book.formatted the aggregate of the book as a string with format:
 *      "<code>isbn13</code>, <code>authors</code>, <code>publication_year</code>, <code>original_title</code>,
 *       <code>title</code>, <code>rating_1</code>, <code>rating_2</code>, <code>rating_3</code>, <code>rating_4</code>, <code>rating_5</code>,
 *       <code>rating_count</code>, <code>rating_avg</code>, <code>image_url</code>, <code>image_small_url</code>"
 *
 * @apiError (400: Missing/Malformed Parameters) {string} message "Missing or malformed required information - please refer to documentation"
 * @apiError (400: ISBN exists) {string} message "ISBN exists"
 */
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
