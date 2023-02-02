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
  host: 'localhost',
  port: 5432,
  user: 'me',
  password: 'password',
  database: 'bookstore'
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
app.get('/', (req, res) => {
  res.send('Hello World')
});

app.get('/swagger.json', (req, res) => {
  try {
    const k = fs.readdirSync(__dirname);
    const swaggerDoc = fs.readFileSync('swagger.json', 'utf8');
    const responseBody = {
      k,
      swaggerDoc
    }
    res.send(responseBody);
  } catch (e) {
    const responseBody = {
      k,
      swaggerDoc
    }
    res.status(500).send(responseBody);
  }
});

const port = process.env.PORT || 1234;
app.listen(port, () => {
  console.log(`Up and running at ${port}`)
});