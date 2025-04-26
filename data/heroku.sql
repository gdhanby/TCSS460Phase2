-- Active: 1710457548247@@127.0.0.1@5432@tcss460@public
DROP TABLE IF EXISTS Demo;
CREATE TABLE Demo (DemoID SERIAL PRIMARY KEY,
                        Priority INT,
                        Name TEXT NOT NULL UNIQUE,
                        Message TEXT
);

DROP TABLE IF EXISTS Account CASCADE;
CREATE TABLE Account (Account_ID SERIAL PRIMARY KEY,
                      FirstName VARCHAR(255) NOT NULL,
		              LastName VARCHAR(255) NOT NULL,
                      Username VARCHAR(255) NOT NULL UNIQUE,
                      Email VARCHAR(255) NOT NULL UNIQUE,
                      Phone VARCHAR(15) NOT NULL UNIQUE,
                      Account_Role int NOT NULL
);


DROP TABLE IF EXISTS Account_Credential;
CREATE TABLE Account_Credential (Credential_ID SERIAL PRIMARY KEY,
                      Account_ID INT NOT NULL,
                      Salted_Hash VARCHAR(255) NOT NULL,
                      salt VARCHAR(255),
                      FOREIGN KEY(Account_ID) REFERENCES Account(Account_ID)
);


DROP TABLE IF EXISTS BOOKS CASCADE;
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
