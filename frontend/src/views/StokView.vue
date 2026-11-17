<script setup>
import { ref, computed, onMounted } from "vue";
import { Ellipsis, History, Minus, Plus, Search, SlidersHorizontal, Trash2, ClipboardCheck } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { api } from "@/lib/api";
import { number, splitName, dateTime } from "@/lib/format";
import { useUiStore } from "@/stores/ui";
import { useCatalogStore } from "@/stores/catalog";

// Stok barang: masuk (+), keluar manual (rusak/waste), terpotong otomatis saat transaksi dibayar.
const ui = useUiStore();
const catalog = useCatalogStore();
const isOwner = computed(() => ui.user?.role === "owner");

const items = ref([]);
const loading = ref(true);
async function load() {
  try {
    items.value = (await api("/stock")).data;
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const qtyText = (n) => number.format(Math.round(n * 100) / 100);
const status = (it) => (it.qty <= 0 ? "habis" : it.qty <= it.min_qty ? "tipis" : "");

// ---- Masuk / keluar ----
const KELUAR_REASONS = ["Rusak", "Basi / waste", "Jatuh", "Dimakan karyawan", "Lainnya"];
const MASUK_QUICK = [10, 25, 50, 100];
const moveDlg = ref(null); // { item, kind }
const moveQty = ref("");
const moveReason = ref("");
const busy = ref(false);
function openMove(item, kind) {
  moveDlg.value = { item, kind };
  moveQty.value = "";
  moveReason.value = kind === "keluar" ? KELUAR_REASONS[0] : "";
}
const moveValid = computed(() => Number(moveQty.value) > 0 || (moveDlg.value?.kind === "koreksi" && moveQty.value !== "" && Number(moveQty.value) >= 0));
async function saveMove() {
  const d = moveDlg.value;
  if (!d || !moveValid.value) return;
  busy.value = true;
  try {
    await api(`/stock/${d.item.id}/moves`, { method: "POST", body: { kind: d.kind, qty: Number(moveQty.value), reason: moveReason.value || undefined } });
    const n = qtyText(Number(moveQty.value));
    ui.toast(d.kind === "masuk" ? `${d.item.name} +${n}` : d.kind === "keluar" ? `${d.item.name} −${n}` : `${d.item.name} jadi ${n}`);
    moveDlg.value = null;
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    busy.value = false;
  }
}

// ---- Barang baru ----
const UNITS = ["pcs", "butir", "botol", "bungkus", "kg"];
const newOpen = ref(false);
const nf = ref({});
function openNew() {
  nf.value = { name: "", unit: "pcs", qty: "", min_qty: "" };
  newOpen.value = true;
}
async function saveNew() {
  if (!nf.value.name.trim()) return;
  busy.value = true;
  try {
    await api("/stock", { method: "POST", body: { ...nf.value, qty: Number(nf.value.qty || 0), min_qty: Number(nf.value.min_qty || 0) } });
    ui.toast(`${nf.value.name} ditambahkan`);
    newOpen.value = false;
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    busy.value = false;
  }
}

// ---- Atur pemakaian (akun utama): menu mana memotong barang ini, berapa per porsi ----
const usageItem = ref(null);
const usage = ref({}); // product_id -> qty (string)
const usageSearch = ref("");
const minQty = ref("");
async function openUsage(item) {
  await catalog.load().catch(() => {});
  usage.value = Object.fromEntries(item.usage.map((u) => [u.product_id, String(u.qty)]));
  minQty.value = item.min_qty ? String(item.min_qty) : "";
  usageSearch.value = "";
  usageItem.value = item;
}
const usageGroups = computed(() => {
  const q = usageSearch.value.trim().toLowerCase();
  const map = new Map();
  for (const p of catalog.products) {
    if (q && !p.name.toLowerCase().includes(q)) continue;
    const { title, detail } = splitName(p.name);
    const g = map.get(title) ?? { title, products: [] };
    g.products.push({ id: p.id, detail: detail || title });
    map.set(title, g);
  }
  return [...map.values()];
});
function setGroup(g, v) {
  const next = { ...usage.value };
  for (const p of g.products) next[p.id] = v;
  usage.value = next;
}
const groupValue = (g) => {
  const vals = [...new Set(g.products.map((p) => usage.value[p.id] ?? ""))];
  return vals.length === 1 ? vals[0] : "";
};
const usedCount = computed(() => Object.values(usage.value).filter((v) => Number(v) > 0).length);
async function saveUsage() {
  const it = usageItem.value;
  busy.value = true;
  try {
    const list = Object.entries(usage.value).filter(([, v]) => Number(v) > 0).map(([product_id, qty]) => ({ product_id: Number(product_id), qty: Number(qty) }));
    await api(`/stock/${it.id}/usage`, { method: "PUT", body: { usage: list } });
    await api(`/stock/${it.id}`, { method: "PATCH", body: { min_qty: Number(minQty.value || 0) } });
    ui.toast("Pemakaian disimpan");
    usageItem.value = null;
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    busy.value = false;
  }
}

// ---- Riwayat ----
const histItem = ref(null);
const moves = ref([]);
async function openHistory(item) {
  histItem.value = item;
  moves.value = [];
  try {
    moves.value = (await api(`/stock/${item.id}/moves`)).data;
  } catch (e) {
    ui.toast(e.message, "error");
  }
}
const KIND_LABEL = { masuk: "Masuk", jual: "Terjual", keluar: "Keluar", batal: "Batal", koreksi: "Hitung ulang" };

// ---- Hapus ----
const delItem = ref(null);
async function removeItem() {
  const it = delItem.value;
  delItem.value = null;
  try {
    await api(`/stock/${it.id}`, { method: "DELETE" });
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain">
    <div class="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-7">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-[26px] font-bold leading-tight md:text-[32px]">Stok</h1>
        <button type="button" class="press flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-cta pr-4 pl-3.5 text-[15px] font-semibold whitespace-nowrap text-cta-foreground shadow-sm shadow-cta/30" @click="openNew">
          <Plus class="size-5" /> Barang
        </button>
      </div>

      <p v-if="loading" class="mt-8 text-[15px] text-muted-foreground">Memuat...</p>
      <div v-else-if="!items.length" class="mt-8 rounded-[20px] border border-dashed px-6 py-12 text-center">
        <p class="text-[16px] font-semibold">Belum ada barang</p>
        <Button class="mt-4 h-11 rounded-xl px-5" @click="openNew"><Plus /> Tambah barang</Button>
      </div>

      <ul v-else class="mt-5 flex flex-col gap-3">
        <li
          v-for="(it, i) in items"
          :key="it.id"
          class="row-in rounded-[20px] border bg-card p-4 md:p-5"
          :class="status(it) === 'habis' ? 'border-destructive/40' : status(it) === 'tipis' ? 'border-warning/50' : ''"
          :style="{ '--d': Math.min(i, 5) }"
        >
          <div class="flex items-start gap-3">
            <button type="button" class="min-w-0 flex-1 text-left" @click="openHistory(it)">
              <p class="truncate text-[17px] font-semibold">{{ it.name }}</p>
              <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                <span v-if="it.sold_today">Terjual hari ini {{ qtyText(it.sold_today) }}</span>
                <span v-if="!it.usage.length" class="text-warning">Belum dipakai menu</span>
                <span v-if="status(it) === 'habis'" class="font-semibold text-destructive">Habis</span>
                <span v-else-if="status(it) === 'tipis'" class="font-semibold text-warning">Hampir habis</span>
              </p>
            </button>
            <p class="tabular shrink-0 text-right">
              <span class="text-[28px] font-bold leading-none" :class="it.qty < 0 ? 'text-destructive' : ''">{{ qtyText(it.qty) }}</span>
              <span class="ml-1 text-sm text-muted-foreground">{{ it.unit }}</span>
            </p>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <Button variant="secondary" class="h-11 flex-1 rounded-xl bg-success-soft text-[15px] text-success hover:bg-success-soft" @click="openMove(it, 'masuk')"><Plus /> Masuk</Button>
            <Button variant="secondary" class="h-11 flex-1 rounded-xl text-[15px]" @click="openMove(it, 'keluar')"><Minus /> Keluar</Button>
            <DropdownMenu>
              <DropdownMenuTrigger class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary outline-none" :aria-label="`Lainnya untuk ${it.name}`">
                <Ellipsis class="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-56">
                <DropdownMenuItem class="h-11 gap-3 text-[15px]" @select="openHistory(it)"><History class="size-4" /> Riwayat</DropdownMenuItem>
                <template v-if="isOwner">
                  <DropdownMenuItem class="h-11 gap-3 text-[15px]" @select="openUsage(it)"><SlidersHorizontal class="size-4" /> Atur pemakaian</DropdownMenuItem>
                  <DropdownMenuItem class="h-11 gap-3 text-[15px]" @select="openMove(it, 'koreksi')"><ClipboardCheck class="size-4" /> Hitung ulang</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="h-11 gap-3 text-[15px] text-destructive" @select="delItem = it"><Trash2 class="size-4" /> Hapus barang</DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
      </ul>
    </div>

    <!-- Masuk / keluar / hitung ulang -->
    <Dialog :open="Boolean(moveDlg)" @update:open="!$event && (moveDlg = null)">
      <DialogContent v-if="moveDlg" class="p-6 sm:max-w-sm sm:p-7">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">
            {{ moveDlg.kind === "masuk" ? "Stok masuk" : moveDlg.kind === "keluar" ? "Keluarkan stok" : "Hitung ulang" }}
          </DialogTitle>
          <DialogDescription class="text-[15px]">{{ moveDlg.item.name }} · sekarang {{ qtyText(moveDlg.item.qty) }} {{ moveDlg.item.unit }}</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4" @submit.prevent="saveMove">
          <label class="grid gap-1.5 text-sm font-semibold">{{ moveDlg.kind === "koreksi" ? "Jumlah hasil hitung" : "Jumlah" }}
            <span class="flex items-center gap-2">
              <input v-model="moveQty" type="number" inputmode="decimal" min="0" step="any" autofocus class="tabular h-14 min-w-0 flex-1 rounded-xl border bg-card px-4 text-2xl font-bold outline-none focus:border-primary" />
              <span class="text-base font-normal text-muted-foreground">{{ moveDlg.item.unit }}</span>
            </span>
          </label>
          <div v-if="moveDlg.kind === 'masuk'" class="flex flex-wrap gap-2">
            <button v-for="q in MASUK_QUICK" :key="q" type="button" class="press h-10 rounded-full bg-muted px-4 text-[15px] font-semibold" @click="moveQty = String(q)">{{ q }}</button>
          </div>
          <div v-if="moveDlg.kind === 'keluar'" class="grid gap-1.5">
            <span class="text-sm font-semibold">Alasan</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="r in KELUAR_REASONS"
                :key="r"
                type="button"
                class="h-10 rounded-full px-4 text-[15px] transition-colors duration-(--dur-kecil)"
                :class="moveReason === r ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted'"
                @click="moveReason = r"
              >
                {{ r }}
              </button>
            </div>
          </div>
          <Button type="submit" class="h-12 rounded-xl text-base" :disabled="!moveValid || busy">
            {{ busy ? "Menyimpan..." : "Simpan" }}
          </Button>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Barang baru -->
    <Dialog v-model:open="newOpen">
      <DialogContent class="p-6 sm:max-w-sm sm:p-7">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">Barang baru</DialogTitle>
          <DialogDescription class="sr-only">Nama, satuan, dan stok awal</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4" @submit.prevent="saveNew">
          <label class="grid gap-1.5 text-sm font-semibold">Nama
            <input v-model="nf.name" placeholder="Bakso urat" class="h-12 rounded-xl border bg-card px-3 text-base font-normal outline-none focus:border-primary" />
          </label>
          <div class="grid gap-1.5">
            <span class="text-sm font-semibold">Satuan</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="u in UNITS" :key="u" type="button" class="h-10 rounded-full px-4 text-[15px]" :class="nf.unit === u ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted'" @click="nf.unit = u">{{ u }}</button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1.5 text-sm font-semibold">Stok sekarang
              <input v-model="nf.qty" type="number" inputmode="decimal" min="0" step="any" placeholder="0" class="tabular h-12 rounded-xl border bg-card px-3 text-base font-normal outline-none focus:border-primary" />
            </label>
            <label class="grid gap-1.5 text-sm font-semibold">Hampir habis di
              <input v-model="nf.min_qty" type="number" inputmode="decimal" min="0" step="any" placeholder="0" class="tabular h-12 rounded-xl border bg-card px-3 text-base font-normal outline-none focus:border-primary" />
            </label>
          </div>
          <Button type="submit" class="h-12 rounded-xl text-base" :disabled="!nf.name?.trim() || busy">Simpan</Button>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Atur pemakaian -->
    <Dialog :open="Boolean(usageItem)" @update:open="!$event && (usageItem = null)">
      <DialogContent v-if="usageItem" class="flex max-h-[90dvh] flex-col gap-4 p-6 sm:max-w-lg sm:p-7">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">{{ usageItem.name }}</DialogTitle>
          <DialogDescription class="text-[15px]">Terpotong berapa {{ usageItem.unit }} per porsi</DialogDescription>
        </DialogHeader>
        <label class="flex h-11 items-center gap-2 rounded-xl bg-muted px-3">
          <Search class="size-4 text-muted-foreground" />
          <input v-model="usageSearch" placeholder="Cari menu" class="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
        </label>
        <div class="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
          <section v-for="g in usageGroups" :key="g.title" class="border-b py-3 last:border-0">
            <div class="flex items-center gap-3">
              <span class="flex-1 text-[16px] font-semibold">{{ g.title }}</span>
              <input
                v-if="g.products.length === 1"
                v-model="usage[g.products[0].id]"
                type="number" inputmode="decimal" min="0" step="any" placeholder="0"
                :aria-label="g.title"
                class="tabular h-10 w-20 rounded-lg border bg-card px-2 text-right text-[15px] outline-none focus:border-primary"
              />
              <input
                v-else
                :value="groupValue(g)"
                type="number" inputmode="decimal" min="0" step="any" placeholder="semua"
                :aria-label="`Semua ${g.title}`"
                class="tabular h-10 w-20 rounded-lg border bg-muted/50 px-2 text-right text-[15px] outline-none focus:border-primary"
                @change="setGroup(g, $event.target.value)"
              />
            </div>
            <div v-for="p in g.products.length > 1 ? g.products : []" :key="p.id" class="mt-1.5 flex items-center gap-3 pl-3">
              <span class="min-w-0 flex-1 truncate text-[15px] text-muted-foreground">{{ p.detail }}</span>
              <input
                v-model="usage[p.id]"
                type="number" inputmode="decimal" min="0" step="any" placeholder="0"
                :aria-label="`${g.title} ${p.detail}`"
                class="tabular h-10 w-20 rounded-lg border bg-card px-2 text-right text-[15px] outline-none focus:border-primary"
              />
            </div>
          </section>
        </div>
        <label class="flex items-center justify-between gap-3 text-[15px] font-semibold">Hampir habis di
          <input v-model="minQty" type="number" inputmode="decimal" min="0" step="any" placeholder="0" class="tabular h-10 w-24 rounded-lg border bg-card px-2 text-right font-normal outline-none focus:border-primary" />
        </label>
        <Button class="h-12 rounded-xl text-base" :disabled="busy" @click="saveUsage">Simpan · {{ usedCount }} menu</Button>
      </DialogContent>
    </Dialog>

    <!-- Riwayat -->
    <Dialog :open="Boolean(histItem)" @update:open="!$event && (histItem = null)">
      <DialogContent v-if="histItem" class="flex max-h-[85dvh] flex-col p-6 sm:max-w-md sm:p-7">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">{{ histItem.name }}</DialogTitle>
          <DialogDescription class="text-[15px]">Sekarang {{ qtyText(histItem.qty) }} {{ histItem.unit }}</DialogDescription>
        </DialogHeader>
        <ul class="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto px-2">
          <li v-if="!moves.length" class="py-6 text-center text-[15px] text-muted-foreground">Belum ada riwayat.</li>
          <li v-for="m in moves" :key="m.id" class="flex items-center gap-3 py-2.5">
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-medium">{{ KIND_LABEL[m.kind] }}<template v-if="m.reason"> · {{ m.reason }}</template><template v-if="m.bill_id"> · #{{ m.bill_id }}</template></span>
              <span class="block text-xs text-muted-foreground">{{ dateTime(m.created_at) }}<template v-if="m.user_name"> · {{ m.user_name }}</template></span>
            </span>
            <span class="tabular shrink-0 text-[16px] font-semibold" :class="m.qty > 0 ? 'text-success' : ''">{{ m.qty > 0 ? "+" : "−" }}{{ qtyText(Math.abs(m.qty)) }}</span>
          </li>
        </ul>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      :open="Boolean(delItem)"
      :title="delItem ? `Hapus ${delItem.name}?` : ''"
      description="Barang hilang dari daftar dan tidak dipotong lagi saat menu terjual."
      confirm-label="Hapus"
      @update:open="!$event && (delItem = null)"
      @confirm="removeItem"
    />
  </div>
</template>

<style scoped>
/* Baris muncul berurutan saat halaman dibuka (stagger 40ms, maks 6) */
.row-in { animation: row-in 240ms var(--ease-out) both; animation-delay: calc(var(--d, 0) * 40ms); }
@keyframes row-in { from { opacity: 0; transform: translateY(6px); } }
</style>
