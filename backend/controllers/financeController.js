import db from "../db/db.js";

const TZ = 'Asia/Jakarta';

// ---- Bagan akun (sederhana, sesuai usaha F&B kecil) ----
// type: asset | liability | equity | revenue | cogs | expense ; cash: akun kas & setara kas
export const ACCOUNTS = [
    { code: '1-1100', name: 'Kas (tunai)', type: 'asset', cash: true },
    { code: '1-1200', name: 'Bank', type: 'asset', cash: true },
    { code: '1-1300', name: 'Saldo QRIS', type: 'asset', cash: true },
    { code: '1-1400', name: 'Piutang GoFood', type: 'asset' },
    { code: '1-1500', name: 'Piutang GrabFood', type: 'asset' },
    { code: '1-1600', name: 'Persediaan bahan', type: 'asset' },
    { code: '1-2100', name: 'Peralatan usaha', type: 'asset', group: 'investing' },
    { code: '2-1100', name: 'Utang usaha', type: 'liability' },
    { code: '2-1200', name: 'Utang pinjaman', type: 'liability', group: 'financing' },
    { code: '3-1100', name: 'Modal pemilik', type: 'equity', group: 'financing' },
    { code: '3-1200', name: 'Prive (penarikan pemilik)', type: 'equity', group: 'financing' },
    { code: '4-1100', name: 'Pendapatan penjualan', type: 'revenue' },
    { code: '4-9100', name: 'Pendapatan lain-lain', type: 'revenue' },
    { code: '5-1100', name: 'HPP bahan baku', type: 'cogs' },
    { code: '5-1200', name: 'HPP kemasan', type: 'cogs' },
    { code: '6-1100', name: 'Beban gaji karyawan', type: 'expense' },
    { code: '6-1200', name: 'Beban sewa tempat', type: 'expense' },
    { code: '6-1300', name: 'Beban listrik & air', type: 'expense' },
    { code: '6-1400', name: 'Beban gas', type: 'expense' },
    { code: '6-1500', name: 'Beban transport', type: 'expense' },
    { code: '6-1600', name: 'Beban marketing', type: 'expense' },
    { code: '6-1700', name: 'Beban perawatan', type: 'expense' },
    { code: '6-1800', name: 'Beban komisi aplikasi', type: 'expense' },
    { code: '6-9100', name: 'Beban lain-lain', type: 'expense' },
];
const BY_CODE = Object.fromEntries(ACCOUNTS.map((a) => [a.code, a]));
export const isAccount = (code) => Boolean(BY_CODE[code]);

// Biaya (halaman Beranda) → akun
const EXPENSE_ACCOUNT = {
    'Bahan baku': '5-1100', 'Kemasan': '5-1200', 'Gaji karyawan': '6-1100', 'Sewa tempat': '6-1200',
    'Listrik & air': '6-1300', 'Gas': '6-1400', 'Transport': '6-1500', 'Marketing': '6-1600',
    'Perawatan': '6-1700', 'Lainnya': '6-9100',
};
// Metode bayar → akun penerimaan
const PAYMENT_ACCOUNT = {
    cash: '1-1100', transfer: '1-1200', card: '1-1200', qris: '1-1300', gofood: '1-1400', grabfood: '1-1500',
};
const PAYMENT_NAME = { cash: 'tunai', transfer: 'transfer', card: 'kartu', qris: 'QRIS', gofood: 'GoFood', grabfood: 'GrabFood' };
export const CASH_SOURCES = ['1-1100', '1-1200', '1-1300'];

