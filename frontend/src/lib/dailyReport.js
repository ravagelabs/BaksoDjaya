// Laporan harian (PDF A4): pemasukan dari mana, pengeluaran apa saja, akunnya apa, dan saldo kas/bank.
// Dipakai dari tombol shortcut (ikon R) → "Laporan harian".
import { api } from "@/lib/api";
import { printReport } from "@/lib/pdf";
import { assetUrl } from "@/lib/format";
import { useSettingsStore } from "@/stores/settings";

const longDate = (iso) =>
  new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00`));

export async function exportDailyReport(date) {
  const q = `from=${date}&to=${date}`;
  const [journal, cash, accounts] = await Promise.all([
    api(`/finance/report?type=journal&${q}`),
    api(`/finance/report?type=cash&${q}`),
    api("/finance/accounts"),
  ]);
  const byCode = Object.fromEntries(accounts.data.map((a) => [a.code, a]));
  const name = (code) => byCode[code]?.name ?? code;
  const isCash = (code) => Boolean(byCode[code]?.cash);

  const income = []; // [keterangan, masuk ke, jumlah]
  const spend = []; // [keterangan, akun, dibayar dari, jumlah]
  const moves = []; // [keterangan, dari, ke, jumlah]
  for (const e of journal.data.entries) {
    if (e.kind === "saldo_awal") continue; // modal pembukaan masuk saldo awal
    const cashLines = e.lines.filter((l) => isCash(l.account));
    const other = e.lines.filter((l) => !isCash(l.account));
    if (e.source === "penjualan") {
      for (const l of cashLines) income.push([e.description, name(l.account), l.debit]);
      if (!cashLines.length) for (const l of e.lines.filter((x) => x.debit)) income.push([e.description, name(l.account), l.debit]);
      continue;
    }
    if (!other.length) {
      // pindah antar kas/bank
      const from = cashLines.find((l) => l.credit);
      const to = cashLines.find((l) => l.debit);
      if (from && to) moves.push([e.description, name(from.account), name(to.account), to.debit]);
      continue;
    }
    for (const l of cashLines) {
      const counter = other[0]?.account;
      if (l.credit) spend.push([e.description, name(counter), name(l.account), l.credit]);
      if (l.debit) income.push([e.description, name(l.account), l.debit]);
    }
    if (!cashLines.length && e.source === "biaya") {
      const debit = e.lines.find((l) => l.debit);
      spend.push([e.description, name(debit?.account), "-", debit?.debit ?? 0]);
    }
  }
  const total = (rows) => rows.reduce((s, r) => s + Number(r[r.length - 1] || 0), 0);
  const totalIn = total(income);
  const totalOut = total(spend);

  const settings = useSettingsStore();
  if (!settings.loaded) await settings.load().catch(() => {});
  const logo = settings.logo ? new URL(assetUrl(settings.logo), location.origin).href : "";

  const sum = (cells) => ({ className: "sum", cells });
  printReport({
    title: "Laporan Harian",
    period: longDate(date),
    logo,
    sections: [
      {
        heading: "Ringkasan",
        rows: [
          { label: "Total pemasukan", value: totalIn, bold: true },
          { label: "Total pengeluaran", value: -totalOut, bold: true },
          { label: "Selisih hari ini", value: totalIn - totalOut, grand: true },
        ],
      },
      {
        heading: "Pemasukan",
        table: {
          columns: ["Dari", "Masuk ke akun", "Jumlah"],
          align: ["left", "left", "right"],
          rows: income.length ? [...income, sum(["Total pemasukan", "", totalIn])] : [],
        },
      },
      {
        heading: "Pengeluaran",
        table: {
          columns: ["Untuk", "Akun", "Dibayar dari", "Jumlah"],
          align: ["left", "left", "left", "right"],
          rows: spend.length ? [...spend, sum(["Total pengeluaran", "", "", totalOut])] : [],
        },
      },
      ...(moves.length
        ? [{ heading: "Pindah antar kas & bank", table: { columns: ["Keterangan", "Dari", "Ke", "Jumlah"], align: ["left", "left", "left", "right"], rows: moves } }]
        : []),
      {
        heading: "Saldo kas & bank",
        table: {
          columns: ["Akun", "Awal", "Masuk", "Keluar", "Akhir"],
          align: ["left", "right", "right", "right", "right"],
          rows: cash.data.accounts.map((a) => [a.name, a.opening, a.totalIn, a.totalOut, a.closing]),
        },
      },
    ],
    note: income.some((r) => /GoFood|GrabFood/.test(r[0])) ? "Pemasukan GoFood/GrabFood dicatat sebagai piutang sampai dicairkan ke rekening." : "",
  });
}
