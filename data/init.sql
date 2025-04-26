-- Active: 1710457548247@@127.0.0.1@5432@tcss460@public

CREATE TABLE Demo (DemoID SERIAL PRIMARY KEY,
                        Priority INT,
                        Name TEXT NOT NULL UNIQUE,
                        Message TEXT
);

CREATE TABLE Account (Account_ID SERIAL PRIMARY KEY,
                      FirstName VARCHAR(255) NOT NULL,
		              LastName VARCHAR(255) NOT NULL,
                      Username VARCHAR(255) NOT NULL UNIQUE,
                      Email VARCHAR(255) NOT NULL UNIQUE,
                      Phone VARCHAR(15) NOT NULL UNIQUE,
                      Account_Role int NOT NULL
);


CREATE TABLE Account_Credential (Credential_ID SERIAL PRIMARY KEY,
                      Account_ID INT NOT NULL,
                      Salted_Hash VARCHAR(255) NOT NULL,
                      salt VARCHAR(255),
                      FOREIGN KEY(Account_ID) REFERENCES Account(Account_ID)
);

CREATE TABLE BOOKS (id INT PRIMARY KEY,
        isbn13 BIGINT,
        authors TEXT,
        publication_year INT,
        original_title TEXT,
        title TEXT,
        rating_avg FLOAT,
        rating_count INT,
        rating_1_star INT,
        rating_2_star INT,
        rating_3_star INT,
        rating_4_star INT,
        rating_5_star INT,
        image_url TEXT,
        image_small_url TEXT
    );


-- make new tables --
DROP TABLE IF EXISTS BOOKS2;
CREATE TABLE BOOKS2
(
  isbn13 BIGINT NOT NULL,
  id INT NOT NULL,
  publication_year INT NOT NULL,
  original_title TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_small_url TEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (isbn13)
);

DROP TABLE IF EXISTS BOOKAUTHORS;
CREATE TABLE BOOKAUTHORS
(
  authors TEXT NOT NULL,
  id INT NOT NULL,
  FOREIGN KEY (id) REFERENCES BOOKS2(id)
);

DROP TABLE IF EXISTS RATINGS;
CREATE TABLE RATINGS
(
  rating_1 INT NOT NULL,
  rating_2 INT NOT NULL,
  rating_3 INT NOT NULL,
  rating_4 INT NOT NULL,
  rating_5 INT NOT NULL,
  id INT NOT NULL,
  FOREIGN KEY (id) REFERENCES BOOKS2(id)
);


-- copy books data into books table. --
COPY books
FROM '/docker-entrypoint-initdb.d/books.csv'
DELIMITER ','
CSV HEADER;


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