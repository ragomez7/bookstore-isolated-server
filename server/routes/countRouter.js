import { Router } from 'express';
import { pool } from '../index.js';

const countRouter = Router();

countRouter.get('/', async (req, res) => {
    try {
        const select = await pool.query('SELECT count FROM count');
        const count = select.rows[0].count;
        const responseBody = {
            count
        }
        res.status(200).send(responseBody);
    } catch (err) {
        if (err) {
            res.status(200).send(err);
        }
    }
});

countRouter.post('/', async (req, res) => {
    try {
        const select = await pool.query('SELECT count FROM count');
        const newCount = parseInt(select.rows[0].count) + 1;
        const update = await pool.query('UPDATE count SET count = $1 RETURNING *', [newCount]);
        const responseBody = { count: newCount }
        res.status(201).send(responseBody);
    } catch (err) {
        if (err) {
            res.status(400).send(err);
        }
    }
});

export default countRouter;