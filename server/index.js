import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import booksRouter from './routes/booksRouter.js';
import authorsRouter from './routes/authorsRouter.js';
import readersRouter from './routes/readersRouter.js';
import countRouter from './routes/countRouter.js';
import { fileURLToPath } from 'url';


export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const app = express();
app.use(cors())
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use('/books', booksRouter);
app.use('/authors', authorsRouter);
app.use('/readers', readersRouter);
app.use('/count', countRouter);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/', express.static(path.join(__dirname, 'dist')))
app.use('/', express.static(path.join(__dirname)))
app.get('/', (req, res) => {
  res.send('Hello World')
});

app.get('/swagger.json', (req, res) => {
  try {
    const swaggerDoc = fs.readFileSync('./swagger.json', 'utf8');
    res.send(swaggerDoc);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

const port = process.env.PORT || 1234;
app.listen(port, () => {
  console.log(`Up and running at ${port}`)
});