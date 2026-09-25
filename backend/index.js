import 'dotenv/config'
import express from 'express';
import cors from 'cors';
import billsRouter from './routes/bills.js';
import productsRouter from './routes/products.js'
import { auth } from './auth.js';
import { toNodeHandler } from 'better-auth/node';
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = process.env.DEV_MODE? process.env.DEV_URL : process.env.PROD_URL;

app.use(cors({
    origin: url,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}))

app.use(express.static(path.join(__dirname, 'dist')));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use('/bills', billsRouter);

app.use('/products', productsRouter);

app.get('{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, () => {
        console.log(`Listening on PORT 3000`)
});
