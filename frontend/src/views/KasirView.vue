<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ArrowRight, ChevronDown, FilePenLine, Pencil, ShoppingBag, Minus, Plus, Printer, Search, Trash2, UserRound, Utensils, X } from "@lucide/vue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard.vue";
import CustomizeDialog from "@/components/CustomizeDialog.vue";
import CustomerPopup from "@/components/CustomerPopup.vue";
import OrderSlipPopup from "@/components/OrderSlipPopup.vue";
import { printOrderSlip, canAutoPrint } from "@/lib/receipt";
import { api } from "@/lib/api";
import {
  formatRp,
  number,
  longDate,
  orderNo,
  KASIR_ORDER_TYPES,
  splitName,
  optionsText,
  OUTLET_BRANCH,
} from "@/lib/format";
import { useCatalogStore } from "@/stores/catalog";
import { useOrderStore } from "@/stores/order";
import { useUiStore } from "@/stores/ui";

const catalog = useCatalogStore();
const order = useOrderStore();
const ui = useUiStore();
const router = useRouter();

onMounted(() => catalog.load());

// HP: panel pesanan tampil sebagai layar penuh, dibuka dari bar bawah
const showOrderSheet = ref(false);

// ---- Menu: cari dan filter kategori ----
const query = ref("");
const category = ref("Semua");

const menuScrolled = ref(false);

const visibleProducts = computed(() => {
  const q = query.value.trim().toLowerCase();
  return catalog.gridProducts.filter((p) => {
    if (category.value !== "Semua" && (p.category || "Lainnya") !== category.value) return false;
    if (!q) return true;
    const names = p.isVariant ? [p.name, ...p.variants.map((v) => v.name)] : [p.name];
    return names.some((n) => n.toLowerCase().includes(q)) || String(p.id) === q;
  });
});

// ---- Tambah item ----
const customizing = ref(null);
const showCustomize = ref(false);

const editingLine = ref(null); // { key, qty, note, options, paket } saat mengubah baris keranjang

function openCustomize(product) {
  editingLine.value = null;
  customizing.value = product;
  showCustomize.value = true;
}

// Ubah item yang sudah di keranjang: buka dialog yang sama dengan pilihan terisi
function editLine(line) {
  const found = catalog.cardForLine(line);
  if (!found) return;
  editingLine.value = { key: line.key, qty: line.qty, note: line.note ?? "", options: line.options ?? [], paket: found.paket, variant: found.variant };
  customizing.value = found.product;
  showCustomize.value = true;
}

// Tombol +: langsung tambah dengan pilihan default. Paket tetap harus dipilih dulu.
function quickAdd(product) {
  if (product.isPaket || catalog.hasChoices(product)) return openCustomize(product);
  const target = product.isVariant ? product.variants[0] : product;
  order.addLine({ product: target, qty: 1, options: catalog.defaultOptions(target.category, target.id) });
}

function addFromDialog(item) {
  if (editingLine.value) {
    const newKey = order.replaceLine(editingLine.value.key, item);
    if (activeLine.value === editingLine.value.key) activeLine.value = newKey ?? null;
  } else {
    order.addLine(item);
  }
  showCustomize.value = false;
  editingLine.value = null;
}

// ---- Baris pesanan ----
const activeLine = ref(null);
const toggleLine = (key) => (activeLine.value = activeLine.value === key ? null : key);

function lineDetail(line) {
  const parts = [];
  const { detail } = splitName(line.name);
  if (detail) parts.push(detail);
  if (line.options?.length) parts.push(optionsText(line.options));
  return parts.join(" · ");
}

// ---- Catatan pesanan ----
const editingNote = ref(false);

// ---- Tipe, pelanggan ----
const showCustomer = ref(false);
const customers = ref([]);
const customersLoading = ref(false);
const customerSaving = ref(false);
const customerError = ref("");

async function openCustomer() {
  customerError.value = "";
  showCustomer.value = true;
  customersLoading.value = true;
  try {
    customers.value = (await api("/customers")).data;
  } catch (e) {
    customerError.value = e.message;
  } finally {
    customersLoading.value = false;
  }
}

