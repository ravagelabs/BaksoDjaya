// Membuat akun login untuk development. Sign up dimatikan di auth.js,
// jadi user pertama harus dibuat langsung di database.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import db from '../db/db.js';

const email = process.env.SEED_USER_EMAIL || 'admin@baksodjaya.local';
const password = process.env.SEED_USER_PASSWORD || 'bakso12345';
const name = process.env.SEED_USER_NAME || 'Admin';

const existing = await db.oneOrNone('SELECT id FROM "user" WHERE email = $1', [email]);

if (existing) {
    console.log(`Seed user ${email} sudah ada, dilewati.`);
} else {
    const userId = randomUUID();
    const hash = await hashPassword(password);

    await db.tx(async (t) => {
        await t.none(
            `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, true, 'owner', now(), now())`,
            [userId, name, email]
        );
        await t.none(
            `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
             VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
            [randomUUID(), userId, hash]
        );
    });

    console.log(`Seed user dibuat: ${email} / ${password}`);
}

await db.$pool.end();
