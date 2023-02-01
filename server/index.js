import http from 'http';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import booksRouter from './routes/booksRouter.js';
import authorsRouter from './routes/authorsRouter.js';
import readersRouter from './routes/readersRouter.js';
import countRouter from './routes/countRouter.js';


export const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const app = express();
app.use(cors())
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use('/books', booksRouter);
app.use('/authors', authorsRouter);
app.use('/readers', readersRouter);
app.use('/count', countRouter);

app.get('', (req, res) => {
    res.send("Hello World");
});

const port = process.env.PORT || 1234;
app.listen(port, () => {
    console.log(`Up and running at ${port}`)
});