async function saveCustomer({ name, telp, type }) {
  customerSaving.value = true;
  customerError.value = "";
  try {
    const json = await api("/customers", { method: "POST", body: { name, telp, type } });
    order.setCustomer(json.data ?? { name, telp, type });
    showCustomer.value = false;
  } catch (e) {
    customerError.value = e.message;
  } finally {
    customerSaving.value = false;
  }
}

function selectCustomer(c) {
  order.setCustomer(c);
  showCustomer.value = false;
}

// ---- Aksi ----
const title = computed(() => (order.billId ? `Pesanan ${orderNo(order.billId)}` : "Pesanan baru"));
const inKitchen = computed(() => Boolean(order.kitchenStatus));

// Alur: pilih menu -> Bayar -> pesanan otomatis masuk dapur -> beri nomor pager ke pelanggan
//       -> pager dibunyikan dari alatnya saat siap -> pager dikembalikan (halaman Nomor / "Sudah diambil")
const itemCount = computed(() => order.lines.reduce((sum, l) => sum + l.qty, 0));
const primaryAction = computed(() => ({ label: "Bayar", run: goPay }));

const flowHint = computed(() => {
  if (inKitchen.value) return "Pesanan ini sudah di dapur.";
  return "Bayar dulu. Pesanan otomatis masuk dapur, lalu beri nomor ke pelanggan.";
});

function chooseType(type) {
  if (type === order.orderType) return;
  order.setOrderType(type);
}

// Hanya untuk pesanan lama yang sudah di dapur dan diubah isinya ("Perbarui")
async function sendToKitchen() {
  const updated = inKitchen.value;
  try {
    const id = await order.save(ui.user.id, { sendToKitchen: true });
    // Nota pesanan dibuat dari isi kasir supaya bisa langsung dicetak (masih dalam ketukan yang sama)
    const slip = order.snapshot(id);
    if (canAutoPrint()) printOrderSlip(slip, { updated });
    openSlip(slip, updated, updated ? `Pesanan ${orderNo(id)} diperbarui` : `Pesanan ${orderNo(id)} dikirim ke dapur`);
    order.reset();
  } catch (e) {
    ui.toast(e.message, "error");
  }
}

// ---- Nota pesanan (ditaruh di meja) ----
const showSlip = ref(false);
const slipBill = ref(null);
const slipUpdated = ref(false);
const slipTitle = ref("Nota pesanan");

function openSlip(bill, updated = false, title = "Nota pesanan") {
  slipBill.value = bill;
  slipUpdated.value = updated;
  slipTitle.value = title;
  showSlip.value = true;
}

function reprintSlip() {
  openSlip(order.snapshot(order.billId), false, `Nota pesanan ${orderNo(order.billId)}`);
}

async function saveOrder() {
  try {
    const id = await order.save(ui.user.id);
    ui.toast(`Pesanan ${orderNo(id)} disimpan sebagai draft`);
    order.reset();
  } catch (e) {
    ui.toast(e.message, "error");
  }
}

// Dine-in / Take away wajib dipilih: kalau belum, tanya dulu lewat popup besar
const askType = ref(false);
function goPay() {
  if (!order.orderType) {
    askType.value = true;
    return;
  }
  router.push("/transaksi/bayar");
}
function pickTypeAndPay(type) {
  order.setOrderType(type);
  askType.value = false;
  router.push("/transaksi/bayar");
}
</script>