// Semua jurnal sampai tanggal `to` (penjualan harian per metode, biaya, jurnal manual)
async function journalUntil(to) {
    const sales = await db.any(
        `SELECT (COALESCE(b.paid_at, b.created_at) AT TIME ZONE '${TZ}')::date::text AS date,
                LOWER(b.payment_method::text) AS method, COUNT(*)::int AS count, SUM(b.grand_total)::bigint AS total
         FROM bill b
         WHERE b.status = 'paid' AND b.payment_method IS NOT NULL
           AND (COALESCE(b.paid_at, b.created_at) AT TIME ZONE '${TZ}')::date <= $1::date
         GROUP BY 1, 2 ORDER BY 1, 2;`,
        [to]
    );
    const expenses = await db.any(
        `SELECT id, spent_on::text AS date, category, name, amount::bigint AS amount, paid_from
         FROM expense WHERE spent_on <= $1::date ORDER BY spent_on, id;`,
        [to]
    );
    const manual = await db.any(
        `SELECT e.id, e.entry_date::text AS date, e.description,
                json_agg(json_build_object('account', l.account_code, 'debit', l.debit, 'credit', l.credit) ORDER BY l.id) AS lines
         FROM journal_entry e JOIN journal_line l ON l.entry_id = e.id
         WHERE e.entry_date <= $1::date
         GROUP BY e.id ORDER BY e.entry_date, e.id;`,
        [to]
    );

    const entries = [];
    for (const s of sales) {
        const acct = PAYMENT_ACCOUNT[s.method] ?? '1-1100';
        const amt = Number(s.total);
        entries.push({
            key: `S-${s.date}-${s.method}`, date: s.date, source: 'penjualan',
            ref: 'Penjualan', description: `Penjualan ${PAYMENT_NAME[s.method] ?? s.method} (${s.count} transaksi)`,
            lines: [{ account: acct, debit: amt, credit: 0 }, { account: '4-1100', debit: 0, credit: amt }],
        });
    }
    for (const e of expenses) {
        const amt = Number(e.amount);
        entries.push({
            key: `E-${e.id}`, date: e.date, source: 'biaya', ref: `Biaya #${e.id}`,
            description: `${e.name} (${e.category})`,
            lines: [
                { account: EXPENSE_ACCOUNT[e.category] ?? '6-9100', debit: amt, credit: 0 },
                { account: isAccount(e.paid_from) ? e.paid_from : '1-1100', debit: 0, credit: amt },
            ],
        });
    }
    for (const m of manual) {
        entries.push({
            key: `J-${m.id}`, id: m.id, date: m.date, source: 'manual', ref: `JU #${m.id}`, description: m.description,
            lines: m.lines.map((l) => ({ account: l.account, debit: Number(l.debit), credit: Number(l.credit) })),
        });
    }
    entries.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date.localeCompare(b.date)));
    return entries;
}

// Saldo normal: aset & beban di debit, lainnya di kredit
const normal = (code, debit, credit) => {
    const t = BY_CODE[code]?.type;
    return t === 'asset' || t === 'expense' || t === 'cogs' ? debit - credit : credit - debit;
};

function balances(entries, filter = () => true) {
    const map = {};
    for (const e of entries) {
        if (!filter(e)) continue;
        for (const l of e.lines) {
            map[l.account] ??= { debit: 0, credit: 0 };
            map[l.account].debit += l.debit;
            map[l.account].credit += l.credit;
        }
    }
    return map;
}

const accountRows = (map, types) =>
    ACCOUNTS.filter((a) => types.includes(a.type) && map[a.code])
        .map((a) => ({ code: a.code, name: a.name, amount: normal(a.code, map[a.code].debit, map[a.code].credit) }))
        .filter((r) => r.amount !== 0);

const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);

