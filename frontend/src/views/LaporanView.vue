<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { Download, FileText, Plus, Trash2, TriangleAlert } from "@lucide/vue";
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

// ---- PDF Laba Rugi (A4, kop logo) ----
function exportPdf() {
  const r = report.value;
  if (!r) return;
  printReport({
    title: "Laporan Laba Rugi",
    period: rangeLabel.value,
    logo: settings.logo ? new URL(assetUrl(settings.logo), location.origin).href : "",
    sections: [
      {
        heading: "Pendapatan",
        rows: [
          { label: "Penjualan", value: r.net_sales, note: `${r.transactions} transaksi` },
          { label: "Harga pokok penjualan (HPP)", value: -r.hpp },
          { label: "Laba kotor", value: r.gross_profit, total: true },
        ],
      },
      {
        heading: "Beban operasional",
        rows: [
          ...(r.expenses_by_category.length
            ? r.expenses_by_category.map((e) => ({ label: e.category, value: -e.total, indent: 1 }))
            : [{ label: "Tidak ada beban di periode ini", value: null, indent: 1 }]),
          { label: "Total beban operasional", value: -r.expenses, total: true },
        ],
      },
      {
        rows: [
          { label: "LABA (RUGI) BERSIH", value: r.net_profit, grand: true },
          { label: "Margin laba bersih", value: `${Math.round(r.net_margin * 100)}%` },
        ],
      },
      {
        heading: "Penerimaan per metode pembayaran",
        table: {
          columns: ["Metode", "Transaksi", "Jumlah", "Porsi"],
          align: ["left", "right", "right", "right"],
          rows: [
            ...r.payments.map((p) => [paymentLabel(p.method), String(p.count), p.total, `${pct(p.total, r.net_sales)}%`]),
            ...(r.payments.length ? [{ className: "sum", cells: ["Total", String(r.transactions), r.net_sales, "100%"] }] : []),
          ],
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
      (r.items_without_hpp ? `Catatan: ${r.items_without_hpp} menu terjual belum memiliki HPP, laba terlihat lebih besar dari sebenarnya. ` : "") +
      (r.cancelled.count ? `${r.cancelled.count} pesanan dibatalkan (Rp ${number.format(r.cancelled.total)}) tidak dihitung.` : ""),
  });
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
  <div class="h-full overflow-y-auto overscroll-contain px-4 py-5 md:px-8 md:py-7">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-[28px] font-bold leading-tight md:text-[32px]">Beranda</h1>
        <p class="mt-1 text-[15px] text-muted-foreground">{{ rangeLabel }} · {{ OUTLET_BRANCH }}</p>
      </div>
      <ExportMenu
        :disabled="!report"
        :items="[
          { label: 'Unduh PDF', icon: 'pdf', action: exportPdf },
          { label: exporting ? 'Menyiapkan...' : 'Unduh Excel (CSV)', icon: 'excel', action: exportCsv, disabled: exporting },
        ]"
      />
    </div>

    <!-- Periode -->
    <div class="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Periode laporan">
      <button
        v-for="p in PERIODS"
        :key="p.key"
        type="button"
        class="h-11 rounded-full px-4 text-[15px] transition-colors"
        :class="period === p.key ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted hover:bg-secondary'"
        :aria-pressed="period === p.key"
        @click="setPeriod(p.key)"
      >
        {{ p.label }}
      </button>
      <span v-if="period === 'custom'" class="flex flex-wrap items-center gap-2">
        <input v-model="from" type="date" :max="todayISO()" aria-label="Dari tanggal" class="h-11 rounded-xl border bg-card px-3 text-[15px] outline-none focus:border-primary" />
        <span class="text-muted-foreground">s/d</span>
        <input v-model="to" type="date" :max="todayISO()" aria-label="Sampai tanggal" class="h-11 rounded-xl border bg-card px-3 text-[15px] outline-none focus:border-primary" />
      </span>
    </div>

    <p v-if="error" class="mt-8 text-[15px] text-destructive">{{ error }}</p>
    <p v-else-if="loading && !report" class="mt-8 text-[15px] text-muted-foreground">Memuat laporan...</p>

    <template v-else-if="report">
      <!-- Angka utama -->
      <div class="mt-6 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4" :class="loading ? 'opacity-60' : ''">
        <div class="rounded-[20px] bg-muted/50 p-5 md:p-6">
          <p class="text-[15px] text-muted-foreground">Penjualan</p>
          <p class="tabular mt-2 whitespace-nowrap text-[21px] font-bold leading-none tracking-tight md:text-[32px]">{{ formatRp(report.net_sales) }}</p>
          <p class="mt-3 text-sm text-muted-foreground">{{ report.transactions }} transaksi · rata-rata {{ formatRp(report.average_ticket) }}</p>
        </div>
        <div class="rounded-[20px] bg-muted/50 p-5 md:p-6">
          <p class="text-[15px] text-muted-foreground">Laba kotor</p>
          <p class="tabular mt-2 whitespace-nowrap text-[21px] font-bold leading-none tracking-tight md:text-[32px]">{{ formatRp(report.gross_profit) }}</p>
          <p class="mt-3 text-sm text-muted-foreground">Penjualan dikurangi HPP {{ formatRp(report.hpp) }}</p>
        </div>
        <div class="rounded-[20px] bg-muted/50 p-5 md:p-6">
          <p class="text-[15px] text-muted-foreground">Biaya operasional</p>
          <p class="tabular mt-2 whitespace-nowrap text-[21px] font-bold leading-none tracking-tight md:text-[32px]">{{ formatRp(report.expenses) }}</p>
          <p class="mt-3 text-sm text-muted-foreground">{{ report.expenses_by_category.length }} kategori</p>
        </div>
        <div class="rounded-[20px] p-5 md:p-6" :class="report.net_profit < 0 ? 'bg-destructive/8' : 'bg-success-soft'">
          <p class="text-[15px] text-muted-foreground">Laba bersih</p>
          <p class="tabular mt-2 whitespace-nowrap text-[21px] font-bold leading-none tracking-tight md:text-[32px]" :class="report.net_profit < 0 ? 'text-destructive' : 'text-success'">
            {{ formatRp(report.net_profit) }}
          </p>
          <p class="mt-3 text-sm text-muted-foreground">Margin {{ Math.round(report.net_margin * 100) }}% dari penjualan</p>
        </div>
      </div>

      <p v-if="report.items_without_hpp" class="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
        <TriangleAlert class="mt-0.5 size-4 shrink-0" />
        {{ report.items_without_hpp }} menu yang terjual belum punya HPP, jadi laba terlihat lebih besar dari sebenarnya.
        Isi HPP di Pengaturan → Menu.
      </p>

      <div class="mt-6 grid gap-5 lg:grid-cols-2">
        <!-- Laba rugi -->
        <section class="rounded-[20px] border p-5 md:p-7">
          <h2 class="text-xl font-semibold md:text-2xl">Laba rugi</h2>
          <p class="text-sm text-muted-foreground">{{ rangeLabel }}</p>
          <dl class="tabular mt-5 grid gap-2.5 text-[15px]">
            <div class="flex justify-between"><dt>Penjualan</dt><dd class="font-semibold">{{ formatRp(report.net_sales) }}</dd></div>
            <div class="flex justify-between text-muted-foreground"><dt>HPP (bahan per porsi)</dt><dd>− {{ formatRp(report.hpp) }}</dd></div>
            <div class="flex justify-between border-t pt-2.5 font-semibold"><dt>Laba kotor</dt><dd>{{ formatRp(report.gross_profit) }}</dd></div>

            <dt class="mt-3 text-sm font-semibold text-muted-foreground">Biaya operasional</dt>
            <div v-if="!report.expenses_by_category.length" class="text-sm text-muted-foreground">Belum ada biaya di periode ini.</div>
            <div v-for="e in report.expenses_by_category" :key="e.category" class="flex justify-between text-muted-foreground">
              <dt>{{ e.category }}</dt><dd>− {{ formatRp(e.total) }}</dd>
            </div>
            <div class="flex justify-between border-t pt-2.5"><dt>Total biaya</dt><dd>− {{ formatRp(report.expenses) }}</dd></div>

            <div class="mt-1 flex items-baseline justify-between rounded-xl px-4 py-3" :class="report.net_profit < 0 ? 'bg-destructive/8 text-destructive' : 'bg-success-soft text-success'">
              <dt class="text-lg font-semibold">Laba bersih</dt>
              <dd class="text-2xl font-bold">{{ formatRp(report.net_profit) }}</dd>
            </div>
          </dl>
          <p v-if="report.cancelled.count" class="mt-3 text-sm text-muted-foreground">
            {{ report.cancelled.count }} pesanan dibatalkan ({{ formatRp(report.cancelled.total) }}) tidak dihitung.
          </p>
        </section>

        <!-- Pembayaran dari mana -->
        <section class="rounded-[20px] border p-5 md:p-7">
          <h2 class="text-xl font-semibold md:text-2xl">Sumber pembayaran</h2>
          <p class="text-sm text-muted-foreground">Uang masuk per metode</p>
          <p v-if="!report.payments.length" class="mt-5 text-[15px] text-muted-foreground">Belum ada transaksi.</p>
          <ul class="mt-5 flex flex-col gap-4">
            <li v-for="p in report.payments" :key="p.method">
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-[16px] font-semibold">{{ paymentLabel(p.method) }}</span>
                <span class="tabular text-[16px] font-semibold">{{ formatRp(p.total) }}</span>
              </div>
              <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${Math.max(pct(p.total, report.net_sales), 2)}%` }" />
              </div>
              <p class="tabular mt-1 text-sm text-muted-foreground">{{ p.count }} transaksi · {{ pct(p.total, report.net_sales) }}%</p>
            </li>
          </ul>
          <div v-if="report.order_types.length" class="mt-6 border-t pt-4">
            <p class="text-sm font-semibold text-muted-foreground">Tipe pesanan</p>
            <div v-for="o in report.order_types" :key="o.type" class="tabular mt-2 flex justify-between text-[15px]">
              <span>{{ orderTypeLabel(o.type) }} · {{ o.count }} transaksi</span><span>{{ formatRp(o.total) }}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <section class="rounded-[20px] border p-5 md:p-7">
          <h2 class="text-xl font-semibold md:text-2xl">{{ singleDay ? "Penjualan per jam" : "Penjualan per hari" }}</h2>
          <p class="mt-1 text-sm text-muted-foreground">Dalam ribuan rupiah</p>
          <div class="mt-6 flex h-56 items-end gap-1.5 md:gap-2.5" role="img" :aria-label="`Grafik penjualan ${rangeLabel}`">
            <div v-for="b in bars" :key="b.key" class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span v-if="b.total && bars.length <= 16" class="tabular text-[11px] text-muted-foreground">{{ number.format(Math.round(b.total / 1000)) }}</span>
              <div
                class="w-full max-w-14 rounded-md"
                :class="b.peak ? 'bg-primary' : 'bg-chart-2'"
                :style="{ height: b.total ? `${Math.max(b.pct, 4)}%` : '3px' }"
                :title="`${b.label} · ${formatRp(b.total)}`"
              />
              <span class="tabular w-full truncate text-center text-[11px] text-muted-foreground md:text-xs">{{ b.label }}</span>
            </div>
          </div>
        </section>

        <section class="rounded-[20px] bg-muted/50 p-5 md:p-7">
          <h2 class="text-xl font-semibold md:text-2xl">Menu terlaris</h2>
          <p v-if="!report.top_products.length" class="mt-5 text-[15px] text-muted-foreground">Belum ada penjualan.</p>
          <ol class="mt-5 flex flex-col gap-3.5">
            <li v-for="(p, i) in report.top_products" :key="p.name" class="flex items-baseline gap-3">
              <span class="tabular w-5 shrink-0 text-sm text-muted-foreground">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1 truncate text-[15px] font-medium">{{ titleCase(p.name) }}</span>
              <span class="tabular shrink-0 text-sm text-muted-foreground">{{ p.qty }} porsi</span>
            </li>
          </ol>
        </section>
      </div>

      <!-- Biaya operasional -->
      <section class="mt-5 rounded-[20px] border p-5 md:p-7">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold md:text-2xl">Biaya operasional</h2>
            <p class="text-sm text-muted-foreground">Catat pengeluaran supaya laba bersih akurat</p>
          </div>
          <Button class="h-11 rounded-xl px-4" @click="ui.quickAction = 'biaya'"><Plus /> Catat biaya</Button>
        </div>



        <p v-if="!expenses.length" class="mt-5 text-[15px] text-muted-foreground">Belum ada biaya di periode ini.</p>
        <ul v-else class="mt-4 flex flex-col divide-y">
          <li v-for="e in expenses" :key="e.id" class="flex items-center gap-3 py-3">
            <span class="tabular w-16 shrink-0 text-sm whitespace-nowrap text-muted-foreground">{{ dayMonth(e.spent_on) }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[15px] font-medium">{{ e.name }}</span>
              <span class="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-xs">{{ e.category }}</span>
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
      </section>

      <p class="mt-5 text-sm text-muted-foreground">
        HPP dihitung dari HPP per menu di Pengaturan. Laba bersih = penjualan − HPP − biaya operasional, belum termasuk pajak.
      </p>
    </template>
  </div>
</template>
