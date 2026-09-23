import 'dotenv/config'
import pgPromise from 'pg-promise'

const pgp = pgPromise();

const dbUrl = process.env.DEV_MODE? process.env.DB_URL_DEV : process.env.DB_URL_PROD; 

const db = pgp(dbUrl);

export const test = async () => {
    const res = await db.any('SELECT current_schema()');
    return res;
}

