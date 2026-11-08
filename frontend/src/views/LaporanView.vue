<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { Download, Plus, Trash2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatRp, number, shortDate, todayISO, timeOnly, orderTypeLabel, PAYMENT_LABELS, OUTLET_BRANCH } from "@/lib/format";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();

const date = ref(todayISO());
const report = ref(null);
const expenses = ref([]);
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [r, e] = await Promise.all([api(`/reports/daily?date=${date.value}`), api(`/expenses?date=${date.value}`)]);
    report.value = r.data;
    expenses.value = e.data;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(date, load);

// Batang per jam: minimal 10.00 sampai 17.00, melebar mengikuti jam yang ada transaksinya
const bars = computed(() => {
  const hourly = report.value?.hourly ?? [];
  const hours = hourly.map((h) => h.hour);
  const from = Math.min(10, ...hours);
  const to = Math.max(17, ...hours);
  const max = Math.max(1, ...hourly.map((h) => h.total));
  const out = [];
  for (let h = from; h <= to; h++) {
    const total = hourly.find((x) => x.hour === h)?.total ?? 0;
    out.push({ hour: h, total, pct: (total / max) * 100, peak: total > 0 && total === max });
  }
  return out;
});

// ---- Biaya operasional ----
const adding = ref(false);
const expName = ref("");
const expAmount = ref("");
const expSaving = ref(false);

async function addExpense() {
  const amount = Number(String(expAmount.value).replace(/\D/g, ""));
  if (!expName.value.trim() || !amount) return;
  expSaving.value = true;
  try {
    await api("/expenses", { method: "POST", body: { name: expName.value, amount, date: date.value } });
    expName.value = "";
    expAmount.value = "";
    adding.value = false;
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    expSaving.value = false;
  }
}

async function removeExpense(id) {
  try {
    await api(`/expenses/${id}`, { method: "DELETE" });
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  }
}

