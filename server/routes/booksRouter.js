import { Router } from 'express';
import { AuthorNotFoundError, hashResponseBody, NotFoundError } from '../../util/index.js';
import _ from 'lodash';
import { pool } from '../index.js';



const booksRouter = Router();

booksRouter.get('/', async (req, res) => {
    let { offset, limit, searchTitleTerm } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    offset = ["undefined", "null", undefined].includes(offset) ? 0 : offset;
    limit = ["undefined", "null", undefined].includes(limit) ? null : limit;
    searchTitleTerm = ["undefined", "null", undefined].includes(searchTitleTerm) ? "" : searchTitleTerm;
    try {
        const allBooks = await pool.query(`SELECT 
                                            books.id,
                                            books.title,
                                            books.page_count,
                                            books.description,
                                            books.book_thumbnail,
                                            books.language,
                                            books.createdAt,
                                            books.updatedAt,
                                            books.author_id,
                                            authors.name AS author_name 
                                            FROM books 
                                                JOIN authors ON books.author_id = authors.id
                                                WHERE books.title ILIKE $1
                                                ORDER BY authors.name
                                                LIMIT $2
                                                OFFSET $3`, [`%${searchTitleTerm}%`, limit, offset])
        const allBooksArray = allBooks.rows;
        let booksCount = await pool.query('SELECT count(*) FROM books');
        booksCount = booksCount.rows[0].count
        const responseBody = {
            allBooksArray,
            booksCount
        };
        // res.set({
        //     'ETag': hashResponseBody(responseBody),
        //     'Cache-control': 'public, max-age=604800'
        // });
        res.status(200).send(responseBody);
    } catch (err) {
        if (err) {
            res.status(400).send(err);
        }
    }
});

booksRouter.get('/:bookId', async (req, res) => {
    const { bookId } = req.params;
    try {
        const books = await pool.query('SELECT * FROM books WHERE id = $1', [bookId])
        const result = books.rows[0];
        if (result === undefined) {
            throw new NotFoundError()
        }
        const newBookId = result.id;
        const selfURI = `${req.protocol}://${req.get('host')}/books/${newBookId}`;
        result.links = {
            "self": {
                "href": selfURI
            }
        }
        // res.set({
        //     'ETag': hashResponseBody(result),
        //     'Cache-control': 'public, max-age=604800',
        //     'Last-Modified': result.updatedat
        // });
        res.status(200).send(result);
    } catch (err) {
        if (err.name === 'NotFoundError') {
            res.status(404).send(err.message)
        } else {
            res.status(400).send(err.message);
        }
    }
});

booksRouter.get('/:bookId/readers', async (req, res) => {
    const { bookId } = req.params;
    try {
        const allBookReaders = await pool.query(`SELECT R.* FROM books_readers AS BR 
                                                    LEFT JOIN readers AS R
                                                        ON BR.reader_id = R.id
                                                    WHERE BR.book_id = $1`, [bookId]);
        const result = allBookReaders.rows;
        // res.set({
        //     'ETag': hashResponseBody(result),
        //     'Cache-control': 'public, max-age=604800',
        // });
        res.status(200).send(result);
    } catch (err) {
        res.status(400).send(err);
    }
})
booksRouter.post('/addBook2/', async (req, res) => {
    try {
        for (const book of req.body) {
            let { title, authorId, pageCount, image } = book;
            pageCount = pageCount === "" ? 0 : pageCount;
            const author = await pool.query('SELECT id FROM authors WHERE ID = $1', [authorId]);
            const authorExists =  author.rows[0];
            if (!authorExists) {
                throw Error("This authorId does not exist. Please add it first or try Adding a new author and book.")
            } else {
                const insert = await pool.query('INSERT INTO books (title, author_id, page_count, book_thumbnail, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [title, authorId, pageCount, image, new Date(), new Date()]);
                const insertResult = insert.rows[0];
                const newBookId = insertResult.id;
                const responseBody = { book: insertResult }
                
            }
        }
        res.status(200).send("Success")
    } catch (err) {
        if (err) {
            res.status(400).send(`${err.message}`);
        }
    }
});

booksRouter.post('/', async (req, res) => {
    let { bookTitle, authorId, pageCount, bookThumbnail } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    pageCount = pageCount === "null" ? null : pageCount;
    bookThumbnail = bookThumbnail === "null" ? null : bookThumbnail;
    try {
        const author = await pool.query('SELECT id FROM authors WHERE ID = $1', [authorId]);
        const authorExists =  author.rows[0];
        if (!authorExists) {
            throw new AuthorNotFoundError()
        } else {
            const insert = await pool.query('INSERT INTO books (title, author_id, page_count, book_thumbnail, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [bookTitle, authorId, pageCount, bookThumbnail, new Date(), new Date()]);
            const insertResult = insert.rows[0];
            const newBookId = insertResult.id;
            const selfURI = `${req.protocol}://${req.get('host')}/books/${newBookId}`;
            const responseBody = { 
                book: insertResult,
                links: {
                    self: {
                        href: selfURI
                    }
                }
            };
            
            // res.set({
            //     "Location": selfURI,
            //     "Last-Modified": responseBody.book.createdat

            // })
            res.status(201).send(responseBody)
        }
    } catch (err) {
        if (err.name === "AuthorNotFoundError") {
            res.status(404).send(err.message)
        } else {
            res.status(400).send(`${err.message}`);
        }
    }
});

// This should be gone? Is not RESTy ? ?
booksRouter.post('/addNewAuthorAndBook/:bookTitle/:authorName/:authorAge/', async (req, res) => {
    let { bookTitle, authorName, authorAge } = req.params;
    try {
        const insertAuthor = await pool.query('INSERT INTO authors (name, age) VALUES ($1, $2) RETURNING *', [authorName, authorAge]);
        const insertAuthorResult = insertAuthor.rows[0];
        const newAuthorId = insertAuthorResult.id;
        const insertBook = await pool.query('INSERT INTO books (title, author_id) VALUES ($1, $2) RETURNING *', [bookTitle, newAuthorId]);
        const insertBookResult = insertBook.rows[0];
        const newBookId = insertBookResult.id;
        const responseBody = {
            "author": insertAuthorResult,
            "book": insertBookResult
        }
        res.status(200).send(responseBody)
    } catch (err) {
        if (err) {
            res.status(400).send(`${err.message}`);
        }
    }
});

booksRouter.patch('/:bookId', async (req, res) => {
    const { bookId } = req.params;
    const { newBookTitle } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    try {
        const update = await pool.query('UPDATE books SET title = $1, updatedAt = $2 WHERE id = $3 RETURNING *', [newBookTitle, new Date(), bookId]);
        const result = update.rows[0]
        if (result === undefined) {
            throw new NotFoundError();
        }
        res.status(200).send(result);
    } catch (err) {
        
    };
});

booksRouter.delete('/:bookId', async (req, res) => {
    const { bookId } = req.params;
    try {
        await pool.query('DELETE FROM books_readers WHERE book_id = $1', [bookId])
        const delete_book = await pool.query('DELETE FROM books WHERE id = $1 RETURNING *', [bookId]);
        const result = delete_book.rows[0];
        if (result === undefined) {
            throw new NotFoundError();
        }
        res.status(200).send(result);
    } catch (err) {
        if (err.name === "NotFoundError") {
            res.status(404).send(err.message)
        } else {
            res.status(400).send(err);
        }
    }
})

export default booksRouter