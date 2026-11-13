import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import db from '../db/db.js';

// Akun login POS. Sign up publik dimatikan (auth.js), jadi akun dibuat oleh akun utama dari halaman Pengaturan.
// Peran: 'owner' = Akun utama (semua akses), 'user' = Admin (kasir: tanpa Laporan/Pengaturan).
export const ROLES = ['owner', 'user'];
const MIN_PASSWORD = 8;

const cleanEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const cleanName = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const listUsers = async () =>
    db.any(
        `SELECT id, name, email, role, "createdAt" AS created_at
         FROM "user"
         WHERE role IN ('owner', 'user', 'employee')
         ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, "createdAt" ASC;`
    );

export const createUser = async ({ name, email, password, role }) => {
    const n = cleanName(name);
    const e = cleanEmail(email);
    if (!n) throw new Error('Nama wajib diisi.');
    if (!validEmail(e)) throw new Error('Email tidak valid.');
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
        throw new Error(`Password minimal ${MIN_PASSWORD} karakter.`);
    }
    const r = ROLES.includes(role) ? role : 'user';

    const exists = await db.oneOrNone(`SELECT id FROM "user" WHERE lower(email) = $1;`, [e]);
    if (exists) throw new Error('Email ini sudah dipakai akun lain.');

    const id = randomUUID();
    const hash = await hashPassword(password);
    await db.tx(async (t) => {
        await t.none(
            `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, true, $4, now(), now());`,
            [id, n, e, r]
        );
        await t.none(
            `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
             VALUES ($1, $2, 'credential', $2, $3, now(), now());`,
            [randomUUID(), id, hash]
        );
    });
    return { id, name: n, email: e, role: r };
};

const ownerCount = (t) => t.one(`SELECT count(*)::int AS n FROM "user" WHERE role = 'owner';`).then((r) => r.n);

// Ubah peran dan/atau password. Akun utama terakhir tidak bisa diturunkan.
export const updateUser = async (id, { role, password, name }, actorId) => {
    return db.tx(async (t) => {
        const user = await t.oneOrNone(`SELECT id, role FROM "user" WHERE id = $1 FOR UPDATE;`, [id]);
        if (!user) throw new Error('Akun tidak ditemukan.');

        if (role !== undefined) {
            if (!ROLES.includes(role)) throw new Error('Peran tidak valid.');
            if (user.role === 'owner' && role !== 'owner') {
                if (id === actorId) throw new Error('Tidak bisa menurunkan peran akun sendiri.');
                if ((await ownerCount(t)) <= 1) throw new Error('Harus ada minimal satu akun utama.');
            }
            await t.none(`UPDATE "user" SET role = $2, "updatedAt" = now() WHERE id = $1;`, [id, role]);
        }
        if (name !== undefined) {
            const n = cleanName(name);
            if (!n) throw new Error('Nama wajib diisi.');
            await t.none(`UPDATE "user" SET name = $2, "updatedAt" = now() WHERE id = $1;`, [id, n]);
        }
        if (password !== undefined) {
            if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
                throw new Error(`Password minimal ${MIN_PASSWORD} karakter.`);
            }
            const hash = await hashPassword(password);
            await t.none(
                `UPDATE account SET password = $2, "updatedAt" = now()
                 WHERE "userId" = $1 AND "providerId" = 'credential';`,
                [id, hash]
            );
            // Paksa login ulang di semua perangkat akun tersebut (kecuali akun sendiri)
            if (id !== actorId) await t.none(`DELETE FROM session WHERE "userId" = $1;`, [id]);
        }
        return t.one(`SELECT id, name, email, role FROM "user" WHERE id = $1;`, [id]);
    });
};

// Hapus akun: tidak bisa hapus akun sendiri atau akun utama terakhir.
// Akun yang sudah punya transaksi tidak dihapus (riwayat penjualan tetap utuh): cabut aksesnya saja.
export const deleteUser = async (id, actorId) => {
    if (id === actorId) throw new Error('Tidak bisa menghapus akun sendiri.');
    return db.tx(async (t) => {
        const user = await t.oneOrNone(`SELECT id, role FROM "user" WHERE id = $1 FOR UPDATE;`, [id]);
        if (!user) throw new Error('Akun tidak ditemukan.');
        if (user.role === 'owner' && (await ownerCount(t)) <= 1) throw new Error('Harus ada minimal satu akun utama.');

        await t.none(`DELETE FROM session WHERE "userId" = $1;`, [id]);
        const used = await t.oneOrNone(`SELECT 1 FROM bill WHERE employee_id = $1 LIMIT 1;`, [id]);
        if (used) {
            // Punya riwayat transaksi: kunci akun (hapus kredensial) dan sembunyikan dari daftar
            await t.none(`DELETE FROM account WHERE "userId" = $1;`, [id]);
            await t.none(`UPDATE "user" SET role = 'customer', "updatedAt" = now() WHERE id = $1;`, [id]);
            return { id, archived: true };
        }
        await t.none(`DELETE FROM account WHERE "userId" = $1;`, [id]);
        await t.none(`DELETE FROM "user" WHERE id = $1;`, [id]);
        return { id, archived: false };
    });
};
