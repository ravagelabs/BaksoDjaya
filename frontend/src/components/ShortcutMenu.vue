<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeftRight, BookOpen, CornerDownLeft, House, LayoutGrid, Search, ShoppingBag, Wallet, ChartPie, Clock, FileDown, Landmark, Package, Printer, Receipt, Settings2, Tags, UserPlus, UtensilsCrossed,
} from "@lucide/vue";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui";
import { exportDailyReport } from "@/lib/dailyReport";

// Shortcut ikon R (akun utama): isi menunya bisa ditambah/dikurangi sendiri, tersimpan di perangkat ini.
const props = defineProps({ fab: { type: Boolean, default: true } }); // tombol R melayang (desktop)
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

// ---- Kotak perintah cepat (⌘K / Ctrl+K, atau "Cari perintah" di menu R) ----
const go = (action, values, template) => {
  ui.quickPreset = { template, values };
  ui.quickAction = action;
};
const PAGES = [
  { id: "x-setor", label: "Setor tunai ke BCA", icon: Landmark, run: () => go("transfer", { from: "1-1100", to: "1-1200", description: "Setor tunai ke BCA" }) },
  { id: "x-petty", label: "Isi ulang petty cash", icon: Wallet, run: () => go("transfer", { from: "1-1100", to: "1-1101", description: "Isi ulang petty cash" }) },
  { id: "x-belanja", label: "Catat belanja bahan baku", icon: Package, run: () => go("biaya", { category: "Bahan baku", name: "Belanja bahan" }) },
  { id: "x-gofood", label: "GoFood sudah cair", icon: Landmark, run: () => go("jurnal", {}, "gofood") },
  { id: "x-grabfood", label: "GrabFood sudah cair", icon: Landmark, run: () => go("jurnal", {}, "grabfood") },
  { id: "p-beranda", label: "Buka Beranda", icon: House, run: () => router.push("/beranda") },
  { id: "p-kasir", label: "Buka Kasir", icon: ShoppingBag, run: () => router.push("/kasir") },
  { id: "p-transaksi", label: "Buka Transaksi", icon: Receipt, run: () => router.push("/transaksi") },
  { id: "p-kasbank", label: "Lihat mutasi kas & bank", icon: Wallet, run: () => router.push("/keuangan?laporan=cash") },
  { id: "p-pengaturan", label: "Buka Pengaturan", icon: LayoutGrid, run: () => router.push("/pengaturan") },
];
const paletteOpen = ref(false);
const query = ref("");
const active = ref(0);
const inputEl = ref(null);
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const KEY_HINT = isMac ? "⌘K" : "Ctrl K";
const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  const all = [...ALL.filter((a) => a.id !== "keuangan"), ...PAGES, ALL.find((a) => a.id === "keuangan")];
  return q ? all.filter((a) => a.label.toLowerCase().includes(q)) : all;
});
async function openPalette() {
  query.value = "";
  active.value = 0;
  paletteOpen.value = true;
  await nextTick();
  // di HP jangan langsung munculkan keyboard; daftar aksi sudah kelihatan
  if (matchMedia("(hover: hover)").matches) inputEl.value?.focus();
}
watch(() => ui.paletteRequest, () => openPalette());
function runResult(it) {
  if (!it) return;
  paletteOpen.value = false;
  it.run();
}
function onPaletteKey(e) {
  const n = results.value.length;
  if (e.key === "ArrowDown") { e.preventDefault(); active.value = (active.value + 1) % Math.max(n, 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); active.value = (active.value - 1 + n) % Math.max(n, 1); }
  else if (e.key === "Enter") { e.preventDefault(); runResult(results.value[active.value]); }
}
function onGlobalKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    paletteOpen.value ? (paletteOpen.value = false) : openPalette();
  }
}
onMounted(() => window.addEventListener("keydown", onGlobalKey));
onUnmounted(() => window.removeEventListener("keydown", onGlobalKey));
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
async function runDaily(mode) {
  dailyBusy.value = true;
  try {
    await exportDailyReport(dailyDate.value, mode);
    dailyOpen.value = false;
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    dailyBusy.value = false;
  }
}
</script>

<template>
  <DropdownMenu v-if="props.fab">
    <DropdownMenuTrigger
      class="fixed right-8 bottom-8 z-50 hidden size-14 md:flex items-center justify-center rounded-full bg-nav shadow-lg shadow-black/30 ring-1 ring-white/10 outline-none transition-transform active:scale-95 focus-visible:ring-4 focus-visible:ring-cta/40 md:right-8 md:bottom-8"
      aria-label="Shortcut"
    >
      <img src="/brand/ravage-icon-silver.png" alt="" class="h-6 w-auto brightness-[1.6]" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" side="top" :side-offset="10" class="w-64">
      <DropdownMenuItem class="h-11 gap-3 text-[15px]" @select="openPalette()">
        <Search class="size-4" /> Cari perintah
        <kbd class="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{{ KEY_HINT }}</kbd>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
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

  <!-- Kotak perintah cepat -->
  <Dialog v-model:open="paletteOpen">
    <DialogContent class="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg" :show-close-button="false">
      <DialogTitle class="sr-only">Cari perintah</DialogTitle>
      <DialogDescription class="sr-only">Ketik untuk mencari, Enter untuk menjalankan.</DialogDescription>
      <label class="flex items-center gap-3 border-b px-4">
        <Search class="size-5 shrink-0 text-muted-foreground" />
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          placeholder="Cari aksi"
          class="h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
          @input="active = 0"
          @keydown="onPaletteKey"
        />
        <kbd class="hidden rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:block">Esc</kbd>
      </label>
      <ul class="max-h-[50dvh] overflow-y-auto p-2" role="listbox">
        <li v-for="(it, i) in results" :key="it.id" role="option" :aria-selected="i === active">
          <button
            type="button"
            class="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px]"
            :class="i === active ? 'bg-muted font-semibold' : ''"
            @mousemove="active = i"
            @click="runResult(it)"
          >
            <component :is="it.icon" class="size-[18px] shrink-0 text-muted-foreground" />
            <span class="flex-1 truncate">{{ it.label }}</span>
            <CornerDownLeft v-if="i === active" class="size-4 text-muted-foreground" />
          </button>
        </li>
        <li v-if="!results.length" class="px-3 py-6 text-center text-[15px] text-muted-foreground">Tidak ada perintah "{{ query }}".</li>
      </ul>
    </DialogContent>
  </Dialog>

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
        <DialogDescription class="text-[15px]">Pemasukan, pengeluaran, dan saldo kas & bank satu hari.</DialogDescription>
      </DialogHeader>
      <label class="grid gap-1.5 text-sm font-semibold">Tanggal
        <input v-model="dailyDate" type="date" :max="today()" class="h-12 rounded-xl border bg-card px-3 text-base font-normal outline-none focus:border-primary" />
      </label>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="secondary" class="h-12 rounded-xl text-base" :disabled="!dailyDate || dailyBusy" @click="runDaily('print')">
          <Printer class="size-5" /> Cetak
        </Button>
        <Button class="h-12 rounded-xl text-base" :disabled="!dailyDate || dailyBusy" @click="runDaily('pdf')">
          <FileDown class="size-5" /> {{ dailyBusy ? "Menyiapkan..." : "Unduh PDF" }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
