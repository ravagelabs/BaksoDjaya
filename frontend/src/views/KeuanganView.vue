<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { FileText, Plus, Trash2, TriangleAlert, CheckCircle2, X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { api } from "@/lib/api";
import { assetUrl, number, todayISO } from "@/lib/format";
import { printReport, acc } from "@/lib/pdf";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";

// Keuangan (akun utama): Laba Rugi, Neraca, Kas & Bank, Arus Kas, Jurnal Umum.
// Jurnal dibentuk otomatis dari penjualan & biaya, ditambah jurnal manual (modal, setor bank, pencairan, prive).
const ui = useUiStore();
const settings = useSettingsStore();
const route = useRoute();
const router = useRouter();

const TABS = [
  { key: "pl", label: "Laba Rugi", title: "Laporan Laba Rugi" },
  { key: "bs", label: "Neraca", title: "Neraca" },
  { key: "cash", label: "Kas & Bank", title: "Laporan Kas & Bank" },
  { key: "cf", label: "Arus Kas", title: "Laporan Arus Kas" },
  { key: "journal", label: "Jurnal Umum", title: "Jurnal Umum" },
];
const tab = ref(TABS.some((t) => t.key === route.query.laporan) ? route.query.laporan : "pl");
watch(tab, (v) => router.replace({ query: { ...route.query, laporan: v } }));
const current = computed(() => TABS.find((t) => t.key === tab.value));

// ---- Periode ----
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const PRESETS = [
  { key: "today", label: "Hari ini", range: (t) => [t, t] },
  { key: "yesterday", label: "Kemarin", range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { key: "month", label: "Bulan ini", range: (t) => [monthStart(t), t] },
  { key: "lastmonth", label: "Bulan lalu", range: (t) => [monthStart(addDays(monthStart(t), -1)), addDays(monthStart(t), -1)] },
  { key: "year", label: "Tahun ini", range: (t) => [`${t.slice(0, 4)}-01-01`, t] },
  { key: "custom", label: "Pilih tanggal", range: null },
];
const preset = ref("month");
const from = ref(monthStart(todayISO()));
const to = ref(todayISO());
const draftFrom = ref(from.value);
const draftTo = ref(to.value);

function choosePreset(key) {
  preset.value = key;
  const p = PRESETS.find((x) => x.key === key);
  if (!p.range) {
    draftFrom.value = from.value;
    draftTo.value = to.value;
    return;
  }
  [from.value, to.value] = p.range(todayISO());
  load();
}
function applyCustom() {
  if (!draftFrom.value || !draftTo.value || draftFrom.value > draftTo.value) return;
  from.value = draftFrom.value;
  to.value = draftTo.value;
  load();
}

const dayLabel = (iso) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const shortDay = (iso) =>
  new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const periodLabel = computed(() =>
  tab.value === "bs" ? `Per ${dayLabel(to.value)}` : from.value === to.value ? dayLabel(from.value) : `${dayLabel(from.value)} – ${dayLabel(to.value)}`
);

// ---- Data ----
const data = ref(null);
const loading = ref(false);
const error = ref("");
const accounts = ref([]);
const accountName = (code) => accounts.value.find((a) => a.code === code)?.name ?? code;

async function load() {
  loading.value = true;
  error.value = "";
  try {
    data.value = (await api(`/finance/report?type=${tab.value}&from=${from.value}&to=${to.value}`)).data;
  } catch (e) {
    error.value = e.message;
    data.value = null;
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  load();
  try {
    accounts.value = (await api("/finance/accounts")).data;
  } catch {
    // daftar akun dipakai untuk nama & form jurnal
  }
});
watch(tab, () => {
  data.value = null;
  load();
});

const money = (n) => acc(n);

// ---- PDF per laporan ----
function exportPdf() {
  const d = data.value;
  if (!d) return;
  const logo = settings.logo ? new URL(assetUrl(settings.logo), location.origin).href : "";
  const doc = { title: current.value.title, period: periodLabel.value, logo, sections: [] };
  const lines = (rows) => rows.map((r) => ({ label: `${r.code}  ${r.name}`, value: r.amount, indent: 1 }));

  if (tab.value === "pl") {
    doc.sections = [
      { heading: "Pendapatan", rows: [...lines(d.revenue), { label: "Total pendapatan", value: d.totalRevenue, total: true }] },
      { heading: "Harga pokok penjualan", rows: [...lines(d.cogs), { label: "Total HPP", value: d.totalCogs, total: true }] },
      { rows: [{ label: "LABA KOTOR", value: d.grossProfit, bold: true }] },
      { heading: "Beban operasional", rows: [...lines(d.expense), { label: "Total beban operasional", value: d.totalExpense, total: true }] },
      { rows: [{ label: "LABA (RUGI) BERSIH", value: d.netProfit, grand: true }] },
    ];
  } else if (tab.value === "bs") {
    doc.sections = [
      { heading: "Aset", rows: [...lines(d.assets), { label: "TOTAL ASET", value: d.totalAssets, grand: true }] },
      { heading: "Kewajiban", rows: [...lines(d.liabilities), { label: "Total kewajiban", value: d.totalLiabilities, total: true }] },
      {
        heading: "Ekuitas",
        rows: [
          ...lines(d.equity),
          { label: "Laba ditahan & laba berjalan", value: d.retainedProfit, indent: 1 },
          { label: "Total ekuitas", value: d.totalEquity, total: true },
        ],
      },
      { rows: [{ label: "TOTAL KEWAJIBAN & EKUITAS", value: d.totalLiabilities + d.totalEquity, grand: true }] },
    ];
  } else if (tab.value === "cash") {
    doc.sections = d.accounts.map((a) => ({
      heading: `${a.code}  ${a.name}`,
      table: {
        columns: ["Tanggal", "Referensi", "Keterangan", "Masuk", "Keluar", "Saldo"],
        align: ["left", "left", "left", "right", "right", "right"],
        rows: [
          { cells: [shortDay(from.value), "", "Saldo awal", "", "", a.opening] },
          ...a.rows.map((r) => [shortDay(r.date), r.ref, r.description, r.in || "", r.out || "", r.balance]),
          { className: "sum", cells: ["", "", "Saldo akhir", a.totalIn, a.totalOut, a.closing] },
        ],
      },
    }));
  } else if (tab.value === "cf") {
    const block = (heading, rows, total, label) => ({
      heading,
      rows: [
        ...(rows.length ? rows.map((r) => ({ label: r.label, value: r.amount, indent: 1 })) : [{ label: "Tidak ada", value: null, indent: 1 }]),
        { label, value: total, total: true },
      ],
    });
    doc.sections = [
      block("Arus kas dari aktivitas operasional", d.operating, d.totalOperating, "Kas bersih dari operasional"),
      block("Arus kas dari aktivitas investasi", d.investing, d.totalInvesting, "Kas bersih dari investasi"),
      block("Arus kas dari aktivitas pendanaan", d.financing, d.totalFinancing, "Kas bersih dari pendanaan"),
      {
        rows: [
          { label: "Kenaikan (penurunan) kas bersih", value: d.net, bold: true },
          { label: "Saldo kas awal periode", value: d.opening },
          { label: "SALDO KAS AKHIR PERIODE", value: d.closing, grand: true },
        ],
      },
    ];
    doc.note = "Kas = Kas (tunai) + Bank + Saldo QRIS. Pemindahan antar akun kas tidak dihitung sebagai arus kas.";
  } else if (tab.value === "journal") {
    const rows = [];
    for (const e of d.entries) {
      e.lines.forEach((l, i) =>
        rows.push([i === 0 ? shortDay(e.date) : "", i === 0 ? e.ref : "", i === 0 ? e.description : "", `${l.account} ${accountName(l.account)}`, l.debit || "", l.credit || ""])
      );
    }
    const td = d.entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0);
    const tc = d.entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.credit, 0), 0);
    doc.sections = [
      {
        table: {
          columns: ["Tanggal", "Ref", "Keterangan", "Akun", "Debit", "Kredit"],
          align: ["left", "left", "left", "left", "right", "right"],
          rows: [...rows, ...(rows.length ? [{ className: "sum", cells: ["", "", "", "Total", td, tc] }] : [])],
        },
      },
    ];
  }
  printReport(doc);
}

