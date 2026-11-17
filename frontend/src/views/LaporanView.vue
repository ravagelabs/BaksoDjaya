<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { Banknote, Bike, Boxes, ChevronDown, ChevronRight, CircleAlert, Package, Plus, Tags, Trash2, Wallet } from "@lucide/vue";
import { useRouter } from "vue-router";
import { printReport } from "@/lib/pdf";
import { assetUrl } from "@/lib/format";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/components/ui/button";
import ExportMenu from "@/components/ExportMenu.vue";
import { api } from "@/lib/api";
import { formatRp, number, shortDate, todayISO, timeOnly, orderTypeLabel, titleCase, PAYMENT_LABELS, OUTLET_BRANCH } from "@/lib/format";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const settings = useSettingsStore();

// ---- Periode laporan ----
// Tanggal dihitung sebagai string YYYY-MM-DD (zona waktu outlet) supaya tidak bergeser
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const prevMonthEnd = (iso) => addDays(monthStart(iso), -1);

const PERIODS = [
  { key: "today", label: "Hari ini", range: (t) => [t, t] },
  { key: "yesterday", label: "Kemarin", range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { key: "7d", label: "7 hari", range: (t) => [addDays(t, -6), t] },
  { key: "month", label: "Bulan ini", range: (t) => [monthStart(t), t] },
  { key: "lastmonth", label: "Bulan lalu", range: (t) => [monthStart(prevMonthEnd(t)), prevMonthEnd(t)] },
  { key: "custom", label: "Pilih tanggal", range: null },
];

const period = ref("today");
const from = ref(todayISO());
const to = ref(todayISO());

function setPeriod(key) {
  period.value = key;
  const p = PERIODS.find((x) => x.key === key);
  if (p.range) [from.value, to.value] = p.range(todayISO());
}

const singleDay = computed(() => from.value === to.value);
const rangeLabel = computed(() => {
  const f = shortDate(`${from.value}T12:00:00+07:00`);
  return singleDay.value ? f : `${f} – ${shortDate(`${to.value}T12:00:00+07:00`)}`;
});

// ---- Data ----
const report = ref(null);
const expenses = ref([]);
const categories = ref([]);
const cashAccounts = ref([]); // saldo Kas & Bank (akun utama saja)
const balance = ref(null);
const stock = ref([]); // stok barang: peringatan hampir habis // neraca per akhir periode (akun utama saja): stok bahan, piutang
const loading = ref(false);
const error = ref("");

async function load() {
  if (from.value > to.value) {
    error.value = "Tanggal awal tidak boleh setelah tanggal akhir.";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const q = `from=${from.value}&to=${to.value}`;
    const [r, e] = await Promise.all([api(`/reports/summary?${q}`), api(`/expenses?${q}`)]);
    report.value = r.data;
    expenses.value = e.data;
    categories.value = e.categories ?? [];
    // Saldo kas & bank sampai akhir periode (laporan keuangan hanya untuk akun utama)
    api(`/finance/report?type=cash&${q}`)
      .then((c) => (cashAccounts.value = c.data.accounts))
      .catch(() => (cashAccounts.value = []));
    api("/stock")
      .then((r) => (stock.value = r.data))
      .catch(() => (stock.value = []));
    api(`/finance/report?type=bs&${q}`)
      .then((b) => (balance.value = b.data))
      .catch(() => (balance.value = null));
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
// Biaya/transfer/aset baru dari tombol + → muat ulang
watch(() => ui.financeVersion, () => load());
watch([from, to], load);

const dayMonth = (iso) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const paymentLabel = (m) => PAYMENT_LABELS[m] ?? titleCase(m);

// Grafik: per jam untuk satu hari, per hari untuk rentang
const bars = computed(() => {
  if (!report.value) return [];
  if (singleDay.value) {
    const hourly = report.value.hourly;
    const hours = hourly.map((h) => h.hour);
    const lo = Math.min(10, ...hours);
    const hi = Math.max(17, ...hours);
    const max = Math.max(1, ...hourly.map((h) => h.total));
    const out = [];
    for (let h = lo; h <= hi; h++) {
      const total = hourly.find((x) => x.hour === h)?.total ?? 0;
      out.push({ key: h, label: `${String(h).padStart(2, "0")}.00`, total, pct: (total / max) * 100, peak: total > 0 && total === max });
    }
    return out;
  }
  const daily = report.value.daily;
  const max = Math.max(1, ...daily.map((d) => d.sales));
  return daily.map((d) => ({
    key: d.date,
    label: daily.length > 14 ? String(Number(d.date.slice(8))) : dayMonth(d.date),
    total: d.sales,
    pct: (d.sales / max) * 100,
    peak: d.sales > 0 && d.sales === max,
  }));
});

// ---- Ringkasan atas: angka utama, tombol kontekstual, "Perlu dicek" ----
const router = useRouter();
const hasFinance = computed(() => cashAccounts.value.length > 0);
const cashOf = (code) => cashAccounts.value.find((a) => a.code === code)?.closing ?? 0;
const assetOf = (code) => Number(balance.value?.assets.find((a) => a.code === code)?.amount ?? 0);
const tunai = computed(() => cashOf("1-1100"));
const otherCash = computed(() => cashAccounts.value.filter((a) => a.code !== "1-1100"));
const shortRp = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : number.format(n));

function quick(action, values = {}, template) {
  ui.quickPreset = { template, values };
  ui.quickAction = action;
}
const TUNAI_LIMIT = 500000; // tunai di atas ini disarankan disetor

const checks = computed(() => {
  const r = report.value;
  if (!r) return [];
  const list = [];
  const low = stock.value.filter((x) => x.qty <= x.min_qty);
  if (low.length)
    list.push({ key: "stokbarang", icon: Boxes, tone: "warning", title: low.length === 1 ? `${low[0].name} ${low[0].qty <= 0 ? "habis" : `sisa ${low[0].qty} ${low[0].unit}`}` : `${low.length} barang hampir habis`, action: "Lihat stok", run: () => router.push("/stok") });
  if (r.items_without_hpp)
    list.push({ key: "hpp", icon: Tags, tone: "warning", title: `${r.items_without_hpp} menu terjual belum ada HPP`, action: "Isi HPP", run: () => router.push({ path: "/pengaturan", query: { bagian: "menu" } }) });
  if (balance.value) {
    const stok = assetOf("1-1600");
    if (stok < 0)
      list.push({ key: "stok", icon: Package, tone: "warning", title: `Stok bahan minus ${formatRp(Math.abs(stok))}`, action: "Catat belanja", run: () => quick("biaya", { category: "Bahan baku", name: "Belanja bahan" }) });
    for (const [code, name, tpl] of [["1-1400", "GoFood", "gofood"], ["1-1500", "GrabFood", "grabfood"]]) {
      const v = assetOf(code);
      if (v > 0) list.push({ key: code, icon: Bike, tone: "info", title: `${name} ${formatRp(v)} belum cair`, action: "Sudah cair", run: () => quick("jurnal", { amount: number.format(v) }, tpl) });
    }
  }
  if (hasFinance.value && tunai.value > TUNAI_LIMIT)
    list.push({ key: "tunai", icon: Banknote, tone: "info", title: `Uang tunai menumpuk ${formatRp(tunai.value)}`, action: "Setor ke BCA", run: () => quick("transfer", { from: "1-1100", to: "1-1200", amount: number.format(tunai.value), description: "Setor tunai ke BCA" }) });
  return list;
});



// Bagian yang dilipat: hanya ringkasan satu baris, buka kalau perlu (diingat di perangkat ini)
const FOLD_KEY = "ravage.beranda.open";
const opened = ref((() => {
  try {
    return new Set(JSON.parse(localStorage.getItem(FOLD_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
})());
function toggleFold(k) {
  const n = new Set(opened.value);
  n.has(k) ? n.delete(k) : n.add(k);
  opened.value = n;
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify([...n]));
  } catch {
    // penyimpanan perangkat tidak tersedia: tetap jalan
  }
}
const folds = computed(() => {
  const r = report.value;
  if (!r) return {};
  const top = r.top_products[0];
  const pay = [...r.payments].sort((a, b) => b.total - a.total)[0];
  return {
    labarugi: `Laba bersih ${formatRp(r.net_profit)}`,
    bayar: pay ? `${paymentLabel(pay.method)} paling banyak · ${pct(pay.total, r.net_sales)}%` : "Belum ada transaksi",
    terlaris: top ? `${titleCase(top.name)} · ${top.qty} porsi` : "Belum ada penjualan",
    biaya: expenses.value.length ? `${expenses.value.length} catatan · ${formatRp(expenses.value.reduce((t, e) => t + Number(e.amount), 0))}` : "Belum ada biaya",
  };
});

// ---- Biaya operasional (dicatat lewat tombol + / Catat biaya) ----
async function removeExpense(e) {
  try {
    await api(`/expenses/${e.id}`, { method: "DELETE" });
    ui.toast(`Biaya ${e.name} dihapus`);
    await load();
  } catch (err) {
    ui.toast(err.message, "error");
  }
}

// ---- PDF Beranda (A4, kop logo): isi Beranda dirangkum dalam satu laporan ----
function exportPdf(mode = "pdf") {
  const r = report.value;
  if (!r) return;
  const acctName = (code) => cashAccounts.value.find((a) => a.code === code)?.name ?? "-";
  const sum = (cells) => ({ className: "sum", cells });
  const multi = !singleDay.value;
  // Mutasi kas & bank selain penjualan (penjualan sudah ada di tabel pembayaran)
  const moves = cashAccounts.value.flatMap((a) =>
    a.rows.filter((x) => x.ref !== "Penjualan").map((x) => ({ ...x, account: a.name }))
  ).sort((x, y) => x.date.localeCompare(y.date));
  const kasTotal = (k) => cashAccounts.value.reduce((t, a) => t + a[k], 0);

  printReport(
    {
      title: "Laporan Usaha",
      period: rangeLabel.value,
      logo: settings.logo ? new URL(assetUrl(settings.logo), location.origin).href : "",
      sections: [
        {
          heading: "Laba rugi",
          rows: [
            { label: "Penjualan", value: r.net_sales, note: `${r.transactions} transaksi` },
            ...(r.discount ? [{ label: "Sudah termasuk diskon", value: -r.discount, indent: 1 }] : []),
            { label: "Harga pokok penjualan (HPP)", value: -r.hpp },
            { label: "Laba kotor", value: r.gross_profit, total: true },
            { label: "Biaya operasional", value: -r.expenses },
            { label: "LABA (RUGI) BERSIH", value: r.net_profit, grand: true },
          ],
        },
        ...(cashAccounts.value.length
          ? [{
              heading: "Kas & bank",
              table: {
                columns: ["Akun", "Awal", "Masuk", "Keluar", "Akhir"],
                align: ["left", "right", "right", "right", "right"],
                rows: [
                  ...cashAccounts.value.map((a) => [a.name, a.opening, a.totalIn, a.totalOut, a.closing]),
                  sum(["Total", kasTotal("opening"), kasTotal("totalIn"), kasTotal("totalOut"), kasTotal("closing")]),
                ],
              },
            }]
          : []),
        ...(moves.length
          ? [{
              heading: "Mutasi kas & bank (selain penjualan)",
              table: {
                columns: [...(multi ? ["Tgl"] : []), "Keterangan", "Akun", "Masuk", "Keluar"],
                align: [...(multi ? ["left"] : []), "left", "left", "right", "right"],
                rows: moves.map((x) => [...(multi ? [dayMonth(x.date)] : []), x.description, x.account, x.in || "", x.out || ""]),
              },
            }]
          : []),
        {
          heading: "Sumber pembayaran",
          table: {
            columns: ["Metode", "Transaksi", "Jumlah", "Porsi"],
            align: ["left", "right", "right", "right"],
            rows: [
              ...r.payments.map((p) => [paymentLabel(p.method), String(p.count), p.total, `${pct(p.total, r.net_sales)}%`]),
              ...(r.payments.length ? [sum(["Total", String(r.transactions), r.net_sales, "100%"])] : []),
            ],
          },
        },
        {
          heading: "Pengeluaran",
          table: {
            columns: [...(multi ? ["Tgl"] : []), "Untuk", "Kategori", "Dibayar dari", "Jumlah"],
            align: [...(multi ? ["left"] : []), "left", "left", "left", "right"],
            rows: expenses.value.length
              ? [
                  ...expenses.value.map((e) => [...(multi ? [dayMonth(e.spent_on)] : []), e.name, e.category, acctName(e.paid_from), e.amount]),
                  sum([...(multi ? [""] : []), "Total", "", "", expenses.value.reduce((t, e) => t + Number(e.amount), 0)]),
                ]
              : [],
          },
        },
        {
          heading: "Menu terlaris",
          table: {
            columns: ["#", "Menu", "Porsi", "Penjualan"],
            align: ["left", "left", "right", "right"],
            rows: r.top_products.map((p, i) => [String(i + 1), titleCase(p.name), String(p.qty), p.total]),
          },
        },
      ],
      note:
        (expenses.value.some((e) => e.category === "Bahan baku") ? "Belanja bahan baku masuk persediaan dan tidak mengurangi laba lagi, karena sudah dihitung lewat HPP. " : "") +
        (r.items_without_hpp ? `Catatan: ${r.items_without_hpp} menu terjual belum memiliki HPP, laba terlihat lebih besar dari sebenarnya. ` : "") +
        (r.cancelled.count ? `${r.cancelled.count} pesanan dibatalkan (Rp ${number.format(r.cancelled.total)}) tidak dihitung.` : ""),
    },
    mode
  );
}

// ---- Ekspor CSV: transaksi + ringkasan laba rugi untuk periode ini ----
const exporting = ref(false);
async function exportCsv() {
  exporting.value = true;
  try {
    const bills = (await api(`/bills?status=paid&from=${from.value}&to=${to.value}`)).data;
    const r = report.value;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["LAPORAN LABA RUGI", rangeLabel.value],
      ["Penjualan", r.net_sales],
      ["HPP", -r.hpp],
      ["Laba kotor", r.gross_profit],
      ...r.expenses_by_category.map((e) => [`Biaya: ${e.category}`, -e.total]),
      ["Laba bersih", r.net_profit],
      [],
      ["PEMBAYARAN", "Transaksi", "Total"],
      ...r.payments.map((p) => [paymentLabel(p.method), p.count, p.total]),
      [],
      ["No", "Tanggal", "Waktu", "Tipe", "Nomor", "Pelanggan", "Kasir", "Metode", "Item", "Total"],
    ];
    for (const b of [...bills].reverse()) {
      const at = b.paid_at ?? b.created_at;
      rows.push([
        b.billId,
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(at)),
        timeOnly(at),
        orderTypeLabel(b.order_type),
        b.table_code ?? "",
        b.customer_name ?? "",
        b.employee_name ?? "",
        paymentLabel(b.payment_method),
        b.billItems.map((i) => `${i.qty}x ${i.name}`).join("; "),
        b.grand_total,
      ]);
    }
    if (expenses.value.length) {
      rows.push([], ["BIAYA", "Tanggal", "Kategori", "Nama", "Jumlah"]);
      for (const e of expenses.value) rows.push(["", e.spent_on, e.category, e.name, e.amount]);
    }
    const csv = "﻿" + rows.map((row) => row.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-bakso-djaya-${from.value}${singleDay.value ? "" : `-sd-${to.value}`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="beranda h-full overflow-y-auto overscroll-contain">
    <div class="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-7">
      <!-- Judul + aksi utama -->
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-[26px] font-bold leading-tight md:text-[32px]">Beranda</h1>
          <p class="mt-0.5 truncate text-sm text-muted-foreground md:text-[15px]">{{ rangeLabel }}</p>
        </div>
        <div class="flex items-center gap-2">
          <ExportMenu
            :disabled="!report"
            :items="[
              { label: 'Unduh PDF', icon: 'pdf', action: () => exportPdf('pdf') },
              { label: 'Cetak', icon: 'print', action: () => exportPdf('print') },
              { label: exporting ? 'Menyiapkan...' : 'Unduh Excel (CSV)', icon: 'excel', action: exportCsv, disabled: exporting },
            ]"
          />
          <button
            type="button"
            class="cta-main press flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-cta pr-4 pl-3.5 text-[15px] font-semibold text-cta-foreground shadow-sm shadow-cta/30"
            @click="quick('biaya')"
          >
            <Plus class="cta-icon size-5" /> Catat biaya
          </button>
        </div>
      </div>

      <!-- Periode: kontrol segmen, satu baris (geser di HP) -->
      <div class="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        <div class="seg inline-flex items-center gap-0.5 rounded-full p-1" role="group" aria-label="Periode laporan">
          <button
            v-for="p in PERIODS"
            :key="p.key"
            type="button"
            class="h-9 shrink-0 rounded-full px-3.5 text-[15px] whitespace-nowrap transition-[background-color,box-shadow,color] duration-(--dur-kecil) ease-(--ease-out) md:h-10 md:px-4"
            :class="period === p.key ? 'bg-white font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            :aria-pressed="period === p.key"
            @click="setPeriod(p.key)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>
      <div v-if="period === 'custom'" class="mt-3 flex flex-wrap items-center gap-2">
        <input v-model="from" type="date" :max="todayISO()" aria-label="Dari tanggal" class="h-11 rounded-xl border bg-card px-3 text-[15px] outline-none focus:border-primary" />
        <span class="text-muted-foreground">s/d</span>
        <input v-model="to" type="date" :max="todayISO()" aria-label="Sampai tanggal" class="h-11 rounded-xl border bg-card px-3 text-[15px] outline-none focus:border-primary" />
      </div>

      <p v-if="error" class="mt-8 text-[15px] text-destructive">{{ error }}</p>
      <p v-else-if="loading && !report" class="mt-8 text-[15px] text-muted-foreground">Memuat laporan...</p>

      <template v-else-if="report">
        <!-- Angka utama: penjualan besar, dua pendamping (HP: berdampingan) -->
        <div class="rise mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4" :class="loading ? 'opacity-60' : ''">
          <div class="glass col-span-2 rounded-[22px] p-5 md:col-span-1 md:p-6">
            <p class="text-sm text-muted-foreground md:text-[15px]">Penjualan</p>
            <p class="tabular mt-1.5 whitespace-nowrap text-[32px] font-bold leading-none tracking-tight md:text-[34px]">{{ formatRp(report.net_sales) }}</p>
            <p class="mt-2.5 text-sm text-muted-foreground">{{ report.transactions }} transaksi</p>
          </div>
          <div class="glass min-w-0 rounded-[22px] p-4 md:p-6">
            <p class="text-sm text-muted-foreground md:text-[15px]">Laba bersih</p>
            <p class="tabular mt-1.5 truncate text-[21px] font-bold leading-none tracking-tight md:text-[34px]" :class="report.net_profit < 0 ? 'text-destructive' : 'text-success'">
              {{ formatRp(report.net_profit) }}
            </p>
            <p class="mt-2.5 hidden text-sm text-muted-foreground md:block">HPP {{ formatRp(report.hpp) }} · biaya {{ formatRp(report.expenses) }}</p>
          </div>
          <div class="glass min-w-0 rounded-[22px] p-4 md:p-6">
            <p class="text-sm text-muted-foreground md:text-[15px]">{{ hasFinance ? "Uang tunai" : "Laba kotor" }}</p>
            <p class="tabular mt-1.5 truncate text-[21px] font-bold leading-none tracking-tight md:text-[34px]">{{ formatRp(hasFinance ? tunai : report.gross_profit) }}</p>
          </div>
        </div>

        <!-- Grafik -->
        <section class="rise glass mt-3 rounded-[22px] p-5 md:mt-4 md:p-6" style="--d: 1">
          <h2 class="text-lg font-semibold md:text-xl">{{ singleDay ? "Per jam" : "Per hari" }}</h2>
          <div class="mt-4 flex h-36 items-end gap-1.5 md:h-48 md:gap-2" role="img" :aria-label="`Grafik penjualan ${rangeLabel}`">
            <div v-for="(b, i) in bars" :key="b.key" class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span v-if="b.total && bars.length <= 16" class="tabular hidden text-[11px] text-muted-foreground md:block">{{ number.format(Math.round(b.total / 1000)) }}rb</span>
              <div
                class="bar w-full max-w-12 origin-bottom rounded-md"
                :class="b.peak ? 'bg-cta' : 'bg-[#e9c9a8]'"
                :style="{ height: b.total ? `${Math.max(b.pct, 4)}%` : '3px' }"
                :title="`${b.label} · ${formatRp(b.total)}`"
              />
              <span class="tabular w-full text-center text-[11px] text-muted-foreground md:text-xs" :class="bars.length > 8 && i % 3 ? 'invisible md:visible' : ''">{{ b.label.replace('.00', '') }}</span>
            </div>
          </div>
        </section>

        <!-- Kas & Bank -->
        <section v-if="hasFinance" class="rise glass mt-3 rounded-[22px] p-5 md:mt-4 md:p-6" style="--d: 2">
          <RouterLink to="/keuangan?laporan=cash" class="flex items-baseline justify-between gap-3">
            <h2 class="text-lg font-semibold md:text-xl">Kas & Bank</h2>
            <span class="tabular flex items-center gap-1 text-[15px] font-semibold">{{ formatRp(cashAccounts.reduce((t, a) => t + a.closing, 0)) }} <ChevronRight class="size-4 text-muted-foreground" /></span>
          </RouterLink>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-3">
            <div v-for="a in cashAccounts" :key="a.code" class="min-w-0 rounded-2xl bg-white/70 px-3.5 py-3 ring-1 ring-black/5 sm:p-4">
              <p class="truncate text-sm text-muted-foreground">{{ a.name }}</p>
              <p class="tabular mt-0.5 truncate text-lg font-bold sm:text-2xl">{{ formatRp(a.closing) }}</p>
            </div>
          </div>
        </section>

        <!-- Detail: dilipat jadi satu baris, buka kalau perlu -->
        <div class="rise glass mt-3 overflow-hidden rounded-[22px] md:mt-4" style="--d: 3">
          <div v-for="(sec, i) in [
              { k: 'labarugi', t: 'Laba rugi' },
              { k: 'bayar', t: 'Sumber pembayaran' },
              { k: 'terlaris', t: 'Menu terlaris' },
              { k: 'biaya', t: 'Biaya operasional' },
            ]" :key="sec.k" :class="i ? 'border-t border-black/5' : ''">
            <button type="button" class="fold-row flex w-full items-center gap-3 px-5 py-3.5 text-left md:px-6 md:py-4" :aria-expanded="opened.has(sec.k)" @click="toggleFold(sec.k)">
              <span class="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline">
                <span class="shrink-0 text-[16px] font-semibold sm:w-52">{{ sec.t }}</span>
                <span class="tabular min-w-0 truncate text-[15px] text-muted-foreground">{{ folds[sec.k] }}</span>
              </span>
              <ChevronDown class="size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-(--ease-out)" :class="opened.has(sec.k) ? 'rotate-180' : ''" />
            </button>
            <Transition name="fold">
              <div v-if="opened.has(sec.k)" class="px-5 pb-5 md:px-6">
                <!-- Laba rugi -->
                <dl v-if="sec.k === 'labarugi'" class="tabular grid max-w-xl gap-2.5 text-[15px]">
                  <div class="flex justify-between"><dt>Penjualan</dt><dd class="font-semibold">{{ formatRp(report.net_sales) }}</dd></div>
                  <div v-if="report.discount" class="flex justify-between text-sm text-muted-foreground">
                    <dt>Sudah termasuk diskon & gratis ({{ report.discount_items }} item)</dt><dd>{{ formatRp(report.discount) }}</dd>
                  </div>
                  <div class="flex justify-between text-muted-foreground"><dt>HPP (bahan per porsi)</dt><dd>− {{ formatRp(report.hpp) }}</dd></div>
                  <div class="flex justify-between border-t pt-2.5 font-semibold"><dt>Laba kotor</dt><dd>{{ formatRp(report.gross_profit) }}</dd></div>
                  <div v-for="e in report.expenses_by_category.filter((x) => x.category !== 'Bahan baku')" :key="e.category" class="flex justify-between text-muted-foreground">
                    <dt>{{ e.category }}</dt><dd>− {{ formatRp(e.total) }}</dd>
                  </div>
                  <div class="flex justify-between border-t pt-2.5"><dt>Total biaya</dt><dd>− {{ formatRp(report.expenses) }}</dd></div>
                  <div class="mt-1 flex items-baseline justify-between rounded-xl px-4 py-3" :class="report.net_profit < 0 ? 'bg-destructive/8 text-destructive' : 'bg-success-soft text-success'">
                    <dt class="text-lg font-semibold">Laba bersih</dt>
                    <dd class="text-2xl font-bold">{{ formatRp(report.net_profit) }}</dd>
                  </div>
                  <p v-if="report.cancelled.count" class="text-sm text-muted-foreground">
                    {{ report.cancelled.count }} pesanan dibatalkan ({{ formatRp(report.cancelled.total) }}) tidak dihitung.
                  </p>
                </dl>

                <!-- Sumber pembayaran -->
                <div v-else-if="sec.k === 'bayar'" class="grid max-w-xl gap-4">
                  <p v-if="!report.payments.length" class="text-[15px] text-muted-foreground">Belum ada transaksi.</p>
                  <div v-for="p in report.payments" :key="p.method">
                    <div class="flex items-baseline justify-between gap-3">
                      <span class="text-[16px] font-semibold">{{ paymentLabel(p.method) }}</span>
                      <span class="tabular text-[16px] font-semibold">{{ formatRp(p.total) }}</span>
                    </div>
                    <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/5">
                      <div class="h-full rounded-full bg-nav" :style="{ width: `${Math.max(pct(p.total, report.net_sales), 2)}%` }" />
                    </div>
                    <p class="tabular mt-1 text-sm text-muted-foreground">{{ p.count }} transaksi · {{ pct(p.total, report.net_sales) }}%</p>
                  </div>
                  <div v-if="report.order_types.length" class="border-t pt-3">
                    <div v-for="o in report.order_types" :key="o.type" class="tabular mt-1 flex justify-between text-[15px]">
                      <span>{{ orderTypeLabel(o.type) }} · {{ o.count }} transaksi</span><span>{{ formatRp(o.total) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Menu terlaris -->
                <ol v-else-if="sec.k === 'terlaris'" class="grid max-w-xl gap-3">
                  <p v-if="!report.top_products.length" class="text-[15px] text-muted-foreground">Belum ada penjualan.</p>
                  <li v-for="(p, n) in report.top_products" :key="p.name" class="flex items-baseline gap-3">
                    <span class="tabular w-5 shrink-0 text-sm text-muted-foreground">{{ n + 1 }}</span>
                    <span class="min-w-0 flex-1 truncate text-[15px] font-medium">{{ titleCase(p.name) }}</span>
                    <span class="tabular shrink-0 text-sm text-muted-foreground">{{ p.qty }} porsi · {{ formatRp(p.total) }}</span>
                  </li>
                </ol>

                <!-- Biaya -->
                <div v-else-if="sec.k === 'biaya'">
                  <p v-if="!expenses.length" class="text-[15px] text-muted-foreground">Belum ada biaya di periode ini.</p>
                  <ul v-else class="flex flex-col divide-y divide-black/5">
                    <li v-for="e in expenses" :key="e.id" class="flex items-center gap-3 py-2.5">
                      <span class="tabular w-16 shrink-0 text-sm whitespace-nowrap text-muted-foreground">{{ dayMonth(e.spent_on) }}</span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[15px] font-medium">{{ e.name }}</span>
                        <span class="mt-0.5 inline-block rounded-full bg-black/5 px-2 py-0.5 text-xs">{{ e.category }}</span>
                      </span>
                      <span class="tabular shrink-0 text-[15px] font-semibold">{{ formatRp(e.amount) }}</span>
                      <button
                        type="button"
                        class="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        :aria-label="`Hapus ${e.name}`"
                        @click="removeExpense(e)"
                      >
                        <Trash2 class="size-4" />
                      </button>
                    </li>
                  </ul>
                  <Button class="mt-3 h-11 rounded-xl px-4" @click="quick('biaya')"><Plus /> Catat biaya</Button>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Perlu dicek (paling bawah) -->
        <section v-if="checks.length" class="rise glass mt-3 rounded-[22px] p-5 md:mt-4 md:p-6" style="--d: 4">
          <h2 class="flex items-center gap-2 text-lg font-semibold md:text-xl">
            Perlu dicek
            <span class="tabular rounded-full bg-cta/10 px-2 py-0.5 text-xs font-semibold text-cta">{{ checks.length }}</span>
          </h2>
          <ul class="mt-2 flex flex-col divide-y divide-black/5">
            <li v-for="c in checks" :key="c.key" class="flex items-center gap-3 py-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full" :class="c.tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-black/5 text-foreground'">
                <component :is="c.icon" class="size-[18px]" />
              </span>
              <span class="min-w-0 flex-1 text-[15px] font-medium leading-snug">{{ c.title }}</span>
              <button type="button" class="press h-9 shrink-0 rounded-full bg-black/5 px-3.5 text-sm font-semibold text-foreground" @click="c.run()">
                {{ c.action }}
              </button>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Latar hangat (warna kaldu) supaya panel kaca terasa; teks tetap di atas panel putih buram */
.beranda {
  background:
    radial-gradient(1200px 520px at 85% -10%, rgb(245 196 140 / 0.45), transparent 60%),
    radial-gradient(900px 480px at -10% 10%, rgb(217 72 15 / 0.10), transparent 60%),
    #f6f3ee;
}
.glass {
  background: rgb(255 255 255 / 0.72);
  border: 1px solid rgb(255 255 255 / 0.8);
  box-shadow: 0 1px 2px rgb(30 20 10 / 0.04), 0 8px 24px -12px rgb(60 30 10 / 0.12);
}
.glass-chip {
  background: rgb(255 255 255 / 0.6);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.05);
}
@supports (backdrop-filter: blur(1px)) {
  .glass { backdrop-filter: blur(18px) saturate(1.3); }
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: #fff; backdrop-filter: none; }
}

.seg { background: rgb(120 100 80 / 0.10); }

/* Tombol utama: ikon + berputar seperempat saat disorot (delight kecil) */
.cta-icon { transition: transform var(--dur-menu) var(--ease-out); }
@media (hover: hover) {
  .cta-main:hover .cta-icon { transform: rotate(90deg); }
  .fold-row:hover { background: rgb(255 255 255 / 0.5); }
}

/* Kartu muncul berurutan saat halaman dibuka (stagger 50ms, maks 5) */
.rise { animation: rise 260ms var(--ease-out) both; animation-delay: calc(var(--d, 0) * 50ms); }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) {
  .rise { animation-name: fade; }
  @keyframes fade { from { opacity: 0; } }
}

/* Bagian dilipat: muncul halus (transform + opacity saja) */
.fold-enter-active { transition: transform 220ms var(--ease-out), opacity 220ms var(--ease-out); }
.fold-enter-from { transform: translateY(-6px); opacity: 0; }

/* Batang grafik tumbuh dari bawah saat dimuat */
.bar { animation: grow 300ms var(--ease-out) both; }
@keyframes grow { from { transform: scaleY(0); } }
</style>
