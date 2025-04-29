-- only run this after running heroku.sql and then using psql \copy to copy the csv in in BOOKS --

-- after copying csv file into books, we populate the other tables --
INSERT INTO BOOKS2 (id, isbn13, publication_year, original_title, title, image_url, image_small_url)
SELECT id, isbn13, publication_year, original_title, title, image_url, image_small_url
FROM BOOKS;

INSERT INTO RATINGS (id, rating_1, rating_2, rating_3, rating_4, rating_5)
SELECT id, rating_1_star, rating_2_star, rating_3_star, rating_4_star, rating_5_star
FROM BOOKS;

INSERT INTO BOOKAUTHORS (id, authors)
SELECT id, authors FROM BOOKS;


-- we want books2 to auto increment ids so let's change it to do that --
ALTER TABLE BOOKS2
ALTER COLUMN id DROP DEFAULT,
ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;
-- but wait, it'll ignore the existing ids and start generating from 1, we need to update the sequence --
SELECT setval(pg_get_serial_sequence('books', 'id'), (SELECT MAX(id) FROM books));
/* setval takes two arguments-the thing to be updated, and the new value. 
the pg_get_serial_sequence bit fetches the name of the internal sequence used for the ids, 
the select statement grabs the max id, so the sequence can pick up where the ids in the csv left off. */


-- now let's get rid of that ugly monolithic table and rename our brand new shiny (and slimmer) one --
DROP TABLE BOOKS;
ALTER TABLE BOOKS2 RENAME TO BOOKS;