import 'dotenv/config'
import express from 'express';
import cors from 'cors';
import { test } from './db.js';

const app = express();

const url = process.env.DEV_MODE? process.env.DEV_URL : process.env.PROD_URL;

app.use(cors({
    origin: url
}))

app.use(express.json());

app.get('/', (req, res) => {
    return res.send('Hello from Express')
})

app.listen(3000, () => {
    test().then((data) => {
        console.log('Current schema:', data);
        console.log(`${url}`)
    });
});
