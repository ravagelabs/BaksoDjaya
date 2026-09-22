import 'dotenv/config'
import pgPromise from 'pg-promise'

const pgp = pgPromise();

const db = pgp(process.env.DB_URL);

export const test = async () => {
    const res = await db.any('SELECT current_schema()');
    return res;
}