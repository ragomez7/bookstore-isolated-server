import { Router } from 'express';
import _ from 'lodash';
import { AuthorNotFoundError, hashResponseBody, NotFoundError } from '../../util/index.js';
import { pool } from '../index.js';

const authorsRouter = Router();

authorsRouter.get("/", async (req, res) => {
    let { offset, limit, authorNameTerm, countryOfBirthTerm } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    offset = ["undefined", "null", '', undefined].includes(offset) ? 0 : offset;
    limit = ["undefined", "null", '', undefined].includes(limit) ? null : limit;
    authorNameTerm = ["undefined", "null", ''].includes(authorNameTerm) ? "" : authorNameTerm;
    countryOfBirthTerm = ["undefined", "null", ''].includes(countryOfBirthTerm) ? "" : countryOfBirthTerm;
    console.log("I got here")
    console.log(offset, limit, authorNameTerm, countryOfBirthTerm)
    try {
        const select = await pool.query(`SELECT * FROM authors 
                                            WHERE name ILIKE $1 
                                            AND country_of_birth ILIKE $2 
                                            ORDER BY name
                                            LIMIT $3 
                                            OFFSET $4`, [`%${authorNameTerm}%`, `%${countryOfBirthTerm}%`, limit, offset])
        const authors = select.rows;
        const getAuthorsCount = await pool.query('SELECT count(*) FROM authors');
        const authorsCount = getAuthorsCount.rows[0].count;
        const responseBody = {
            authors,
            authorsCount
        }
        // res.set({
        //     'ETag': hashResponseBody(responseBody),
        //     'Cache-control': 'public, max-age=100'
        // });
        res.status(200).json(responseBody);
    } catch (err) {
        res.status(400).json(err)
    }
})

authorsRouter.get("/countries", async (req, res) => {
    try {
        const select = await pool.query('SELECT DISTINCT country_of_birth FROM authors');
        const countries = select.rows;
        res.set({
            'ETag': hashResponseBody(countries),
            'Cache-control': `public, max-age=${1000*60*60*24}`
        });
        res.status(200).json(countries);
    } catch (err) {
        console.log(err)
    }
})

authorsRouter.get("/:authorId", async (req, res) => {
    const { authorId } = req.params;
    try {
        const select = await pool.query('SELECT * FROM authors WHERE id = $1', [authorId]);
        const author = select.rows[0];
        if (author === undefined) {
            throw new AuthorNotFoundError();
        }
        // res.set({
        //     'ETag': hashResponseBody(result),
        //     'Cache-control': 'public, max-age=604800',
        //     'Last-Modified': result.updatedat
        // });
        const selfURI = `${req.protocol}://${req.get('host')}/authors/${author.id}`;
        const responseBody = {
            author,
            links: {
                self: {
                    href: selfURI
                }
            }
        }
        res.status(200).json(responseBody);
    } catch (err) {
        if (err.name === "AuthorNotFoundError") {
            res.status(404).send(err.message);
        } else {
            res.status(400).send(err);
        }
    }
});

authorsRouter.get('/:authorId/books', async (req, res) => {
    const { authorId } = req.params;
    try {
        const selectAuthor = await pool.query('SELECT * FROM authors WHERE id = $1', [authorId]);
        const author = selectAuthor.rows[0]
        if (author === undefined) {
            throw new AuthorNotFoundError()
        }
        const selectAllBooksByAuthor = await pool.query('SELECT * FROM books WHERE author_id = $1', [authorId]);
        const allBooksByAuthor = selectAllBooksByAuthor.rows;
        // res.set({
        //     'ETag': hashResponseBody(result),
        //     'Cache-control': 'public, max-age=604800',
        // });
        res.status(200).send(allBooksByAuthor);
    } catch (err) {
        if (err.name === 'AuthorNotFoundError') {
            res.status(404).send(err.message)
        } else {
            res.status(400).send(err);
        }
    }
});

authorsRouter.post('/', async (req, res) => {
    let { authorName, countryOfBirth, birthDate, isDead } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    try {
        const insert = await pool.query(`INSERT INTO authors (name, country_of_birth, birth_date, is_dead, createdAt, updatedAt) 
                                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [authorName, countryOfBirth, birthDate, isDead, new Date(), new Date()]);
        const author = insert.rows[0];
        // res.set({
        //     "Location": `${req.protocol}://${req.get('host')}/authors/${result.id}`,
        //     "Last-Modified": result.createdat

        // })
        const selfURI = `${req.protocol}://${req.get('host')}/authors/${author.id}`;
        const responseBody = {
            author,
            links: {
                self: {
                    href: selfURI
                }
            }
        }
        res.status(201).send(responseBody)
    } catch (err) {
        console.log(err)
        if (err) {
            res.status(400).send(err);
        }
    }
});

// Disregard
authorsRouter.post('/multi-insert', async (req, res) => {
    try {
        for (const user of req.body) {
            let { name, country_of_birth, birth_date, is_dead } = user;
            const insert = await pool.query(`INSERT INTO authors (name, country_of_birth, birth_date, is_dead, createdAt, updatedAt) 
                                        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [name, country_of_birth, birth_date, is_dead, new Date(), new Date()]);
            const result = insert.rows[0]; 
        }
        res.status(200).send("Success")
    } catch (err) {
        console.log(err)
        if (err) {
            res.status(400).send(err);
        }
    }
});

authorsRouter.patch('/:authorId', async (req, res) => {
    const { authorId } = req.params;
    const { newAuthorName } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    try {
        const insert = await pool.query('UPDATE authors SET name = $1, updatedAt = $2 WHERE id = $3 RETURNING *', [newAuthorName, new Date(), authorId]);
        const author = insert.rows[0];
        if (author === undefined) {
            throw new AuthorNotFoundError();
        }
        const selfURI = `${req.protocol}://${req.get('host')}/authors/${author.id}`;
        const responseBody = {
            author,
            links: {
                self: {
                    href: selfURI
                }
            }
        }
        res.status(200).send(responseBody);
    } catch (err) {
        if (err.name === "AuthorNotFoundError") {
            res.status(404).send(err.message);
        } else {
            res.status(400).send(err);
        }
    }
});
// WARNING: This operation will delete all of the books which where from the author.
authorsRouter.delete('/:authorId', async (req, res) => {
    const { authorId } = req.params;
    try {
        const selectAllReadersFromAllBooksOfAuthor = await pool.query(`SELECT BR.reader_id FROM books_readers AS BR
                                                                        LEFT JOIN books AS B
                                                                            ON BR.book_id = B.id
                                                                        WHERE B.author_id = $1`, [authorId]);
        const selectAllReadersResult = selectAllReadersFromAllBooksOfAuthor.rows;
        for (const reader of selectAllReadersResult) {
            await pool.query('DELETE FROM books_readers WHERE book_id = $1', [reader.reader_id])
        }
        await pool.query('DELETE FROM books WHERE author_id = $1', [authorId]);
        const deleteAuthor = await pool.query('DELETE FROM authors WHERE id = $1 RETURNING *', [authorId]);
        const result = deleteAuthor.rows[0];
        if (result === undefined) {
            throw new AuthorNotFoundError();
        }
        res.status(200).json(result);
    } catch (err) {
        if (err.name === "AuthorNotFoundError") {
            res.status(404).send(err.message);
        } else {
            res.status(400).send(err);
        }
    }
})

export default authorsRouter;