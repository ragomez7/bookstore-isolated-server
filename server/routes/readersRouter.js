import { Router } from 'express';
import _ from 'lodash';
import { hashResponseBody, NotFoundError } from '../../util/index.js';
import { pool } from '../index.js';

const readersRouter = Router();

readersRouter.get('/', async (req, res) => {
    let { offset, limit, readerNameTerm } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    offset = ["undefined", "null", '', undefined].includes(offset) ? 0 : offset;
    limit = ["undefined", "null", '', undefined].includes(limit) ? null : limit;
    readerNameTerm = ["undefined", "null", '', undefined].includes(readerNameTerm) ? "" : readerNameTerm;
    try {
        const select = await pool.query(`SELECT * FROM readers
                                            WHERE name ILIKE $1
                                            ORDER BY name
                                            LIMIT $2
                                            OFFSET $3`, [`%${readerNameTerm}%`, limit, offset]);
        const readers = select.rows;
        // res.set({
        //     'ETag': hashResponseBody(result),
        //     'Cache-control': 'public, max-age=604800'
        // });
        const getReadersCount = await pool.query('SELECT count(*) FROM readers');
        const readersCount = getReadersCount.rows[0].count;
        const responseBody = {
            readers,
            readersCount
        }
        res.status(200).send(responseBody);
    } catch (err) {
        res.status(400).send(err);
    }
});

readersRouter.get('/:readerId', async (req, res) => {
    const { readerId } = req.params;
    try {
        const select = await pool.query('SELECT * FROM readers WHERE id = $1', [readerId]);
        const result = select.rows[0];
        if (result === undefined) {
            throw new NotFoundError();
        }
        res.set({
            'ETag': hashResponseBody(result),
            'Cache-control': 'public, max-age=604800',
            'Last-Modified': result.updatedat
        });
        res.status(200).send(result);
    } catch (err) {
        if (err.name === "NotFoundError") {
            res.status(404).send(err.message);
        } else {
            res.status(400).send(err);
        }
        
    }
});
readersRouter.get('/:readerId/books', async (req, res) => {
    const { readerId } = req.params;
    try {
        const select = await pool.query(`SELECT B.* FROM books_readers AS BR 
                                            LEFT JOIN books AS B
                                                ON BR.book_id = B.id
                                             WHERE BR.reader_id = $1`, [readerId]);
        const result = select.rows;
        // res.set({
        //     'ETag': hashResponseBody(result),
        //     'Cache-control': 'public, max-age=604800',
        // });
        res.status(200).send(result);
    } catch (err) {
        res.status(400).send(err);
    }
})

readersRouter.post('/', async (req, res) => {
    const { readerName, readerAge, readerEmail } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    try {
        const insert = await pool.query('INSERT INTO readers (name, age, email, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5) RETURNING *', [readerName, readerAge, readerEmail, new Date(), new Date()]);
        const result = insert.rows[0];
        res.set({
            "Location": `${req.protocol}://${req.get('host')}/readers/${result.id}`,
            "Last-Modified": result.createdat

        })
        res.status(201).send(result);
    } catch (err) {
        res.status(400).send(err);
    }
});

// Discuss this with Duncan
readersRouter.put(`/:readerId/:bookId`, async (req, res) => {
    const { readerId, bookId } = req.params;
    try {
        const insert = await pool.query('INSERT INTO books_readers (book_id, reader_id) VALUES ($1, $2) RETURNING *', [bookId, readerId]);
        const selectInsertedReader = await pool.query('SELECT * FROM readers WHERE id = $1', [readerId]);
        const result = selectInsertedReader.rows[0];
        res.status(200).send(result);
    } catch (err) {
        res.status(400).send(err)
    }
})

//Discuss with Duncan
readersRouter.delete(`/:readerId/:bookId`, async (req, res) => {
    const { readerId, bookId } = req.params;
    try {
        await pool.query('DELETE FROM books_readers WHERE reader_id = $1 AND book_id = $2 RETURNING *', [readerId, bookId]);
        const selectDeletedReader = await pool.query('SELECT * FROM readers WHERE id = $1', [readerId]);
        const readerThatWasDeleted = selectDeletedReader.rows[0];
        res.status(200).json(readerThatWasDeleted);
    } catch (err) {
        res.status(400).send(err)
    }
})
readersRouter.delete('/:readerId', async (req, res) => {
    const { readerId } = req.params;
    try {
        await pool.query('DELETE FROM books_readers WHERE reader_id = $1', [readerId]);
        const deleteReader = await pool.query('DELETE FROM readers WHERE id = $1 RETURNING *', [readerId]);
        const result = deleteReader.rows[0];
        if (result === undefined) {
            throw new NotFoundError();
        }
        res.status(200).send(result);
    } catch (err) {
        if (err.name === "NotFoundError") {
            res.status(404).send(err.message);
        } else {
            res.status(400).send(err);
        }
    }
});

readersRouter.patch('/:readerId', async (req, res) => {
    const { readerId } = req.params;
    const { newReaderName } = _.mapKeys(req.query, (value, key) => _.camelCase(key))
    try {
        const updateName = await pool.query('UPDATE readers SET name = $1, updatedAt = $2 WHERE id = $3 RETURNING *', [newReaderName, new Date(), readerId]);
        const result = updateName.rows[0];
        if (result === undefined) {
            throw new NotFoundError();
        }
        res.status(200).send(result);
    } catch (err) {
        if (err.name === "NotFoundError") {
            res.status(404).send(err.message);
        } else {
            res.status(400).send(err);
        }
    }
})



export default readersRouter;