// ---- Jurnal manual ----
const TEMPLATES = [
  { key: "modal", label: "Setor modal", description: "Setoran modal pemilik", debit: "1-1100", credit: "3-1100" },
  { key: "setor", label: "Setor tunai ke bank", description: "Setor tunai ke bank", debit: "1-1200", credit: "1-1100" },
  { key: "qris", label: "Pencairan QRIS", description: "Pencairan saldo QRIS ke bank", debit: "1-1200", credit: "1-1300" },
  { key: "gofood", label: "Pencairan GoFood", description: "Pencairan GoFood ke bank", debit: "1-1200", credit: "1-1400" },
  { key: "grabfood", label: "Pencairan GrabFood", description: "Pencairan GrabFood ke bank", debit: "1-1200", credit: "1-1500" },
  { key: "prive", label: "Prive / ambil uang pemilik", description: "Penarikan oleh pemilik", debit: "3-1200", credit: "1-1100" },
  { key: "alat", label: "Beli peralatan", description: "Pembelian peralatan usaha", debit: "1-2100", credit: "1-1100" },
  { key: "bebas", label: "Jurnal bebas", description: "", debit: "", credit: "" },
];
const showJournal = ref(false);
const jForm = ref({ date: todayISO(), description: "", lines: [] });
const jSaving = ref(false);
const jError = ref("");

