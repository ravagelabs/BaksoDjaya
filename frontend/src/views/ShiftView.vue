<script setup>
import { ref, computed, onMounted } from "vue";
import { LogOut, Printer, RefreshCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatRp, number, dateTime, paymentRows } from "@/lib/format";
import { printShiftReport } from "@/lib/receipt";
import { useUiStore } from "@/stores/ui";

// Laporan shift: shift yang sedang berjalan + riwayat shift.
// Karyawan melihat shift miliknya sendiri, akun utama melihat semua shift.
const ui = useUiStore();
const isOwner = computed(() => ui.user?.role === "owner");

const current = ref(null);
const shifts = ref([]);
const loading = ref(true);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [c, h] = await Promise.all([api("/shifts/current"), api("/shifts")]);
    current.value = c.data;
    shifts.value = h.data;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function duration(from, to) {
  const m = Math.max(0, Math.floor((new Date(to) - new Date(from)) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} jam ${m % 60} menit` : `${m} menit`;
}

async function printCurrent() {
  // ambil angka terbaru dulu supaya laporan sementara akurat
  try {
    current.value = (await api("/shifts/current")).data;
    printShiftReport(current.value, { running: true });
  } catch (e) {
    ui.toast(e.message, "error");
  }
}

const openId = ref(null);
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-4 py-5 md:px-8 md:py-7">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-[28px] font-bold leading-tight md:text-[32px]">Laporan shift</h1>
        <p class="mt-1 text-[15px] text-muted-foreground">
          {{ isOwner ? "Semua shift karyawan, bisa dicetak." : "Shift kamu dan uang yang masuk, bisa dicetak." }}
        </p>
      </div>
      <Button variant="secondary" class="h-11 rounded-xl px-4" :disabled="loading" @click="load"><RefreshCw class="size-4" /> Muat ulang</Button>
    </div>

    <p v-if="error" class="mt-6 text-[15px] text-destructive">{{ error }}</p>
    <p v-else-if="loading && !current" class="mt-6 text-[15px] text-muted-foreground">Memuat shift...</p>

    <template v-else-if="current">
      <!-- Shift berjalan -->
      <section class="mt-6 rounded-[20px] bg-muted/50 p-5 md:p-7">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="flex items-center gap-2 text-sm font-semibold text-success">
              <span class="size-2 rounded-full bg-success" /> Shift berjalan
            </p>
            <h2 class="mt-1 text-xl font-semibold md:text-2xl">{{ current.employee_name }}</h2>
            <p class="text-sm text-muted-foreground">
              Mulai {{ dateTime(current.created_at) }} · {{ duration(current.created_at, current.ended_at) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" class="h-12 rounded-xl px-5 text-base" @click="printCurrent"><Printer /> Cetak laporan</Button>
            <Button class="h-12 rounded-xl px-5 text-base" @click="ui.endShiftRequest++"><LogOut /> Akhiri shift</Button>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div v-for="r in paymentRows(current)" :key="r.key" class="rounded-xl bg-card px-4 py-3">
            <p class="text-sm text-muted-foreground">{{ r.label }}</p>
            <p class="tabular mt-0.5 text-lg font-semibold">{{ formatRp(r.value) }}</p>
          </div>
        </div>
        <div class="tabular mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
          <span class="text-[15px] text-muted-foreground">{{ current.transactions }} transaksi</span>
          <span class="text-[15px]">Total <span class="ml-2 text-[26px] font-bold">{{ formatRp(current.total) }}</span></span>
        </div>
      </section>

      <!-- Riwayat -->
      <section class="mt-7">
        <h2 class="text-xl font-semibold md:text-2xl">Riwayat shift</h2>
        <p v-if="!shifts.length" class="mt-3 text-[15px] text-muted-foreground">Belum ada shift yang diakhiri.</p>
        <ul v-else class="mt-3 flex flex-col divide-y rounded-[20px] border">
          <li v-for="s in shifts" :key="s.id">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
              <button type="button" class="min-w-48 flex-1 text-left" :aria-expanded="openId === s.id" @click="openId = openId === s.id ? null : s.id">
                <p class="text-[16px] font-semibold">
                  Shift #{{ s.id }}<template v-if="isOwner"> · {{ s.employee_name ?? "Tanpa nama" }}</template>
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ dateTime(s.created_at) }} – {{ dateTime(s.ended_at) }} · {{ duration(s.created_at, s.ended_at) }}
                </p>
              </button>
              <span class="tabular text-sm text-muted-foreground">{{ s.transactions }} transaksi</span>
              <span class="tabular w-32 text-right text-lg font-semibold">{{ formatRp(s.total) }}</span>
              <Button variant="secondary" class="h-11 rounded-xl px-4" @click="printShiftReport(s)"><Printer class="size-4" /> Cetak</Button>
            </div>
            <dl v-if="openId === s.id" class="tabular grid grid-cols-2 gap-x-6 gap-y-1.5 px-5 pb-4 text-sm sm:grid-cols-3">
              <div v-for="r in paymentRows(s)" :key="r.key" class="flex justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
                <dt class="text-muted-foreground">{{ r.label }}</dt>
                <dd class="font-semibold">{{ number.format(r.value) }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
