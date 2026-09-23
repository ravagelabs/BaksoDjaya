import 'dotenv/config'
import express from 'express';
import cors from 'cors';
import billsRouter from './routes/bills.js';
import customersRouter from './routes/customers.js'
import employeesRouter from './routes/employees.js'
import productsRouter from './routes/products.js'

const app = express();

const url = process.env.DEV_MODE? process.env.DEV_URL : process.env.PROD_URL;

app.use(cors({
    origin: url
}))

app.use(express.json());

app.use('/bills', billsRouter);

app.use('/customers', customersRouter);

app.use('/employees', employeesRouter)

app.use('/products', productsRouter);

app.listen(3000, () => {
        console.log(`Listening on ${url}`)
});