export async function getFinanceReport(type, from, to) {
    const all = await journalUntil(to);
    const inRange = (e) => e.date >= from && e.date <= to;
    const before = (e) => e.date < from;

    if (type === 'journal') {
        return { entries: all.filter(inRange) };
    }

    if (type === 'pl') {
        const m = balances(all, inRange);
        const revenue = accountRows(m, ['revenue']);
        const cogs = accountRows(m, ['cogs']);
        const expense = accountRows(m, ['expense']);
        const totalRevenue = sum(revenue);
        const totalCogs = sum(cogs);
        const totalExpense = sum(expense);
        return {
            revenue, cogs, expense, totalRevenue, totalCogs, totalExpense,
            grossProfit: totalRevenue - totalCogs,
            netProfit: totalRevenue - totalCogs - totalExpense,
        };
    }

    if (type === 'bs') {
        // Neraca per tanggal `to`
        const m = balances(all);
        const assets = accountRows(m, ['asset']);
        const liabilities = accountRows(m, ['liability']);
        const equity = accountRows(m, ['equity']);
        const profit = sum(accountRows(m, ['revenue'])) - sum(accountRows(m, ['cogs'])) - sum(accountRows(m, ['expense']));
        const totalAssets = sum(assets);
        const totalLiabilities = sum(liabilities);
        const totalEquity = sum(equity) + profit;
        return {
            asOf: to, assets, liabilities, equity, retainedProfit: profit,
            totalAssets, totalLiabilities, totalEquity,
            balanced: Math.round(totalAssets) === Math.round(totalLiabilities + totalEquity),
        };
    }

    if (type === 'cash') {
        // Kas & bank: saldo awal, mutasi, saldo akhir per akun kas
        const accounts = ACCOUNTS.filter((a) => a.cash).map((a) => {
            const opening = all.filter(before).reduce((s, e) => s + e.lines.filter((l) => l.account === a.code).reduce((x, l) => x + l.debit - l.credit, 0), 0);
            let running = opening;
            const rows = [];
            for (const e of all.filter(inRange)) {
                for (const l of e.lines.filter((x) => x.account === a.code)) {
                    running += l.debit - l.credit;
                    rows.push({ date: e.date, ref: e.ref, description: e.description, in: l.debit, out: l.credit, balance: running });
                }
            }
            const totalIn = rows.reduce((s, r) => s + r.in, 0);
            const totalOut = rows.reduce((s, r) => s + r.out, 0);
            return { code: a.code, name: a.name, opening, totalIn, totalOut, closing: running, rows };
        });
        return { accounts };
    }

    if (type === 'cf') {
        // Arus kas metode langsung: mutasi akun kas, dikelompokkan berdasarkan akun lawan
        const isCash = (code) => BY_CODE[code]?.cash;
        const groups = { operating: {}, investing: {}, financing: {} };
        let opening = 0;
        for (const e of all) {
            const cashNet = e.lines.filter((l) => isCash(l.account)).reduce((s, l) => s + l.debit - l.credit, 0);
            if (before(e)) { opening += cashNet; continue; }
            if (!inRange(e) || cashNet === 0) continue;
            // Akun lawan non-kas (pindah antar kas = net 0, otomatis terlewati)
            const others = e.lines.filter((l) => !isCash(l.account));
            const counter = others[0]?.account;
            const acct = BY_CODE[counter];
            const group = acct?.group === 'investing' ? 'investing' : acct?.group === 'financing' || acct?.type === 'equity' || counter === '2-1200' ? 'financing' : 'operating';
            const label =
                acct?.type === 'revenue' ? 'Penerimaan dari penjualan' :
                counter === '1-1400' || counter === '1-1500' ? 'Pencairan dari GoFood / GrabFood' :
                acct ? (cashNet < 0 ? `Pembayaran ${acct.name.replace(/^Beban /, '').replace(/^HPP /, '')}` : `Penerimaan ${acct.name}`) : 'Lain-lain';
            groups[group][label] = (groups[group][label] ?? 0) + cashNet;
        }
        const toRows = (g) => Object.entries(g).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
        const operating = toRows(groups.operating);
        const investing = toRows(groups.investing);
        const financing = toRows(groups.financing);
        const net = sum(operating) + sum(investing) + sum(financing);
        return {
            operating, investing, financing,
            totalOperating: sum(operating), totalInvesting: sum(investing), totalFinancing: sum(financing),
            net, opening, closing: opening + net,
        };
    }

    throw new Error('Jenis laporan tidak dikenal.');
}

export async function addJournal({ date, description, lines }, userId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('Tanggal tidak valid.');
    if (!description?.trim()) throw new Error('Keterangan wajib diisi.');
    const clean = (lines ?? [])
        .map((l) => ({ account: l.account, debit: Math.round(Number(l.debit) || 0), credit: Math.round(Number(l.credit) || 0) }))
        .filter((l) => l.debit || l.credit);
    if (clean.length < 2) throw new Error('Jurnal minimal 2 baris.');
    for (const l of clean) {
        if (!isAccount(l.account)) throw new Error('Akun tidak valid.');
        if (l.debit < 0 || l.credit < 0 || (l.debit && l.credit)) throw new Error('Isi debit atau kredit saja per baris.');
    }
    const d = clean.reduce((s, l) => s + l.debit, 0);
    const c = clean.reduce((s, l) => s + l.credit, 0);
    if (d !== c) throw new Error('Total debit dan kredit harus sama.');
    return db.tx(async (t) => {
        const e = await t.one(
            `INSERT INTO journal_entry (entry_date, description, created_by) VALUES ($1, $2, $3) RETURNING id;`,
            [date, description.trim(), userId ?? null]
        );
        for (const l of clean) {
            await t.none(`INSERT INTO journal_line (entry_id, account_code, debit, credit) VALUES ($1, $2, $3, $4);`, [e.id, l.account, l.debit, l.credit]);
        }
        return e;
    });
}

export async function deleteJournal(id) {
    const r = await db.result('DELETE FROM journal_entry WHERE id = $1', [id]);
    if (!r.rowCount) throw new Error('Jurnal tidak ditemukan.');
}