// ---- Ekspor CSV transaksi hari itu ----
const exporting = ref(false);
async function exportCsv() {
  exporting.value = true;
  try {
    const bills = (await api(`/bills?status=paid&date=${date.value}`)).data;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["No", "Waktu", "Tipe", "Meja", "Pelanggan", "Kasir", "Metode", "Item", "Total"]];
    for (const b of [...bills].reverse()) {
      rows.push([
        b.billId,
        timeOnly(b.paid_at ?? b.created_at),
        orderTypeLabel(b.order_type),
        b.table_code ?? "",
        b.customer_name ?? "",
        b.employee_name ?? "",
        PAYMENT_LABELS[b.payment_method] ?? b.payment_method ?? "",
        b.billItems.map((i) => `${i.qty}x ${i.name}`).join("; "),
        b.grand_total,
      ]);
    }
    const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaksi-bakso-djaya-${date.value}.csv`;
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
  <div class="h-full overflow-y-auto overscroll-contain px-8 py-7">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-[32px] font-bold leading-tight">
          {{ date === todayISO() ? "Ringkasan hari ini" : "Ringkasan harian" }}
        </h1>
        <p class="mt-1 text-[15px] text-muted-foreground">{{ shortDate(date + "T12:00:00+07:00") }} · {{ OUTLET_BRANCH }}</p>
      </div>
      <div class="flex gap-3">
        <input
          v-model="date"
          type="date"
          :max="todayISO()"
          aria-label="Tanggal laporan"
          class="h-14 rounded-xl border bg-card px-4 text-[15px] outline-none focus:border-primary"
        />
        <Button variant="secondary" class="h-14 w-48 justify-start rounded-xl px-6 text-lg font-semibold" :disabled="exporting" @click="exportCsv">
          <Download /> {{ exporting ? "Menyiapkan..." : "Ekspor" }}
        </Button>
      </div>
    </div>

    <p v-if="error" class="mt-8 text-[15px] text-destructive">{{ error }}</p>
    <p v-else-if="loading && !report" class="mt-8 text-[15px] text-muted-foreground">Memuat laporan...</p>

    <template v-else-if="report">
      <div class="mt-8 grid gap-6 md:grid-cols-3">
        <div class="rounded-[20px] bg-muted/50 p-7">
          <p class="text-lg text-muted-foreground">Penjualan neto</p>
          <p class="tabular mt-3 text-[40px] font-bold leading-none tracking-tight">{{ formatRp(report.net_sales) }}</p>
          <p class="mt-4 text-[15px] text-muted-foreground">{{ report.transactions }} transaksi</p>
        </div>
        <div class="rounded-[20px] bg-muted/50 p-7">
          <p class="text-lg text-muted-foreground">Estimasi HPP</p>
          <p class="tabular mt-3 text-[40px] font-bold leading-none tracking-tight">{{ formatRp(report.hpp) }}</p>
          <p class="mt-4 text-[15px] text-muted-foreground">Berdasarkan HPP per menu</p>
        </div>
        <div class="rounded-[20px] bg-muted/50 p-7">
          <p class="text-lg text-muted-foreground">Laba kotor</p>
          <p class="tabular mt-3 text-[40px] font-bold leading-none tracking-tight">{{ formatRp(report.gross_profit) }}</p>
          <p class="mt-4 text-[15px] text-muted-foreground">Sebelum biaya operasional</p>
        </div>
      </div>

      <div class="mt-7 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <section class="rounded-[20px] border p-8">
          <h2 class="text-2xl font-semibold">Penjualan per jam</h2>
          <p class="mt-1 text-[15px] text-muted-foreground">Nilai penjualan dalam ribuan rupiah</p>
          <div class="mt-8 flex h-64 items-end gap-3" role="img" :aria-label="`Grafik penjualan per jam tanggal ${date}`">
            <div v-for="b in bars" :key="b.hour" class="flex h-full flex-1 flex-col items-center justify-end gap-3">
              <span v-if="b.total" class="tabular text-xs text-muted-foreground">{{ number.format(Math.round(b.total / 1000)) }}</span>
              <div
                class="w-full max-w-16 rounded-lg transition-all"
                :class="b.peak ? 'bg-primary' : 'bg-chart-2'"
                :style="{ height: b.total ? `${Math.max(b.pct, 4)}%` : '4px' }"
                :title="`${String(b.hour).padStart(2, '0')}.00 · ${formatRp(b.total)}`"
              />
              <span class="tabular text-sm text-muted-foreground">{{ String(b.hour).padStart(2, "0") }}.00</span>
            </div>
          </div>
        </section>

        <section class="flex flex-col rounded-[20px] bg-muted/50 p-8">
          <h2 class="text-2xl font-semibold">Menu terlaris</h2>
          <p v-if="!report.top_products.length" class="mt-6 text-[15px] text-muted-foreground">Belum ada penjualan.</p>
          <ul class="mt-6 flex flex-col gap-5">
            <li v-for="p in report.top_products.slice(0, 3)" :key="p.name" class="flex items-baseline justify-between gap-3">
              <span class="text-lg font-medium">{{ p.name.split(" - ")[0].toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) }}</span>
              <span class="tabular text-[15px] text-muted-foreground">{{ p.qty }} porsi</span>
            </li>
          </ul>

          <div class="mt-auto border-t pt-5">
            <div class="flex items-baseline justify-between">
              <span class="text-lg text-muted-foreground">Biaya operasional</span>
              <span class="tabular text-lg">{{ formatRp(report.expenses) }}</span>
            </div>
            <ul v-if="expenses.length" class="mt-2 flex flex-col gap-1">
              <li v-for="e in expenses" :key="e.id" class="flex items-center justify-between text-sm text-muted-foreground">
                <span>{{ e.name }}</span>
                <span class="flex items-center gap-1">
                  <span class="tabular">{{ formatRp(e.amount) }}</span>
                  <button
                    type="button"
                    class="flex size-8 items-center justify-center rounded-lg hover:bg-card hover:text-destructive"
                    :aria-label="`Hapus ${e.name}`"
                    @click="removeExpense(e.id)"
                  >
                    <Trash2 class="size-4" />
                  </button>
                </span>
              </li>
            </ul>
            <form v-if="adding" class="mt-3 grid grid-cols-[1fr_8rem] gap-2" @submit.prevent="addExpense">
              <input v-model="expName" placeholder="Nama biaya" class="h-11 rounded-lg border bg-card px-3 text-[15px] outline-none focus:border-primary" required />
              <input v-model="expAmount" inputmode="numeric" placeholder="Jumlah" class="tabular h-11 rounded-lg border bg-card px-3 text-[15px] outline-none focus:border-primary" required />
              <Button type="submit" class="col-span-2 h-11 rounded-lg" :disabled="expSaving">{{ expSaving ? "Menyimpan..." : "Simpan biaya" }}</Button>
            </form>
            <button v-else type="button" class="mt-2 flex items-center gap-1 text-[15px] font-medium text-primary hover:underline" @click="adding = true">
              <Plus class="size-4" /> Tambah biaya
            </button>

            <div class="mt-5 flex items-baseline justify-between">
              <span class="text-xl font-semibold">Estimasi laba*</span>
              <span class="tabular text-2xl font-semibold" :class="report.estimated_profit < 0 ? 'text-destructive' : 'text-primary'">
                {{ formatRp(report.estimated_profit) }}
              </span>
            </div>
          </div>
        </section>
      </div>

      <p class="mt-6 text-sm text-muted-foreground">
        *Contoh sederhana: laba kotor dikurangi biaya operasional; belum termasuk pajak dan penyesuaian.
      </p>
    </template>
  </div>
</template>
