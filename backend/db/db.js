import pgPromise from 'pg-promise'

const pgp = pgPromise();

const dbUrl = process.env.DEV_MODE? process.env.DB_URL_DEV : process.env.DB_URL_PROD; 

const db = pgp(dbUrl);

export const addBill = async (customerId, employeeId, totalPrice, status) => {
    try {
        const res = await db.one({
            text: 'INSERT INTO bill(customer_id, employee_id, total_price, status) VALUES ($1, $2, $3, $4)',
            values: [customerId, employeeId, totalPrice, status]
        })

        return res.id
    } catch (err) {

    }
}

export const addBillItems = async (billId, items) => {
    try {
        const res = await db.tx(t => {
            const queries = items.map(item => {
                return t.none({
                    text: 'INSERT INTO bill_item (bill_id, product_id, qty, price) VALUES($1, $2, $3, $4)',
                    values: [billId, item.id, item.productId, item.qty, item.price]
                })
            })
            return t.batch(queries)
        });

        return res;
    } catch (err) {
        
    }
}

export const getProducts = async () => {
    try {
        const res = await db.any('SELECT * FROM product');
        return res; 
    } catch (err) {

    }
}