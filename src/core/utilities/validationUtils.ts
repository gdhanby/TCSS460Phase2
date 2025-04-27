/**
 * Checks the parameter to see if it is a a String.
 *
 * @param {any} candidate the value to check
 * @returns true if the parameter is a String0, false otherwise
 */
function isString(candidate: any): candidate is string {
    return typeof candidate === 'string';
}

/**
 * Checks the parameter to see if it is a a String with a length greater than 0.
 *
 * @param {any} candidate the value to check
 * @returns true if the parameter is a String with a length greater than 0, false otherwise
 */
function isStringProvided(candidate: any): boolean {
    return isString(candidate) && candidate.length > 0;
}

/**
 * Checks the parameter to see if it can be converted into a number.
 *
 * @param {any} candidate the value to check
 * @returns true if the parameter is a number, false otherwise
 */
function isNumberProvided(candidate: any): boolean {
    return (
        isNumber(candidate) ||
        (candidate != null &&
            candidate != '' &&
            !isNaN(Number(candidate.toString())))
    );
}

/**
 * Helper
 * @param x data value to check the type of
 * @returns true if the type of x is a number, false otherwise
 */
function isNumber(x: any): x is number {
    return typeof x === 'number';
}

/**
 * Validates ISBN13. Checks for proper type, length, & whether it consists of only digits.
 * @param isbn data to validate
 * @returns true if isbn is non-null, can be parsed as a number, 13 digits, and is positive.
 */
function validISBN13(isbn: string | null): boolean {
    return (
        isbn != null &&
        isNumber(parseInt(isbn)) &&
        isbn.toString().length == 13 &&
        /^\d+$/.test(isbn.toString())
    );
}

/**
 * Validates rating counts and publication year. Checks for proper type, & whether it is positive
 * @param rating data to validate
 * @returns true if rating is non-null, can be parsed as a number, and is positive.
 */
function validRatingOrYear(rating: number) {
    return (
        rating != null &&
        isNumber(parseInt(rating.toString())) &&
        /^\d+$/.test(rating.toString())
    );
}

// Feel free to add your own validations functions!
// for example: isNumericProvided, isValidPassword, isValidEmail, etc
// don't forget to export any

const validationFunctions = {
    isStringProvided,
    isNumberProvided,
    validISBN13,
    validRatingOrYear,
};

export { validationFunctions };
