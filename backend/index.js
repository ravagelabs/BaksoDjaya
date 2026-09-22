import express from 'express';
import cors from 'cors';
import { test } from './db.js';

const app = express();

app.use(express.json());

app.listen(3000, () => {
    test().then((data) => {
        console.log('Current schema:', data);
    });
});