<template>
  <div class="relative flex h-full">
    <!-- Kiri: menu -->
    <section class="flex min-w-0 flex-1 flex-col">
      <!-- Kepala menu: jarak bawah + garis tipis saat daftar menu digulir, supaya kartu tidak terlihat menempel -->
      <div
        class="relative z-10 border-b px-4 pt-4 pb-4 transition-[border-color,box-shadow] duration-200 md:px-6 md:pt-5"
        :class="menuScrolled ? 'border-border shadow-[0_8px_16px_-14px_rgb(28_25_23/0.35)]' : 'border-transparent'"
      >
        <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 class="shrink-0 text-2xl font-bold leading-tight">Mau pesan apa?</h1>
          <p class="min-w-0 truncate text-sm text-muted-foreground">{{ longDate() }} · {{ OUTLET_BRANCH }}</p>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
        <label class="relative block min-w-0 flex-1 basis-72">
          <span class="sr-only">Cari menu</span>
          <Search class="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="query"
            type="search"
            placeholder="Cari menu atau kode produk..."
            class="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-base outline-none placeholder:text-muted-foreground focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <div class="flex gap-2 overflow-x-auto" role="tablist" aria-label="Kategori">
          <button
            v-for="c in ['Semua', ...catalog.categories]"
            :key="c"
            type="button"
            role="tab"
            :aria-selected="category === c"
            class="h-12 shrink-0 rounded-full px-5 text-[15px] transition-colors"
            :class="category === c ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted text-foreground hover:bg-secondary'"
            @click="category = c"
          >
            {{ c }}
          </button>
        </div>
        </div>
      </div>

      <div
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-24 md:px-6 md:pb-6"
        @scroll.passive="menuScrolled = $event.target.scrollTop > 4"
      >
        <p v-if="catalog.loading" class="text-[15px] text-muted-foreground">Memuat menu...</p>
        <div v-else-if="catalog.error" class="flex items-center gap-3 text-[15px] text-destructive">
          {{ catalog.error }}
          <Button variant="secondary" size="sm" @click="catalog.load(true)">Coba lagi</Button>
        </div>
        <p v-else-if="!visibleProducts.length" class="text-[15px] text-muted-foreground">Menu tidak ditemukan.</p>
        <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-5">
          <ProductCard
            v-for="p in visibleProducts"
            :key="p.id"
            :product="p"
            @open="openCustomize"
            @quick-add="quickAdd"
          />
        </div>
      </div>
    </section>

    <!-- HP: bar bawah untuk membuka pesanan -->
    <button
      type="button"
      class="absolute inset-x-3 bottom-3 z-20 flex h-14 items-center justify-between rounded-2xl bg-cta px-4 text-cta-foreground shadow-lg md:hidden"
      :aria-expanded="showOrderSheet"
      @click="showOrderSheet = true"
    >
      <span class="flex items-center gap-2 text-[15px] font-semibold">
        <ShoppingBag class="size-5" />
        {{ order.isEmpty ? "Pesanan kosong" : `${order.lines.length} item` }}
      </span>
      <span class="tabular flex items-center gap-1.5 text-base font-bold">
        {{ formatRp(order.total) }} <ArrowRight class="size-5" />
      </span>
    </button>

    <!-- Kanan: pesanan (HP: layar penuh) -->
    <aside
      class="flex-col bg-card md:flex md:w-[360px] md:shrink-0 md:border-l xl:w-[400px]"
      :class="showOrderSheet ? 'fixed inset-0 z-40 flex pt-[env(safe-area-inset-top)] md:static' : 'hidden'"
    >
      <button
        type="button"
        class="flex h-11 shrink-0 items-center justify-center gap-1.5 border-b text-sm font-medium text-muted-foreground md:hidden"
        @click="showOrderSheet = false"
      >
        <ChevronDown class="size-4" /> Kembali ke menu
      </button>
      <!-- Bagian atas dibuat ringkas supaya daftar item dapat ruang paling banyak (tablet landscape) -->
      <div class="px-4 pt-3 md:px-5 md:pt-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-bold leading-tight">
            {{ title }}
            <span v-if="!order.isEmpty" class="tabular ml-1 text-sm font-medium text-muted-foreground">· {{ itemCount }} item</span>
          </h2>
          <div class="flex shrink-0 items-center">
            <button
              v-if="inKitchen"
              type="button"
              class="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              @click="reprintSlip"
            >
              <Printer class="size-4" /> Nota
            </button>
            <button
              v-if="!order.isEmpty || order.billId"
              type="button"
              class="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              @click="order.reset()"
            >
              <X class="size-4" /> {{ order.billId ? "Tutup" : "Kosongkan" }}
            </button>
          </div>
        </div>

        <div class="mt-2.5 flex items-center gap-2">
        <div
          class="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-xl p-1 transition-colors"
          :class="!order.orderType && !order.isEmpty ? 'bg-warning-soft ring-2 ring-warning/60' : 'bg-muted'"
          role="radiogroup"
          aria-label="Tipe pesanan"
        >
          <button
            v-for="t in KASIR_ORDER_TYPES"
            :key="t.value"
            type="button"
            role="radio"
            :aria-checked="order.orderType === t.value"
            class="h-9 truncate rounded-lg px-1 text-sm transition-colors"
            :class="order.orderType === t.value ? 'bg-card font-semibold text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="chooseType(t.value)"
          >
            {{ t.label }}
          </button>
        </div>

        <span v-if="order.table" class="tabular flex h-11 shrink-0 items-center rounded-xl bg-secondary px-3 text-sm font-semibold">
          No. {{ order.table.code }}
        </span>
        <button
          type="button"
          class="flex h-11 max-w-36 shrink-0 items-center justify-center gap-1.5 rounded-xl text-sm font-medium"
          :title="order.customer ? order.customer.name : 'Tambah pelanggan'"
          :class="order.customer ? 'bg-secondary px-3 text-primary' : 'w-11 border border-dashed text-muted-foreground hover:bg-muted'"
          :aria-label="order.customer ? `Pelanggan: ${order.customer.name}` : 'Tambah pelanggan'"
          @click="openCustomer"
        >
          <UserRound class="size-5 shrink-0" /> <span v-if="order.customer" class="truncate">{{ order.customer.name }}</span>
        </button>
        </div>
        <p v-if="inKitchen" class="mt-2 text-sm text-muted-foreground">{{ flowHint }}</p>
      </div>

      <div class="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t px-4 md:px-5">
        <div v-if="order.isEmpty" class="flex h-full flex-col items-center justify-center pb-10 text-center">
          <p class="text-[17px] font-semibold">Belum ada item</p>
          <p class="mt-1 text-[15px] text-muted-foreground">Ketuk menu<span class="hidden md:inline"> di kiri</span> untuk mulai.</p>
        </div>

        <ul v-else class="flex flex-col">
          <li v-for="line in order.lines" :key="line.key" class="border-b last:border-b-0">
            <button
              type="button"
              class="flex w-full items-start gap-2.5 py-2.5 text-left"
              :aria-expanded="activeLine === line.key"
              @click="toggleLine(line.key)"
            >
              <span class="tabular w-7 shrink-0 text-base font-semibold">{{ line.qty }}x</span>
              <span class="min-w-0 flex-1">
                <span class="block text-base font-semibold leading-snug">{{ splitName(line.name).title }}</span>
                <span v-if="lineDetail(line)" class="block text-sm leading-snug text-muted-foreground">{{ lineDetail(line) }}</span>
                <span v-if="line.note" class="block text-sm leading-snug text-muted-foreground">{{ line.note }}</span>
              </span>
              <span class="tabular shrink-0 text-[15px]">{{ number.format(line.price * line.qty) }}</span>
            </button>
            <div v-if="activeLine === line.key" class="flex items-center gap-2 pb-3 pl-9">
              <div class="flex h-11 items-center rounded-xl bg-muted px-1">
                <button type="button" class="flex size-9 items-center justify-center rounded-lg hover:bg-card" aria-label="Kurangi" @click="order.changeQty(line.key, -1)">
                  <Minus class="size-4" />
                </button>
                <span class="tabular w-8 text-center font-semibold">{{ line.qty }}</span>
                <button type="button" class="flex size-9 items-center justify-center rounded-lg hover:bg-card" aria-label="Tambah" @click="order.changeQty(line.key, 1)">
                  <Plus class="size-4" />
                </button>
              </div>
              <button
                type="button"
                class="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium hover:bg-muted"
                @click="editLine(line)"
              >
                <Pencil class="size-4" /> Ubah
              </button>
              <button
                type="button"
                class="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
                @click="order.removeLine(line.key)"
              >
                <Trash2 class="size-4" /> Hapus
              </button>
            </div>
          </li>
        </ul>

        <div v-if="!order.isEmpty" class="border-t py-3">
          <textarea
            v-if="editingNote || order.note"
            :value="order.note"
            rows="2"
            maxlength="200"
            placeholder="Catatan untuk seluruh pesanan"
            class="w-full resize-none rounded-xl border bg-muted/30 px-4 py-3 text-[15px] outline-none focus:border-primary focus:ring-3 focus:ring-ring/20"
            @input="order.setNote($event.target.value)"
          />
          <button
            v-else
            type="button"
            class="text-[15px] font-medium text-primary hover:underline"
            @click="editingNote = true"
          >
            + Tambah catatan pesanan
          </button>
        </div>
      </div>

      <div class="border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5 md:pb-4">
        <!-- Subtotal & pajak hanya tampil kalau ada pajak/biaya -->
        <p v-if="order.tax" class="tabular flex justify-between text-sm text-muted-foreground">
          <span>Subtotal {{ formatRp(order.subtotal) }}</span><span>Pajak {{ formatRp(order.tax) }}</span>
        </p>
        <div class="tabular flex items-baseline justify-between">
          <span class="text-lg font-semibold">Total</span>
          <span class="text-[28px] font-bold leading-tight tracking-tight">{{ formatRp(order.total) }}</span>
        </div>

        <!-- Kiri: aksi sekunder, kanan: aksi utama (satu baris supaya daftar pesanan lebih panjang) -->
        <div class="mt-2.5 flex gap-2.5">
          <Button
            v-if="inKitchen"
            variant="secondary"
            class="h-12 rounded-xl px-3 text-[15px] font-semibold"
            :disabled="order.isEmpty || order.saving || !order.dirty"
            @click="sendToKitchen"
          >
            Perbarui
          </Button>
          <!-- Simpan sebagai draft jarang dipakai, cukup tombol ikon -->
          <Button
            v-else
            variant="secondary"
            class="size-12 rounded-xl p-0"
            title="Simpan sebagai draft"
            aria-label="Simpan sebagai draft"
            :disabled="order.isEmpty || order.saving"
            @click="saveOrder"
          >
            <FilePenLine class="size-5" />
          </Button>
          <Button
            class="h-12 min-w-0 flex-1 justify-between rounded-xl px-4 text-base font-semibold"
            :disabled="order.isEmpty || order.saving"
            @click="primaryAction.run"
          >
            {{ order.saving ? "Memproses..." : primaryAction.label }}
            <ArrowRight class="size-5" />
          </Button>
        </div>
      </div>
    </aside>

    <CustomizeDialog v-model:open="showCustomize" :product="customizing" :editing="editingLine" @add="addFromDialog" />
    <OrderSlipPopup
      v-model:open="showSlip"
      :bill="slipBill"
      :title="slipTitle"
      :updated="slipUpdated"
      @print="printOrderSlip(slipBill, { updated: slipUpdated })"
    />
    <!-- Wajib pilih Dine-in / Take away sebelum bayar -->
    <Dialog v-model:open="askType">
      <DialogContent class="p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">Makan di sini atau bawa pulang?</DialogTitle>
          <DialogDescription class="text-[15px]">Tanyakan ke pelanggan dulu, lalu pilih.</DialogDescription>
        </DialogHeader>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="flex h-36 flex-col items-center justify-center gap-3 rounded-2xl border-2 bg-card text-xl font-bold transition hover:border-primary hover:bg-secondary"
            @click="pickTypeAndPay('dine_in')"
          >
            <Utensils class="size-10" /> Makan di tempat
          </button>
          <button
            type="button"
            class="flex h-36 flex-col items-center justify-center gap-3 rounded-2xl border-2 bg-card text-xl font-bold transition hover:border-primary hover:bg-secondary"
            @click="pickTypeAndPay('pickup')"
          >
            <ShoppingBag class="size-10" /> Bungkus
            <span class="-mt-2 text-sm font-normal text-muted-foreground">Bawa pulang</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <CustomerPopup
      v-model:open="showCustomer"
      :customers="customers"
      :loading="customersLoading"
      :saving="customerSaving"
      :error="customerError"
      @save-customer="saveCustomer"
      @select-customer="selectCustomer"
    />
  </div>
</template>
