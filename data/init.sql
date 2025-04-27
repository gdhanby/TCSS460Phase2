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
    id INT NOT NULL GENERATED ALWAYS AS IDENTITY,
    isbn13 BIGINT NOT NULL,
    publication_year INT NOT NULL,
    original_title TEXT NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    image_small_url TEXT,
    PRIMARY KEY (id),
    UNIQUE (isbn13)
);

DROP TABLE IF EXISTS BOOKAUTHORS;
CREATE TABLE BOOKAUTHORS
( 
    id INT NOT NULL,
    authors TEXT NOT NULL,
    FOREIGN KEY (id) REFERENCES BOOKS2(id)
);

DROP TABLE IF EXISTS RATINGS;
CREATE TABLE RATINGS
(
    id INT NOT NULL,
    rating_1 INT DEFAULT 0,
    rating_2 INT DEFAULT 0,
    rating_3 INT DEFAULT 0,
    rating_4 INT DEFAULT 0,
    rating_5 INT DEFAULT 0,
    rating_count INT
        GENERATED ALWAYS AS (rating_1 + rating_2 + rating_3 + rating_4 + rating_5) STORED,
    rating_avg NUMERIC(3, 2)
        GENERATED ALWAYS AS
        (cast((rating_1 * 1 + rating_2 * 2 + rating_3 * 3 + rating_4 * 4 + rating_5 * 5) as decimal) / COALESCE(NULLIF((rating_1 + rating_2 + rating_3 + rating_4 + rating_5), 0), 1)) STORED,
    FOREIGN KEY (id) REFERENCES BOOKS2(id)
);


-- copy books data into books table. --
COPY books
FROM '/docker-entrypoint-initdb.d/books.csv'
DELIMITER ','
CSV HEADER;


-- after copying csv file into books, we populate the other tables --
INSERT INTO BOOKS2 (isbn13, publication_year, original_title, title, image_url, image_small_url)
SELECT isbn13, publication_year, original_title, title, image_url, image_small_url
FROM BOOKS;

INSERT INTO RATINGS (id, rating_1, rating_2, rating_3, rating_4, rating_5)
SELECT id, rating_1_star, rating_2_star, rating_3_star, rating_4_star, rating_5_star
FROM BOOKS;

INSERT INTO BOOKAUTHORS (id, authors)
SELECT id, authors FROM BOOKS;


-- now let's get rid of that ugly monolithic table and rename our brand new shiny (and slimmer) one --
DROP TABLE BOOKS;
ALTER TABLE BOOKS2 RENAME TO BOOKS;