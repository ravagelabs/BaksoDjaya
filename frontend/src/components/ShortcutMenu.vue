<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeftRight, BookOpen, ChartPie, Clock, FileDown, Landmark, Package, Receipt, Settings2, Tags, UserPlus, UtensilsCrossed,
} from "@lucide/vue";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui";
import { exportDailyReport } from "@/lib/dailyReport";

// Shortcut ikon R (akun utama): isi menunya bisa ditambah/dikurangi sendiri, tersimpan di perangkat ini.
const ui = useUiStore();
const router = useRouter();

const ALL = [
  { id: "biaya", label: "Catat biaya", icon: Receipt, run: () => (ui.quickAction = "biaya") },
  { id: "harian", label: "Laporan harian (PDF)", icon: FileDown, run: () => openDaily() },
  { id: "keuangan", label: "Buka Keuangan", icon: ChartPie, run: () => router.push("/keuangan") },
  { id: "transfer", label: "Transfer kas & bank", icon: ArrowLeftRight, run: () => (ui.quickAction = "transfer") },
  { id: "aset", label: "Tambah aset", icon: Package, run: () => (ui.quickAction = "aset") },
  { id: "kasbank", label: "Tambah kas / bank", icon: Landmark, run: () => (ui.quickAction = "kasbank") },
  { id: "jurnal", label: "Catat jurnal", icon: BookOpen, run: () => (ui.quickAction = "jurnal") },
  { id: "shift", label: "Laporan shift", icon: Clock, run: () => router.push("/shift") },
  { id: "hpp", label: "Harga & HPP menu", icon: Tags, run: () => router.push({ path: "/pengaturan", query: { bagian: "menu" } }) },
  { id: "menu", label: "Tambah menu", icon: UtensilsCrossed, run: () => router.push({ path: "/pengaturan", query: { bagian: "menu", aksi: "tambah" } }) },
  { id: "akun", label: "Tambah akun karyawan", icon: UserPlus, run: () => router.push({ path: "/pengaturan", query: { bagian: "akun", aksi: "tambah" } }) },
];
const DEFAULT = ["biaya", "harian", "keuangan"];
const KEY = "ravage.shortcuts";

function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(v) ? v.filter((id) => ALL.some((a) => a.id === id)) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}
const chosen = ref(readSaved());
const items = computed(() => chosen.value.map((id) => ALL.find((a) => a.id === id)).filter(Boolean));

function toggle(id) {
  chosen.value = chosen.value.includes(id) ? chosen.value.filter((x) => x !== id) : [...chosen.value, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(chosen.value));
  } catch {
    // penyimpanan perangkat penuh/dimatikan: pilihan tetap berlaku sampai halaman ditutup
  }
}

const editing = ref(false);

// ---- Laporan harian ----
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
const dailyOpen = ref(false);
const dailyDate = ref(today());
const dailyBusy = ref(false);
function openDaily() {
  dailyDate.value = today();
  dailyOpen.value = true;
}
async function runDaily() {
  dailyBusy.value = true;
  try {
    await exportDailyReport(dailyDate.value);
    dailyOpen.value = false;
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    dailyBusy.value = false;
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      class="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex size-14 items-center justify-center rounded-full bg-nav shadow-lg shadow-black/30 ring-1 ring-white/10 outline-none transition-transform active:scale-95 focus-visible:ring-4 focus-visible:ring-cta/40 md:right-8 md:bottom-8"
      aria-label="Shortcut"
    >
      <img src="/brand/ravage-icon-silver.png" alt="" class="h-6 w-auto brightness-[1.6]" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" side="top" :side-offset="10" class="w-64">
      <DropdownMenuItem v-for="it in items" :key="it.id" class="h-11 gap-3 text-[15px]" @select="it.run()">
        <component :is="it.icon" class="size-4" /> {{ it.label }}
      </DropdownMenuItem>
      <p v-if="!items.length" class="px-2 py-2 text-sm text-muted-foreground">Belum ada shortcut.</p>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="h-11 gap-3 text-[15px] text-muted-foreground" @select="editing = true">
        <Settings2 class="size-4" /> Atur shortcut
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- Atur shortcut: tambah / kurangi -->
  <Dialog v-model:open="editing">
    <DialogContent class="p-6 sm:max-w-md sm:p-7">
      <DialogHeader>
        <DialogTitle class="text-2xl font-bold">Atur shortcut</DialogTitle>
        <DialogDescription class="text-[15px]">Nyalakan yang sering dipakai. Tersimpan di perangkat ini.</DialogDescription>
      </DialogHeader>
      <ul class="flex max-h-[55dvh] flex-col divide-y overflow-y-auto rounded-xl border">
        <li v-for="it in ALL" :key="it.id">
          <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left" role="switch" :aria-checked="chosen.includes(it.id)" @click="toggle(it.id)">
            <component :is="it.icon" class="size-5 shrink-0 text-muted-foreground" />
            <span class="flex-1 text-[15px] font-medium">{{ it.label }}</span>
            <span class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors" :class="chosen.includes(it.id) ? 'bg-primary' : 'bg-[#d6d3ce]'">
              <span class="inline-block size-5 rounded-full bg-white shadow transition-transform" :class="chosen.includes(it.id) ? 'translate-x-6' : 'translate-x-1'" />
            </span>
          </button>
        </li>
      </ul>
      <Button class="h-12 rounded-xl text-base" @click="editing = false">Selesai</Button>
    </DialogContent>
  </Dialog>

  <!-- Laporan harian -->
  <Dialog v-model:open="dailyOpen">
    <DialogContent class="p-6 sm:max-w-sm sm:p-7">
      <DialogHeader>
        <DialogTitle class="text-2xl font-bold">Laporan harian</DialogTitle>
        <DialogDescription class="text-[15px]">Pemasukan, pengeluaran, dan saldo kas & bank satu hari. Pilih "Simpan sebagai PDF" di layar cetak.</DialogDescription>
      </DialogHeader>
      <label class="grid gap-1.5 text-sm font-semibold">Tanggal
        <input v-model="dailyDate" type="date" :max="today()" class="h-12 rounded-xl border bg-card px-3 text-base font-normal outline-none focus:border-primary" />
      </label>
      <Button class="h-12 rounded-xl text-base" :disabled="!dailyDate || dailyBusy" @click="runDaily">
        <FileDown class="size-5" /> {{ dailyBusy ? "Menyiapkan..." : "Unduh PDF" }}
      </Button>
    </DialogContent>
  </Dialog>
</template>
