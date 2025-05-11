import express, { NextFunction, Request, Response, Router } from 'express';
import { pool, validationFunctions } from '../../core/utilities';

const bookRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;
const isNumberProvided = validationFunctions.isNumberProvided;
const validISBN13 = validationFunctions.validISBN13;
const validRatingDelta = validationFunctions.validRatingDelta;
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
    if (isNaN(Number(isbnString))) {
        response.status(400).send({
            message: 'Malformed ISBN-13 - please resubmit ISBN-13',
        });
    } else if (isbnString.length == 13 && /^\d+$/.test(isbnString)) {
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

function mwValidTitleQuery(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const title: string = request.query.title as string;
    if (isStringProvided(title.trim())) {
        next();
    } else {
        console.error('Invalid or missing Title');
        response.status(400).send({
            message: 'Invalid or missing title - please refer to documentation',
        });
    }
}

function mwValidRatingsEntry(
    request: Request,
    response: Response,
    next: NextFunction
) {
    if (
        validRatingDelta(request.body.rating_1) &&
        validRatingDelta(request.body.rating_2) &&
        validRatingDelta(request.body.rating_3) &&
        validRatingDelta(request.body.rating_4) &&
        validRatingDelta(request.body.rating_5)
    ) {
        next();
    } else {
        console.error('Missing rating information!');
        response.status(400).send({
            message:
                'Missing or malformed rating information. Please refer to documentation',
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

function mwValidYearsQuery(
    request: Request,
    response: Response,
    next: NextFunction
) {
    if (
        Number(request.query.beginningYear) >
            Number(request.query.endingYear) &&
        request.query.beginningYear !== '' &&
        request.query.endingYear !== ''
    ) {
        console.log('Ending Year is greater than the beginning year');
        response.status(400).send({
            message: 'Ending year value is less than the beginning year value',
        });
    } else if (
        request.query.beginningYear === '' &&
        request.query.endingYear === ''
    ) {
        console.log('both year values are undefined');
        response.status(404).send({
            message:
                'Year values are not defined - please enter a valid year parameter',
        });
    } else if (
        isNaN(Number(request.query.beginningYear)) ||
        isNaN(Number(request.query.endingYear))
    ) {
        console.log('query parameters are NaN');
        response.status(400).send({
            message: 'Year value(s) are not a valid number',
        });
    } else if (
        validRatingOrYear(Number(request.query.beginningYear)) ||
        validRatingOrYear(Number(request.query.endingYear))
    ) {
        next();
    }
}

// Doesn't necessarily *need* to be async, could just use Promise .then() .catch() pattern.
// Function that makes sure rating deltas sent in won't take rating counts below 0 in the db.
async function mwNegativeRatingPrevention(
    request: Request,
    response: Response,
    next: NextFunction
) {
    // Retrieve the current ratings values
    const currentRatingsQuery = `SELECT rating_1, rating_2, rating_3, rating_4, rating_5
                                FROM ratings WHERE id = (SELECT id
                                                        FROM BOOKS
                                                        WHERE isbn13 = $1);`;
    const currentRatingsResult = await pool.query(currentRatingsQuery, [
        request.params.isbn13,
    ]);

    const ratingsValues = [
        request.body.rating_1 || 0,
        request.body.rating_2 || 0,
        request.body.rating_3 || 0,
        request.body.rating_4 || 0,
        request.body.rating_5 || 0,
    ];

    const currentRatings = currentRatingsResult.rows[0];
    // Check if changes will result in a negative number of ratings
    let idx = 0;
    for (const key in currentRatings) {
        if (currentRatings[key] + ratingsValues[idx] >= 0) {
            idx++;
            continue;
        } else {
            response.status(422).send({
                message:
                    'Cannot perform changes - will result in a negative number of ratings',
            });
            break;
        }
    }
    if (!response.headersSent) {
        next();
    }
}

/**
 * @apiDefine JWT
 * @apiHeader {String} Authorization The string "Bearer " + a valid JSON Web Token (JWT).
 */

/**
 * @api {get} /c/books/cursor Request to retrieve books by cursor pagination
 *
 * @apiDescription Request to retrieve paginated the books using a cursor
 *
 * @apiName Books Cursor Pagination
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiQuery {number} limit the number of book objects to return. Note, if a value less than
 * 0 is provided or a non-numeric value is provided or no value is provided, the default limit
 * amount of 10 will be used.
 *
 * @apiQuery {number} cursor the value used in the lookup of book objects to return. When no cursor is
 * provided, the result is the first set of paginated books. Note, if a value less than 0 is provided
 * or a non-numeric value is provided results will be the same as not providing a cursor.
 *
 * @apiSuccess {Object} pagination metadata results from this paginated query
 * @apiSuccess {number} pagination.totalRecords the most recent count on the total amount of books. May be stale.
 * @apiSuccess {number} pagination.limit the number of book objects to returned.
 * @apiSuccess {number} pagination.cursor the value that should be used on a preceding call to this route.
 *
 * @apiSuccess {Object[]} entries the book entry objects of all books
 * @apiSuccess {string} entries.isbn13 the ISBN associated with the book entry
 * @apiSuccess {string} entries.authors the author(s) associated with the book entry
 * @apiSuccess {number} entries.publication_year the publication year associated with the book entry
 * @apiSuccess {string} entries.original_title the original title associated with the book entry
 * @apiSuccess {string} entries.title the title associated with the book entry
 * @apiSuccess {number} entries.rating_1 the number of 1 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_2 the number of 2 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_3 the number of 3 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_4 the number of 4 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_5 the number of 5 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_count the total number of ratings the book has
 * @apiSuccess {string} entries.rating_avg the average rating of the book as a numeric string rounded to two decimal places
 * @apiSuccess {string|null} entries.image_url the image URL associated with the book if present. Null if not
 * @apiSuccess {string|null} entries.image_small_url the small image URL associated with the book if present. Null if not
 * @apiSuccess {string} entries.formatted the aggregate of each book as a string with format:
 *      "<code>isbn13</code>, <code>authors</code>, <code>publication_year</code>, <code>original_title</code>,
 *       <code>title</code>, <code>rating_1</code>, <code>rating_2</code>, <code>rating_3</code>, <code>rating_4</code>, <code>rating_5</code>,
 *       <code>rating_count</code>, <code>rating_avg</code>, <code>image_url</code>, <code>image_small_url</code>"
 */
bookRouter.get('/cursor', async (request: Request, response: Response) => {
    const theQuery = `SELECT BOOKS.id, isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5,
                rating_count, rating_avg, image_url, image_small_url
                FROM BOOKS
                JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id
                JOIN RATINGS ON BOOKS.id = RATINGS.id
                WHERE BOOKS.id > $2
                ORDER BY BOOKS.id
                LIMIT $1`;

    // NOTE: +request.query.limit the + tells TS to treat this string as a number
    const limit: number =
        isNumberProvided(request.query.limit) && +request.query.limit > 0
            ? +request.query.limit
            : 10;
    const cursor: number =
        isNumberProvided(request.query.cursor) && +request.query.cursor >= 0
            ? +request.query.cursor
            : 0; // autogenerated ids start at 1 so 0 is a valid starting cursor

    const values = [limit, cursor];

    // demonstrating deconstructing the returned object. const { rows }
    const { rows } = await pool.query(theQuery, values);

    // This query is SLOW on large datasets! - Beware!
    const result = await pool.query(
        'SELECT count(*) AS exact_count FROM BOOKS;'
    );

    const count = result.rows[0].exact_count;

    response.send({
        entries: rows.map(({ id, ...rest }) => rest).map(formatKeep), //removes id property
        pagination: {
            totalRecords: count,
            limit,
            cursor: rows
                .map((row) => row.id) //note the lowercase, the field names for rows are all lc
                .reduce((max, id) => (id > max ? id : max)), //gets the largest id
        },
    });
});

/**
 * @api {get} /c/books/offset Request to retrieve books by offset pagination
 *
 * @apiDescription Request to retrieve paginated the books using an offset
 *
 * @apiName Books Offset Pagination
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiQuery {number} limit the number of book objects to return. Note, if a value less than
 * 0 is provided or a non-numeric value is provided or no value is provided, the default limit
 * amount of 10 will be used.
 *
 * @apiQuery {number} offset the value used in the lookup of book objects to return. When no offset is
 * provided, the result is the first set of paginated books. Note, if a value less than 0 is provided
 * or a non-numeric value is provided results will be the same as not providing an offset.
 *
 * @apiSuccess {Object} pagination metadata results from this paginated query
 * @apiSuccess {number} pagination.totalRecords the most recent count on the total amount of books. May be stale.
 * @apiSuccess {number} pagination.limit the number of book objects to returned.
 * @apiSuccess {number} pagination.offset the current offset (what was sent in the request, or the default).
 * @apiSuccess {number} pagination.nextPage the offset to be used on the succeeding call to view the next page.
 *
 * @apiSuccess {Object[]} entries the book entry objects of all books
 * @apiSuccess {string} entries.isbn13 the ISBN associated with the book entry
 * @apiSuccess {string} entries.authors the author(s) associated with the book entry
 * @apiSuccess {number} entries.publication_year the publication year associated with the book entry
 * @apiSuccess {string} entries.original_title the original title associated with the book entry
 * @apiSuccess {string} entries.title the title associated with the book entry
 * @apiSuccess {number} entries.rating_1 the number of 1 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_2 the number of 2 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_3 the number of 3 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_4 the number of 4 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_5 the number of 5 star ratings associated with the book entry
 * @apiSuccess {number} entries.rating_count the total number of ratings the book has
 * @apiSuccess {string} entries.rating_avg the average rating of the book as a numeric string rounded to two decimal places
 * @apiSuccess {string|null} entries.image_url the image URL associated with the book if present. Null if not
 * @apiSuccess {string|null} entries.image_small_url the small image URL associated with the book if present. Null if not
 * @apiSuccess {string} entries.formatted the aggregate of each book as a string with format:
 *      "<code>isbn13</code>, <code>authors</code>, <code>publication_year</code>, <code>original_title</code>,
 *       <code>title</code>, <code>rating_1</code>, <code>rating_2</code>, <code>rating_3</code>, <code>rating_4</code>, <code>rating_5</code>,
 *       <code>rating_count</code>, <code>rating_avg</code>, <code>image_url</code>, <code>image_small_url</code>"
 */
bookRouter.get('/offset', async (request: Request, response: Response) => {
    const theQuery = `SELECT BOOKS.id, isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5,
                        rating_count, rating_avg, image_url, image_small_url
                    FROM BOOKS
                    JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id
                    JOIN RATINGS ON BOOKS.id = RATINGS.id
                    ORDER BY BOOKS.id
                    LIMIT $1
                    OFFSET $2`;

    // NOTE: +request.query.limit the + tells TS to treat this string as a number
    const limit: number =
        isNumberProvided(request.query.limit) && +request.query.limit > 0
            ? +request.query.limit
            : 10;
    const offset: number =
        isNumberProvided(request.query.offset) && +request.query.offset >= 0
            ? +request.query.offset
            : 0;

    const theValues = [limit, offset];

    const { rows } = await pool.query(theQuery, theValues);

    const result = await pool.query(
        'SELECT count(*) AS exact_count FROM BOOKS;'
    );
    const count = result.rows[0].exact_count;

    response.send({
        entries: rows.map(({ id, ...rest }) => rest).map(formatKeep),
        pagination: {
            totalRecords: count,
            limit,
            offset,
            nextPage: limit + offset,
        },
    });
});

/**
 * @api {get} /c/books/author Request to retrieve books by author
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
 * @apiSuccess {number} total the total number of books returned
 *
 * @apiError (400: Invalid Author) {String} message "Invalid or missing author  - please refer to documentation"
 * @apiError (404: No Author) {String} message "No books found. Try a different author query."
 */
bookRouter.get(
    '/author',
    mwValidAuthorQuery,
    (request: Request, response: Response) => {
        const query = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, rating_count, rating_avg, image_url, image_small_url 
            FROM BOOKS 
            JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id 
            JOIN RATINGS ON BOOKS.id = RATINGS.id 
            WHERE UPPER(BOOKAUTHORS.authors) LIKE UPPER('%'||$1||'%');`;
        const values = [request.query.author];

        // TODO: paginate results? For the time being we are just returning the total books returned.
        pool.query(query, values)
            .then((result) => {
                if (result.rowCount > 0) {
                    response.send({
                        books: result.rows.map(formatKeep),
                        total: result.rowCount,
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
 * @api {get} /c/books/title Request to retrieve books by title
 *
 * @apiDescription Request to retrieve all book entries with <code>title</code>. Case-insensitive
 *
 * @apiName GetBooksByTitle
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiQuery {string} title the title from which to retrieve all book entries containing the query
 *
 * @apiSuccess {Object[]} books the book entry objects of all books with <code>title</code>
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
 * @apiSuccess {number} total the total number of books returned
 *
 * @apiError (400: Invalid Title) {String} message "Invalid or missing title  - please refer to documentation"
 * @apiError (404: No Title) {String} message "No books found. Try a different title query."
 */
bookRouter.get(
    '/title',
    mwValidTitleQuery,
    (request: Request, response: Response) => {
        const query = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, rating_count, rating_avg, image_url, image_small_url 
            FROM BOOKS 
            JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id 
            JOIN RATINGS ON BOOKS.id = RATINGS.id 
            WHERE UPPER(BOOKS.title) LIKE UPPER('%'||$1||'%')
            OR UPPER(BOOKS.original_title) LIKE UPPER('%'||$1||'%');`;
        const values = [request.query.title];

        // TODO: paginate results? For the time being we are just returning the total books returned.
        pool.query(query, values)
            .then((result) => {
                if (result.rowCount > 0) {
                    response.send({
                        books: result.rows.map(formatKeep),
                        total: result.rowCount,
                    });
                } else {
                    response.status(404).send({
                        message: 'No books found. Try a different title query.',
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
 * @api {get} /c/books/year Request to retrieve books by year range
 *
 * @apiDescription Request to retrieve all books based off of a <code>Beginning year</code> and an <code>Ending year</code>
 *
 * @apiName GetBooksbyYearRange
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiQuery {string} [beginningYear] The string that indicates the lower range of looking up books in a year range
 * @apiQuery {string} [endingYear] The string that indicates the upper range of looking up books in a year range
 *
 * @apiSuccess {Object[]} books the book entry objects of all books that satisfy the rating criteria
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
 * @apiSuccess {number} total the total number of books returned
 *
 * @apiError (400 Ending Year Value is less than Beginning Year Value) {string} message "Ending year value is less than the beginning year value"
 * @apiError (404 Both Year Values are Undefined) {string} message "Year values are not defined - please enter a valid year parameter"
 * @apiError (400 Year Values are NaN) {string} message "Year values are not a valid number"
 * @apiError (404 No book entries found) {string} message "No entries found"
 *
 */
bookRouter.get(
    '/year',
    mwValidYearsQuery,
    (request: Request, response: Response) => {
        const query = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, rating_count, rating_avg, image_url, image_small_url 
            FROM BOOKS 
            JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id 
            JOIN RATINGS ON BOOKS.id = RATINGS.id 
        WHERE publication_year >= $1 AND publication_year <= $2`;
        const values = [
            request.query.beginningYear || 0,
            request.query.endingYear || 5000,
        ];
        pool.query(query, values)
            .then((result) => {
                if (result.rowCount > 0) {
                    response.status(200).send({
                        books: result.rows.map(formatKeep),
                        total: result.rowCount,
                    });
                } else {
                    response.status(404).send({
                        message: 'No entries found',
                    });
                }
            })
            .catch((error) => {
                console.error('DB error on GET/');
                console.error(error);
                response.status(500).send({
                    message: 'Server error - contact support',
                });
            });
    }
);
/**
 * @api {get} /c/books/rating Request to retrieve books by total rating count and/or rating average
 *
 * @apiDescription Request to retrieve all book entries with total rating counts and averages in user-specified ranges (inclusive at both ends)
 *
 * @apiName getBooksByRating
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiQuery {number} [ratingCountBegin] the beginning of the rating count range. Defaults to 0 if invalid or not provided
 * @apiQuery {number} [ratingCountEnd] the end of the rating count range. Defaults to the maximum integer value if invalid or not provided
 * @apiQuery {number} [ratingAvgBegin] the beginning of the rating average range. Defaults to 0.00 if invalid or not provided
 * @apiQuery {number} [ratingAvgEnd] the end of the rating average range. Defaults to 5.00 if invalid or not provided
 *
 * @apiSuccess {Object[]} books the book entry objects of all books that satisfy the rating criteria
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
 * @apiError (404: No Books) {string} message "No books found. Try a different query."
 */
bookRouter.get('/rating', async (request: Request, response: Response) => {
    const ratingCountBegin: number =
        isNumberProvided(request.query.ratingCountBegin) &&
        +request.query.ratingCountBegin > 0
            ? +request.query.ratingCountBegin
            : 0;
    const ratingCountEnd: number =
        isNumberProvided(request.query.ratingCountEnd) &&
        +request.query.ratingCountEnd > 0
            ? +request.query.ratingCountEnd
            : 2147483647; // max integer value postgres
    const ratingAvgBegin: number =
        isNumberProvided(request.query.ratingAvgBegin) &&
        +request.query.ratingAvgBegin > 0
            ? +request.query.ratingAvgBegin
            : 0;
    const ratingAvgEnd: number =
        isNumberProvided(request.query.ratingAvgEnd) &&
        +request.query.ratingAvgEnd > 0
            ? +request.query.ratingAvgEnd
            : 5.0;

    const ratingRanges = [
        ratingCountBegin,
        ratingCountEnd,
        ratingAvgBegin,
        ratingAvgEnd,
    ];
    const theQuery = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5, rating_count, rating_avg, image_url, image_small_url 
            FROM BOOKS 
            JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id 
            JOIN RATINGS ON BOOKS.id = RATINGS.id 
            WHERE rating_count >= $1 AND rating_count <= $2
            AND rating_avg >= $3 AND rating_avg <= $4;`;

    pool.query(theQuery, ratingRanges)
        .then((result) => {
            if (result.rowCount > 0) {
                response.send({
                    books: result.rows.map(formatKeep),
                    total: result.rowCount,
                });
            } else {
                response.status(404).send({
                    message: 'No books found. Try a different query.',
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

/**
 * @api {delete} /c/books/title/ Request to remove a book entry by title
 *
 * @apiDescription Request to remove an entry associated with <code>title</code> in the DB. Only one book may be deleted by title at a time.
 *
 * @apiName DeleteBookByTitle
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiQuery {string} title the title associated with the entry to delete
 *
 * @apiSuccess {string} message the string: "Book successfully deleted"
 *
 * @apiError (400: Title Malformed) {string} message "Malformed Title - please resubmit Title"
 * @apiError (400: Title Not Found) {string} message "Title not found or not unique"
 */
bookRouter.delete(
    '/title',
    mwValidTitleQuery,
    async (request: Request, response: Response) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const checkBookQuery = `SELECT id FROM BOOKS WHERE UPPER(title) LIKE UPPER('%'||$1||'%');`;
            const theTitle = [request.query.title];
            const checkBookResult = await client.query(
                checkBookQuery,
                theTitle
            );

            if (checkBookResult.rowCount !== 1) {
                await client.query('ROLLBACK');
                response.status(400).send({
                    message: 'Title not found or not unique',
                });
            } else {
                const theBookID = [checkBookResult.rows[0].id];

                const deleteAuthorsQuery =
                    'DELETE FROM BOOKAUTHORS WHERE id = $1';
                await client.query(deleteAuthorsQuery, theBookID);

                const deleteRatingsQuery = 'DELETE FROM RATINGS WHERE id = $1';
                await client.query(deleteRatingsQuery, theBookID);

                const deleteBookQuery = 'DELETE FROM BOOKS WHERE id = $1';
                await client.query(deleteBookQuery, theBookID);

                await client.query('COMMIT');
                response.send({
                    message: 'Book successfully deleted',
                });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Server error on delete');
            console.error(error);
            response.status(500).send({
                message: 'Server error - contact support',
            });
        } finally {
            client.release();
        }
    }
);

/**
 * @api {delete} /c/books/:isbn13 Request to remove a book entry by ISBN
 *
 * @apiDescription Request to remove an entry associated with <code>isbn13</code> in the DB
 *
 * @apiName DeleteBookByISBN
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiParam {number} isbn13 the ISBN associated with the entry to delete
 *
 * @apiSuccess {string} message the string: "Book successfully deleted"
 *
 * @apiError (400: ISBN Malformed) {string} message "Malformed ISBN13 - please resubmit ISBN113"
 * @apiError (404: ISBN Not Found) {string} message "ISBN not found"
 */
bookRouter.delete(
    '/:isbn13',
    mwValidISBN13,
    async (request: Request, response: Response) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const checkBookQuery = 'SELECT id FROM BOOKS WHERE isbn13 = $1';
            const theISBN = [request.params.isbn13];
            const checkBookResult = await client.query(checkBookQuery, theISBN);

            if (checkBookResult.rowCount !== 1) {
                await client.query('ROLLBACK');
                response.status(404).send({
                    message: 'ISBN not found',
                });
            } else {
                const theBookID = [checkBookResult.rows[0].id];

                const deleteAuthorsQuery =
                    'DELETE FROM BOOKAUTHORS WHERE id = $1';
                await client.query(deleteAuthorsQuery, theBookID);

                const deleteRatingsQuery = 'DELETE FROM RATINGS WHERE id = $1';
                await client.query(deleteRatingsQuery, theBookID);

                const deleteBookQuery = 'DELETE FROM BOOKS WHERE id = $1';
                await client.query(deleteBookQuery, theBookID);

                await client.query('COMMIT');
                response.send({
                    message: 'Book successfully deleted',
                });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('server error on delete, uh oh');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        } finally {
            client.release();
        }
    }
);

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
 * @apiError (400: Malformed ISBN13) {string} message "Malformed ISBN-13 - please resubmit ISBN-13"
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
 * @api {patch} /c/books/:isbn13 Request to change ratings of a book
 *
 * @apiDescription Request to change ratings based of a book with <code>isbn13</code>.
 *
 * @apiName ChangeRatings
 * @apiGroup Books
 *
 * @apiUse JWT
 *
 * @apiParam {number} isbn13 the isbn13 of the book to update
 *
 * @apiBody {number} [rating_1] the number that indicates the change in ratings for 1 star ratings. Only provide if changing the corresponding rating count.
 * @apiBody {number} [rating_2] the number that indicates the change in ratings for 2 star ratings. Only provide if changing the corresponding rating count.
 * @apiBody {number} [rating_3] the number that indicates the change in ratings for 3 star ratings. Only provide if changing the corresponding rating count.
 * @apiBody {number} [rating_4] the number that indicates the change in ratings for 4 star ratings. Only provide if changing the corresponding rating count.
 * @apiBody {number} [rating_5] the number that indicates the change in ratings for 5 star ratings. Only provide if changing the corresponding rating count.
 *
 * @apiSuccess (Success 200) {Object} book the book with modified ratings
 * @apiSuccess (Success 200) {string} book.isbn13 <code>isbn13</code>
 * @apiSuccess (Success 200) {string} book.authors <code>authors</code>
 * @apiSuccess (Success 200) {number} book.publication_year <code>publication_year</code>
 * @apiSuccess (Success 200) {string} book.original_title <code>original_title</code>
 * @apiSuccess (Success 200) {string} book.title <code>title</code>
 * @apiSuccess (Success 200) {number} book.rating_1 <code>rating_1</code>
 * @apiSuccess (Success 200) {number} book.rating_2 <code>rating_2</code>
 * @apiSuccess (Success 200) {number} book.rating_3 <code>rating_3</code>
 * @apiSuccess (Success 200) {number} book.rating_4 <code>rating_4</code>
 * @apiSuccess (Success 200) {number} book.rating_5 <code>rating_5</code>
 * @apiSuccess (Success 200) {number} book.rating_count the total number of ratings the book has
 * @apiSuccess (Success 200) {string} book.rating_avg the average rating of the book as a numeric string rounded to two decimal places
 * @apiSuccess (Success 200) {string|null} book.image_url <code>image_url</code> if provided, <code>null</code> if not
 * @apiSuccess (Success 200) {string|null} book.image_small_url <code>image_small_url</code> if provided, <code>null</code> if not
 * @apiSuccess (Success 200) {string} book.formatted the aggregate of the book as a string with format:
 *      "<code>isbn13</code>, <code>authors</code>, <code>publication_year</code>, <code>original_title</code>,
 *       <code>title</code>, <code>rating_1</code>, <code>rating_2</code>, <code>rating_3</code>, <code>rating_4</code>, <code>rating_5</code>,
 *       <code>rating_count</code>, <code>rating_avg</code>, <code>image_url</code>, <code>image_small_url</code>"
 *
 * @apiError (400: Malformed ISBN13) {string} message "Malformed ISBN-13 - please resubmit ISBN-13"
 * @apiError (400: Invalid/missing ISBN13) {string} message "Invalid or missing ISBN13 - please refer to documentation"
 * @apiError (400: Missing/Malformed ratings information) {string} message "Missing or malformed rating information. Please refer to documentation"
 * @apiError (404: No book with ISBN13) {string} message "No book found to update. Try a different ISBN13"
 * @apiError (422: Negative ratings count from result) {string} message "Cannot perform changes - will result in a negative number of ratings"
 */
bookRouter.patch(
    '/:isbn13',
    mwValidISBN13,
    mwValidRatingsEntry,
    mwNegativeRatingPrevention,
    async (request: Request, response: Response) => {
        /* Route for updating rating counts of book. user provides isbn13 as route parameter, 
        and request body has which counts they want to update (rating_1, rating_2, etc.). They
        should be able to provide only the ones they want to update, and the value in the DB will
        be overwritten. */
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const ratingQuery = `UPDATE ratings SET rating_1 = rating_1 + $1, rating_2 = rating_2 + $2, rating_3 = rating_3 + $3, rating_4 = rating_4 + $4, rating_5 = rating_5 + $5 
                                WHERE id = (SELECT id 
                                            FROM BOOKS
                                            WHERE isbn13 = $6);`;
            const ratingsValues = [
                request.body.rating_1 || 0,
                request.body.rating_2 || 0,
                request.body.rating_3 || 0,
                request.body.rating_4 || 0,
                request.body.rating_5 || 0,
                request.params.isbn13,
            ];

            await client.query(ratingQuery, ratingsValues);

            const infoSelect = `SELECT isbn13, authors, publication_year, original_title, title, rating_1, rating_2, rating_3, rating_4, rating_5,
                rating_count, rating_avg, image_url, image_small_url
                FROM BOOKS
                JOIN BOOKAUTHORS ON BOOKS.id = BOOKAUTHORS.id
                JOIN RATINGS ON BOOKS.id = RATINGS.id
                WHERE isbn13 = $1`;
            const result = await client.query(infoSelect, [
                request.params.isbn13,
            ]);
            response.status(200).send({
                book: formatKeep(result.rows[0]),
            });
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('server error on patch whoops');
            console.error(error);
            if (
                error.message != undefined &&
                (error.message as string).endsWith("(reading 'isbn13')")
            ) {
                response.status(404).send({
                    message: 'No book found to update. Try a different ISBN13',
                });
            } else {
                response.status(500).send({
                    message: 'server error - contact support',
                });
            }
        }
    }
);

export { bookRouter };
