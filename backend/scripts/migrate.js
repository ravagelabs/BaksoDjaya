// Jalankan migrasi secara manual. Server juga menjalankannya otomatis saat start (lihat index.js).
// Production: `node scripts/migrate.js` dengan DB_URL_PROD (atau DATABASE_URL) terpasang.
import 'dotenv/config';
import db from '../db/db.js';
import { runMigrations } from '../lib/migrate.js';

await runMigrations();
await db.$pool.end();
