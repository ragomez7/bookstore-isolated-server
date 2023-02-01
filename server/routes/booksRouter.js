import { Router } from 'express';
import { AuthorNotFoundError, BookNotFoundError, hashResponseBody } from '../../util/index.js';
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
        const select = await pool.query('SELECT * FROM books WHERE id = $1', [bookId])
        const book = select.rows[0];
        if (book === undefined) {
            throw new BookNotFoundError()
        }
        const selfURI = `${req.protocol}://${req.get('host')}/books/${book.id}`;
        
        // res.set({
        //     'ETag': hashResponseBody(result),
        //     'Cache-control': 'public, max-age=604800',
        //     'Last-Modified': result.updatedat
        // });
        const responseBody = {
            book
        }
        responseBody.links = {
            "self": {
                "href": selfURI
            }
        }
        res.status(200).send(responseBody);
    } catch (err) {
        if (err.name === 'BookNotFoundError') {
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
            res.status(400).send(err);
        }
    }
});

booksRouter.patch('/:bookId', async (req, res) => {
    const { bookId } = req.params;
    const { newBookTitle } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    try {
        const update = await pool.query('UPDATE books SET title = $1, updatedAt = $2 WHERE id = $3 RETURNING *', [newBookTitle, new Date(), bookId]);
        const updatedBook = update.rows[0]
        const selfURI = `${req.protocol}://${req.get('host')}/books/${bookId}`;
        if (updatedBook === undefined) {
            throw new BookNotFoundError();
        }
        const responseBody = {
            book: updatedBook,
            links: {
                self: {
                    href: selfURI
                }
            }
        }
        res.status(200).send(responseBody);
    } catch (err) {
        if (err.name === "BookNotFoundError") {
            res.status(404).send(err.message)
        } else {
            res.status(400).send(err)
        }
    };
});

booksRouter.delete('/:bookId', async (req, res) => {
    const { bookId } = req.params;
    try {
        await pool.query('DELETE FROM books_readers WHERE book_id = $1', [bookId])
        const delete_book = await pool.query('DELETE FROM books WHERE id = $1 RETURNING *', [bookId]);
        const result = delete_book.rows[0];
        if (result === undefined) {
            throw new BookNotFoundError();
        }
        res.status(200).send(result);
    } catch (err) {
        if (err.name === "BookNotFoundError") {
            res.status(404).send(err.message)
        } else {
            res.status(400).send(err);
        }
    }
})

export default booksRouter