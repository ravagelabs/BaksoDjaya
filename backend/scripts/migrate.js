// Menjalankan semua file di db/migrations secara berurutan.
// Setiap migrasi ditulis idempotent, jadi aman dijalankan setiap kali backend start.
// Production: `node scripts/migrate.js` dengan DB_URL_PROD terpasang.
import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { pgp } from '../db/db.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
    const sql = new pgp.QueryFile(join(dir, file), { minify: false });
    if (sql.error) throw sql.error;
    await db.none(sql);
    console.log(`Migrasi dijalankan: ${file}`);
}

await db.$pool.end();
