import pgPromise from 'pg-promise'

const pgp = pgPromise();

const dbUrl = process.env.DEV_MODE? process.env.DB_URL_DEV : (process.env.DB_URL_PROD || process.env.DATABASE_URL); 

const db = pgp(dbUrl);

export { pgp };

export default db; 