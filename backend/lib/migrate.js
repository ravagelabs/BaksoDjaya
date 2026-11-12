// Menjalankan semua file di db/migrations secara berurutan.
// Setiap migrasi ditulis idempotent (IF NOT EXISTS), jadi aman dijalankan setiap kali server start.
// Dipanggil otomatis dari index.js sebelum server menerima request,
// dan bisa juga dijalankan manual: `node scripts/migrate.js`.
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { pgp } from '../db/db.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

export async function runMigrations() {
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
        const sql = new pgp.QueryFile(join(dir, file), { minify: false });
        if (sql.error) throw sql.error;
        await db.none(sql);
        console.log(`Migrasi dijalankan: ${file}`);
    }
}