function openJournal(t = TEMPLATES[0]) {
  jForm.value = {
    template: t.key,
    date: to.value > todayISO() ? todayISO() : to.value,
    description: t.description,
    lines: [
      { account: t.debit, debit: "", credit: "" },
      { account: t.credit, debit: "", credit: "" },
    ],
  };
  jError.value = "";
  showJournal.value = true;
}
// Template sederhana: cukup isi satu jumlah, debit & kredit terisi sama
const simple = computed(() => jForm.value.template && jForm.value.template !== "bebas");
const simpleAmount = ref("");
watch(showJournal, (v) => v && (simpleAmount.value = ""));
const parse = (v) => Number(String(v ?? "").replace(/\D/g, "")) || 0;
const fmtInput = (e, set) => {
  const d = e.target.value.replace(/\D/g, "");
  const v = d ? number.format(Number(d)) : "";
  e.target.value = v;
  set(v);
};
const jTotals = computed(() => {
  if (simple.value) return { d: parse(simpleAmount.value), c: parse(simpleAmount.value) };
  return {
    d: jForm.value.lines.reduce((s, l) => s + parse(l.debit), 0),
    c: jForm.value.lines.reduce((s, l) => s + parse(l.credit), 0),
  };
});

async function saveJournal() {
  jError.value = "";
  const lines = simple.value
    ? [
        { account: jForm.value.lines[0].account, debit: parse(simpleAmount.value), credit: 0 },
        { account: jForm.value.lines[1].account, debit: 0, credit: parse(simpleAmount.value) },
      ]
    : jForm.value.lines.map((l) => ({ account: l.account, debit: parse(l.debit), credit: parse(l.credit) }));
  jSaving.value = true;
  try {
    await api("/finance/journal", { method: "POST", body: { date: jForm.value.date, description: jForm.value.description, lines } });
    ui.toast("Jurnal disimpan");
    showJournal.value = false;
    load();
  } catch (e) {
    jError.value = e.message;
  } finally {
    jSaving.value = false;
  }
}

