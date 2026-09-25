import 'dotenv/config'
import express from 'express';
import cors from 'cors';
import billsRouter from './routes/bills.js';
import productsRouter from './routes/products.js'
import { auth } from './auth.js';
import { toNodeHandler } from 'better-auth/node';

const app = express();

const url = process.env.DEV_MODE? process.env.DEV_URL : process.env.PROD_URL;

app.use(cors({
    origin: url,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}))

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use('/bills', billsRouter);

app.use('/products', productsRouter);

app.use('/', (req, res) => {
    res.status(200).json({
        message: 'Ready to send request'
    })
})

app.listen(3000, () => {
        console.log(`Listening on PORT 3000`)
});
