// Keamanan & kerapian respons API:
// - requireAuth: semua endpoint data wajib punya sesi login (Better Auth).
// - requireRole: endpoint pengelolaan (menu, HPP, laporan, biaya, shift) hanya untuk role tertentu.
// - safeErrors: pesan error ke browser selalu bahasa Indonesia dan tidak pernah
//   membocorkan detail database. Detail asli tetap tercatat di log server (console.error di route).
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

// Role yang boleh mengelola menu, melihat HPP, laporan, biaya, dan riwayat shift.
export const MANAGER_ROLES = ['owner'];

export async function requireAuth(req, res, next) {
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!session?.user) {
            return res.status(401).json({ error: 'Sesi berakhir. Silakan login lagi.' });
        }
        req.user = session.user;
        next();
    } catch (err) {
        console.error('Error checking session:', err);
        res.status(401).json({ error: 'Sesi berakhir. Silakan login lagi.' });
    }
}

// methods: daftar method yang dibatasi; kosong = semua method.
export function requireRole(roles = MANAGER_ROLES, methods = []) {
    return (req, res, next) => {
        if (methods.length && !methods.includes(req.method)) return next();
        if (!roles.includes(req.user?.role)) {
            return res.status(403).json({ error: 'Akun ini tidak punya akses ke fitur tersebut.' });
        }
        next();
    };
}

const GENERIC = 'Terjadi kendala di server. Coba lagi sebentar lagi.';

// Pesan bawaan route/controller (Inggris) → bahasa Indonesia
const TRANSLATIONS = [
    [/^Failed to (retrieve|fetch) products$/, 'Menu belum bisa dimuat.'],
    [/^Failed to (retrieve|fetch) modifiers$/, 'Pilihan menu belum bisa dimuat.'],
    [/^Failed to (retrieve|fetch) tables$/, 'Data meja belum bisa dimuat.'],
    [/^Failed to (retrieve|fetch) report$/, 'Laporan belum bisa dimuat.'],
    [/^Failed to (retrieve|fetch) shifts$/, 'Riwayat shift belum bisa dimuat.'],
    [/^Failed to (retrieve|fetch) customers$/, 'Data pelanggan belum bisa dimuat.'],
    [/^Failed to (retrieve|fetch) expenses$/, 'Data biaya belum bisa dimuat.'],
    [/^Failed to fetch bills$/, 'Transaksi belum bisa dimuat.'],
    [/^Failed to fetch bill$/, 'Pesanan belum bisa dimuat.'],
    [/^Failed to fetch sales summary$/, 'Ringkasan penjualan belum bisa dimuat.'],
    [/^Failed to fetch kitchen queue$/, 'Antrean dapur belum bisa dimuat.'],
    [/^Failed to update kitchen status$/, 'Status dapur gagal diubah.'],
    [/^Failed to process bill$/, 'Pesanan gagal diproses.'],
    [/^Failed to create customer$/, 'Pelanggan gagal disimpan.'],
    [/^Failed to create expense$/, 'Biaya gagal disimpan.'],
    [/^Failed to delete expense$/, 'Biaya gagal dihapus.'],
    [/^Failed to create product$/, 'Menu gagal disimpan.'],
    [/^Failed to update product$/, 'Menu gagal diubah.'],
    [/^Failed to create shift$/, 'Shift gagal disimpan.'],
    [/^Bill not found$/, 'Pesanan tidak ditemukan.'],
    [/^Bill #?\d+ not found\.?$/, 'Pesanan tidak ditemukan.'],
    [/^Bill with ID \d+ was not found or is already finalized\.$/, 'Pesanan tidak ditemukan atau sudah dibayar.'],
    [/^Finalization failed: .*$/, 'Pesanan tidak ditemukan atau sudah selesai.'],
    [/^Product #\d+ not found\.$/, 'Menu tidak ditemukan.'],
    [/^Expense #\d+ not found\.$/, 'Biaya tidak ditemukan.'],
    [/^Invalid (bill|product|expense) id$/, 'Data tidak valid.'],
    [/^Invalid from\/to date$/, 'Tanggal tidak valid.'],
    [/^date must be YYYY-MM-DD$/, 'Tanggal tidak valid.'],
    [/^Customer name is required\.$/, 'Nama pelanggan wajib diisi.'],
    [/^Expense name is required\.$/, 'Nama biaya wajib diisi.'],
    [/^Amount must be a positive integer\.$/, 'Jumlah harus angka lebih dari 0.'],
    [/^billItems must be a non-empty array\.$/, 'Pesanan masih kosong.'],
    [/^employeeId and grandTotal are required\.$/, 'Data pesanan belum lengkap.'],
    [/^billId is required\.$/, 'Data pesanan belum lengkap.'],
    [/^billId and paymentMethod are required.*$/, 'Pilih metode pembayaran dulu.'],
    [/^kitchenStatus must be one of.*$/, 'Status dapur tidak valid.'],
    [/^(created_at|ended_at) is required.*$/, 'Waktu shift tidak valid.'],
    [/^ended_at cannot be before created_at\.$/, 'Waktu selesai shift tidak boleh sebelum waktu mulai.'],
];

// Pola pesan error Postgres / koneksi — jangan pernah dikirim ke browser
const DB_ERROR = /(relation|column|function|type|schema|constraint|operator) ".*"|does not exist|violates|duplicate key|syntax error|invalid input syntax|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|password authentication|connection terminated|too many clients|deadlock/i;

export function toClientMessage(message) {
    if (typeof message !== 'string' || !message.trim()) return GENERIC;
    if (DB_ERROR.test(message)) return GENERIC;
    for (const [pattern, text] of TRANSLATIONS) {
        if (pattern.test(message)) return text;
    }
    return message;
}

export function safeErrors(req, res, next) {
    const json = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode >= 400 && body && typeof body === 'object' && 'error' in body) {
            const { details, ...rest } = body; // detail teknis tidak ikut dikirim
            return json({ ...rest, error: toClientMessage(body.error) });
        }
        return json(body);
    };
    next();
}