const delEntry = ref(null);
async function removeEntry() {
  const e = delEntry.value;
  delEntry.value = null;
  try {
    await api(`/finance/journal/${e.id}`, { method: "DELETE" });
    ui.toast(`${e.ref} dihapus`);
    load();
  } catch (err) {
    ui.toast(err.message, "error");
  }
}

const journalTotals = computed(() => {
  const es = data.value?.entries ?? [];
  return {
    d: es.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0),
    c: es.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.credit, 0), 0),
  };
});
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-4 py-5 md:px-8 md:py-7">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-[28px] font-bold leading-tight md:text-[32px]">Keuangan</h1>
        <p class="mt-1 text-[15px] text-muted-foreground">Laporan keuangan dari penjualan, biaya, dan jurnal.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="secondary" class="h-12 rounded-xl px-5 text-base" @click="openJournal()"><Plus /> Catat jurnal</Button>
        <Button class="h-12 rounded-xl px-5 text-base font-semibold" :disabled="!data || loading" @click="exportPdf"><FileText /> Unduh PDF</Button>
      </div>
    </div>

    <!-- Jenis laporan -->
    <nav class="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1.5 [scrollbar-width:none]" aria-label="Jenis laporan">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        class="h-11 shrink-0 rounded-xl px-4 text-[15px] transition md:flex-1"
        :class="tab === t.key ? 'bg-card font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
        :aria-current="tab === t.key ? 'page' : undefined"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <!-- Periode -->
    <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Periode">
      <button
        v-for="p in PRESETS"
        :key="p.key"
        type="button"
        class="h-10 rounded-full px-4 text-[15px] transition-colors"
        :class="preset === p.key ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted hover:bg-secondary'"
        :aria-pressed="preset === p.key"
        @click="choosePreset(p.key)"
      >
        {{ p.label }}
      </button>
    </div>
    <form v-if="preset === 'custom'" class="mt-3 flex flex-wrap items-end gap-2 rounded-2xl bg-muted/60 p-3" @submit.prevent="applyCustom">
      <label class="grid gap-1 text-sm font-semibold">Dari tanggal
        <input v-model="draftFrom" type="date" required class="h-11 rounded-xl border bg-card px-3 text-[15px] font-normal outline-none focus:border-primary" />
      </label>
      <label class="grid gap-1 text-sm font-semibold">Sampai tanggal
        <input v-model="draftTo" type="date" required class="h-11 rounded-xl border bg-card px-3 text-[15px] font-normal outline-none focus:border-primary" />
      </label>
      <Button type="submit" class="h-11 rounded-xl px-6" :disabled="!draftFrom || !draftTo || draftFrom > draftTo || loading">
        {{ loading ? "Memuat..." : "Tampilkan" }}
      </Button>
      <p v-if="draftFrom > draftTo" class="w-full text-sm text-destructive">Tanggal awal tidak boleh setelah tanggal akhir.</p>
    </form>

    <!-- Kertas laporan -->
    <article class="mt-5 rounded-[20px] border p-5 md:p-8" :class="loading ? 'opacity-60' : ''">
      <header class="flex flex-wrap items-end justify-between gap-2 border-b-2 border-foreground pb-3">
        <div>
          <h2 class="text-2xl font-bold">{{ current.title }}</h2>
          <p class="text-[15px] text-muted-foreground">{{ periodLabel }}</p>
        </div>
        <p class="text-sm text-muted-foreground">Dalam rupiah</p>
      </header>

      <p v-if="error" class="mt-5 text-[15px] text-destructive">{{ error }}</p>
      <p v-else-if="!data" class="mt-5 text-[15px] text-muted-foreground">Memuat laporan...</p>

      <!-- Laba Rugi -->
      <div v-else-if="tab === 'pl'" class="tabular mt-4 grid gap-1 text-[15px]">
        <p class="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pendapatan</p>
        <div v-for="r in data.revenue" :key="r.code" class="flex justify-between py-1 pl-4"><span>{{ r.code }} {{ r.name }}</span><span>{{ money(r.amount) }}</span></div>
        <div class="flex justify-between border-t py-1.5 font-semibold"><span>Total pendapatan</span><span>{{ money(data.totalRevenue) }}</span></div>

        <p class="mt-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Harga pokok penjualan</p>
        <div v-for="r in data.cogs" :key="r.code" class="flex justify-between py-1 pl-4"><span>{{ r.code }} {{ r.name }}</span><span>{{ money(r.amount) }}</span></div>
        <p v-if="!data.cogs.length" class="py-1 pl-4 text-muted-foreground">Tidak ada</p>
        <div class="flex justify-between border-t py-1.5 font-semibold"><span>Total HPP</span><span>{{ money(data.totalCogs) }}</span></div>
        <div class="flex justify-between border-y-2 border-foreground py-2 text-lg font-bold"><span>Laba kotor</span><span>{{ money(data.grossProfit) }}</span></div>

        <p class="mt-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Beban operasional</p>
        <div v-for="r in data.expense" :key="r.code" class="flex justify-between py-1 pl-4"><span>{{ r.code }} {{ r.name }}</span><span>{{ money(r.amount) }}</span></div>
        <p v-if="!data.expense.length" class="py-1 pl-4 text-muted-foreground">Tidak ada</p>
        <div class="flex justify-between border-t py-1.5 font-semibold"><span>Total beban operasional</span><span>{{ money(data.totalExpense) }}</span></div>

        <div class="mt-2 flex justify-between rounded-xl px-4 py-3 text-xl font-bold" :class="data.netProfit < 0 ? 'bg-destructive/8 text-destructive' : 'bg-success-soft text-success'">
          <span>Laba (rugi) bersih</span><span>{{ money(data.netProfit) }}</span>
        </div>
      </div>

      <!-- Neraca -->
      <div v-else-if="tab === 'bs'" class="mt-4">
        <p class="flex items-center gap-2 text-sm font-medium" :class="data.balanced ? 'text-success' : 'text-destructive'">
          <CheckCircle2 v-if="data.balanced" class="size-4" /><TriangleAlert v-else class="size-4" />
          {{ data.balanced ? "Seimbang: Aset = Kewajiban + Ekuitas" : "Tidak seimbang, periksa jurnal" }}
        </p>
        <div class="tabular mt-3 grid gap-6 text-[15px] lg:grid-cols-2">
          <section>
            <p class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Aset</p>
            <div v-for="r in data.assets" :key="r.code" class="flex justify-between py-1 pl-4"><span>{{ r.code }} {{ r.name }}</span><span>{{ money(r.amount) }}</span></div>
            <p v-if="!data.assets.length" class="py-1 pl-4 text-muted-foreground">Tidak ada</p>
            <div class="mt-1 flex justify-between border-y-2 border-foreground py-2 text-lg font-bold"><span>Total aset</span><span>{{ money(data.totalAssets) }}</span></div>
          </section>
          <section>
            <p class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kewajiban</p>
            <div v-for="r in data.liabilities" :key="r.code" class="flex justify-between py-1 pl-4"><span>{{ r.code }} {{ r.name }}</span><span>{{ money(r.amount) }}</span></div>
            <p v-if="!data.liabilities.length" class="py-1 pl-4 text-muted-foreground">Tidak ada</p>
            <div class="flex justify-between border-t py-1.5 font-semibold"><span>Total kewajiban</span><span>{{ money(data.totalLiabilities) }}</span></div>
            <p class="mt-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ekuitas</p>
            <div v-for="r in data.equity" :key="r.code" class="flex justify-between py-1 pl-4"><span>{{ r.code }} {{ r.name }}</span><span>{{ money(r.amount) }}</span></div>
            <div class="flex justify-between py-1 pl-4"><span>Laba ditahan & laba berjalan</span><span>{{ money(data.retainedProfit) }}</span></div>
            <div class="flex justify-between border-t py-1.5 font-semibold"><span>Total ekuitas</span><span>{{ money(data.totalEquity) }}</span></div>
            <div class="mt-1 flex justify-between border-y-2 border-foreground py-2 text-lg font-bold"><span>Total kewajiban & ekuitas</span><span>{{ money(data.totalLiabilities + data.totalEquity) }}</span></div>
          </section>
        </div>
        <p class="mt-4 text-sm text-muted-foreground">Neraca dihitung dari semua jurnal sampai tanggal akhir periode.</p>
      </div>

      <!-- Kas & Bank -->
      <div v-else-if="tab === 'cash'" class="mt-4 grid gap-6">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div v-for="a in data.accounts" :key="a.code" class="rounded-xl bg-muted/60 p-4">
            <p class="text-sm text-muted-foreground">{{ a.name }}</p>
            <p class="tabular mt-1 text-2xl font-bold">{{ money(a.closing) }}</p>
            <p class="tabular mt-1 text-xs text-muted-foreground">Awal {{ money(a.opening) }} · Masuk {{ money(a.totalIn) }} · Keluar {{ money(a.totalOut) }}</p>
          </div>
        </div>
        <section v-for="a in data.accounts" :key="a.code">
          <h3 class="text-lg font-semibold">{{ a.code }} {{ a.name }}</h3>
          <div class="mt-2 overflow-x-auto">
            <table class="tabular w-full min-w-[640px] text-[14px]">
              <thead>
                <tr class="border-b-2 border-foreground text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th class="py-2 pr-2">Tanggal</th><th class="pr-2">Ref</th><th class="pr-2">Keterangan</th>
                  <th class="pr-2 text-right">Masuk</th><th class="pr-2 text-right">Keluar</th><th class="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b"><td class="py-1.5">{{ shortDay(from) }}</td><td></td><td class="text-muted-foreground">Saldo awal</td><td></td><td></td><td class="text-right">{{ money(a.opening) }}</td></tr>
                <tr v-for="(r, i) in a.rows" :key="i" class="border-b">
                  <td class="py-1.5 pr-2 whitespace-nowrap">{{ shortDay(r.date) }}</td>
                  <td class="pr-2 whitespace-nowrap text-muted-foreground">{{ r.ref }}</td>
                  <td class="pr-2">{{ r.description }}</td>
                  <td class="pr-2 text-right">{{ r.in ? money(r.in) : "" }}</td>
                  <td class="pr-2 text-right">{{ r.out ? money(r.out) : "" }}</td>
                  <td class="text-right">{{ money(r.balance) }}</td>
                </tr>
                <tr class="border-t-2 border-foreground font-semibold">
                  <td class="py-2" colspan="3">Saldo akhir</td>
                  <td class="text-right">{{ money(a.totalIn) }}</td><td class="text-right">{{ money(a.totalOut) }}</td><td class="text-right">{{ money(a.closing) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Arus Kas -->
      <div v-else-if="tab === 'cf'" class="tabular mt-4 grid gap-1 text-[15px]">
        <template
          v-for="g in [
            { t: 'Aktivitas operasional', rows: data.operating, total: data.totalOperating },
            { t: 'Aktivitas investasi', rows: data.investing, total: data.totalInvesting },
            { t: 'Aktivitas pendanaan', rows: data.financing, total: data.totalFinancing },
          ]"
          :key="g.t"
        >
          <p class="mt-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Arus kas dari {{ g.t.toLowerCase() }}</p>
          <div v-for="r in g.rows" :key="r.label" class="flex justify-between py-1 pl-4"><span>{{ r.label }}</span><span>{{ money(r.amount) }}</span></div>
          <p v-if="!g.rows.length" class="py-1 pl-4 text-muted-foreground">Tidak ada</p>
          <div class="flex justify-between border-t py-1.5 font-semibold"><span>Kas bersih dari {{ g.t.toLowerCase() }}</span><span>{{ money(g.total) }}</span></div>
        </template>
        <div class="mt-3 flex justify-between py-1 font-semibold"><span>Kenaikan (penurunan) kas bersih</span><span>{{ money(data.net) }}</span></div>
        <div class="flex justify-between py-1"><span>Saldo kas awal periode</span><span>{{ money(data.opening) }}</span></div>
        <div class="flex justify-between border-y-2 border-foreground py-2 text-lg font-bold"><span>Saldo kas akhir periode</span><span>{{ money(data.closing) }}</span></div>
        <p class="mt-3 text-sm text-muted-foreground">Kas = Kas (tunai) + Bank + Saldo QRIS. Pemindahan antar akun kas tidak dihitung.</p>
      </div>

      <!-- Jurnal Umum -->
      <div v-else-if="tab === 'journal'" class="mt-4">
        <p v-if="!data.entries.length" class="text-[15px] text-muted-foreground">Belum ada jurnal di periode ini.</p>
        <div v-else class="overflow-x-auto">
          <table class="tabular w-full min-w-[720px] text-[14px]">
            <thead>
              <tr class="border-b-2 border-foreground text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th class="py-2 pr-2">Tanggal</th><th class="pr-2">Ref</th><th class="pr-2">Keterangan / akun</th>
                <th class="pr-2 text-right">Debit</th><th class="pr-2 text-right">Kredit</th><th class="w-10"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="e in data.entries" :key="e.key">
                <tr class="border-t">
                  <td class="pt-2 pr-2 align-top whitespace-nowrap">{{ shortDay(e.date) }}</td>
                  <td class="pt-2 pr-2 align-top whitespace-nowrap text-muted-foreground">{{ e.ref }}</td>
                  <td class="pt-2 pr-2 font-medium" colspan="3">{{ e.description }}</td>
                  <td class="pt-1 text-right align-top">
                    <button
                      v-if="e.source === 'manual'"
                      type="button"
                      class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      :aria-label="`Hapus ${e.ref}`"
                      @click="delEntry = e"
                    >
                      <Trash2 class="size-4" />
                    </button>
                  </td>
                </tr>
                <tr v-for="(l, i) in e.lines" :key="i" :class="i === e.lines.length - 1 ? 'pb-2' : ''">
                  <td></td><td></td>
                  <td class="py-0.5 pr-2" :class="l.credit ? 'pl-8' : 'pl-3'">{{ l.account }} {{ accountName(l.account) }}</td>
                  <td class="pr-2 text-right">{{ l.debit ? money(l.debit) : "" }}</td>
                  <td class="pr-2 text-right">{{ l.credit ? money(l.credit) : "" }}</td>
                  <td></td>
                </tr>
              </template>
              <tr class="border-t-2 border-foreground font-semibold">
                <td class="py-2" colspan="3">Total</td>
                <td class="pr-2 text-right">{{ money(journalTotals.d) }}</td><td class="pr-2 text-right">{{ money(journalTotals.c) }}</td><td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm text-muted-foreground">
          Penjualan & biaya tercatat otomatis. Jurnal manual (modal, setor bank, pencairan, prive) bisa dihapus.
        </p>
      </div>
    </article>

    <!-- Catat jurnal -->
    <Dialog v-model:open="showJournal">
      <DialogContent class="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-xl sm:p-8">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">Catat jurnal</DialogTitle>
          <DialogDescription class="text-[15px]">Pilih jenis transaksi, lalu isi tanggal dan jumlah.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="t in TEMPLATES"
            :key="t.key"
            type="button"
            class="h-9 rounded-full px-3 text-sm transition-colors"
            :class="jForm.template === t.key ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted hover:bg-secondary'"
            @click="openJournal(t)"
          >
            {{ t.label }}
          </button>
        </div>
        <form class="grid gap-3" @submit.prevent="saveJournal">
          <div class="grid grid-cols-[10rem_1fr] gap-3">
            <label class="grid gap-1 text-sm font-semibold">Tanggal
              <input v-model="jForm.date" type="date" required class="h-11 rounded-xl border bg-card px-3 text-[15px] font-normal outline-none focus:border-primary" />
            </label>
            <label class="grid gap-1 text-sm font-semibold">Keterangan
              <input v-model="jForm.description" required placeholder="Contoh: Setoran modal awal" class="h-11 rounded-xl border bg-card px-3 text-[15px] font-normal outline-none focus:border-primary" />
            </label>
          </div>

          <template v-if="simple">
            <div class="grid gap-2 rounded-xl bg-muted/60 p-3 text-[15px]">
              <p><span class="text-muted-foreground">Masuk ke (debit):</span> <span class="font-semibold">{{ accountName(jForm.lines[0].account) }}</span></p>
              <p><span class="text-muted-foreground">Dari (kredit):</span> <span class="font-semibold">{{ accountName(jForm.lines[1].account) }}</span></p>
            </div>
            <label class="grid gap-1 text-sm font-semibold">Jumlah (Rp)
              <input :value="simpleAmount" inputmode="numeric" required placeholder="0" class="tabular h-12 rounded-xl border bg-card px-3 text-lg font-normal outline-none focus:border-primary" @input="fmtInput($event, (v) => (simpleAmount = v))" />
            </label>
          </template>

          <template v-else>
            <div v-for="(l, i) in jForm.lines" :key="i" class="grid grid-cols-[1fr_7.5rem_7.5rem_2.25rem] items-center gap-2">
              <select v-model="l.account" required class="h-11 min-w-0 rounded-xl border bg-card px-2 text-[14px] outline-none focus:border-primary">
                <option value="" disabled>Pilih akun</option>
                <option v-for="a in accounts" :key="a.code" :value="a.code">{{ a.code }} {{ a.name }}</option>
              </select>
              <input :value="l.debit" inputmode="numeric" placeholder="Debit" class="tabular h-11 min-w-0 rounded-xl border bg-card px-2 text-right text-[14px] outline-none focus:border-primary" @input="fmtInput($event, (v) => { l.debit = v; if (v) l.credit = ''; })" />
              <input :value="l.credit" inputmode="numeric" placeholder="Kredit" class="tabular h-11 min-w-0 rounded-xl border bg-card px-2 text-right text-[14px] outline-none focus:border-primary" @input="fmtInput($event, (v) => { l.credit = v; if (v) l.debit = ''; })" />
              <button type="button" class="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" :disabled="jForm.lines.length <= 2" aria-label="Hapus baris" @click="jForm.lines.splice(i, 1)">
                <X class="size-4" />
              </button>
            </div>
            <button type="button" class="w-fit text-sm font-medium text-primary hover:underline" @click="jForm.lines.push({ account: '', debit: '', credit: '' })">+ Tambah baris</button>
            <p class="tabular text-sm" :class="jTotals.d === jTotals.c && jTotals.d ? 'text-success' : 'text-muted-foreground'">
              Debit {{ money(jTotals.d) }} · Kredit {{ money(jTotals.c) }}
              {{ jTotals.d === jTotals.c && jTotals.d ? "· seimbang" : "· harus sama" }}
            </p>
          </template>

          <p v-if="jError" class="text-sm text-destructive">{{ jError }}</p>
          <Button type="submit" class="h-12 rounded-xl text-base" :disabled="jSaving || !jTotals.d || jTotals.d !== jTotals.c">
            {{ jSaving ? "Menyimpan..." : "Simpan jurnal" }}
          </Button>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      :open="Boolean(delEntry)"
      :title="delEntry ? `Hapus ${delEntry.ref}?` : ''"
      description="Jurnal ini dihapus dan laporan keuangan dihitung ulang."
      confirm-label="Hapus jurnal"
      @update:open="!$event && (delEntry = null)"
      @confirm="removeEntry"
    />
  </div>
</template>
