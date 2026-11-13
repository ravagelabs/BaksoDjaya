<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ArrowRight, ChevronDown, FilePenLine, Pencil, ShoppingBag, Minus, Plus, Printer, Search, Trash2, UserRound, X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard.vue";
import CustomizeDialog from "@/components/CustomizeDialog.vue";
import OrderSetupDialog from "@/components/OrderSetupDialog.vue";
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

const visibleProducts = computed(() => {
  const q = query.value.trim().toLowerCase();
  return catalog.gridProducts.filter((p) => {
    if (category.value !== "Semua" && (p.category || "Lainnya") !== category.value) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || String(p.id) === q;
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
  editingLine.value = { key: line.key, qty: line.qty, note: line.note ?? "", options: line.options ?? [], paket: found.paket };
  customizing.value = found.product;
  showCustomize.value = true;
}

// Tombol +: langsung tambah dengan pilihan default. Paket tetap harus dipilih dulu.
function quickAdd(product) {
  if (product.isPaket) return openCustomize(product);
  order.addLine({ product, qty: 1, options: catalog.defaultOptions(product.category) });
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

// ---- Meja, tipe, pelanggan ----
const showSetup = ref(false);
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
const isDineIn = computed(() => order.orderType === "dine_in");

// Alur dine-in (pager): pilih menu -> pilih nomor -> Bayar (langsung masuk dapur)
//                       atau "Ke dapur" dulu (cetak nota), bayar belakangan
// Alur take away:       pilih menu -> bayar -> otomatis masuk dapur
const primaryAction = computed(() => {
  if (isDineIn.value && !order.table && !inKitchen.value) return { label: "Pilih nomor", run: () => (showSetup.value = true) };
  return { label: "Bayar", run: goPay };
});

// Tombol "Ke dapur" di samping Bayar: hanya dine-in yang sudah punya nomor dan belum di dapur
const showKitchenButton = computed(() => isDineIn.value && Boolean(order.table) && !inKitchen.value);

const flowHint = computed(() => {
  if (!isDineIn.value) return "Take away dibayar dulu, lalu otomatis masuk antrean dapur.";
  if (inKitchen.value) return "Sudah di dapur. Nomor berbunyi saat pesanan siap.";
  if (!order.table) return "Pilih nomor untuk pelanggan.";
  return "Bayar sekarang, atau kirim ke dapur dulu dan bayar belakangan.";
});

function chooseType(type) {
  if (type === order.orderType) return;
  order.setOrderType(type);
  if (type === "dine_in" && !order.table) showSetup.value = true;
}

async function sendToKitchen() {
  if (isDineIn.value && !order.table) {
    showSetup.value = true;
    return;
  }
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

function goPay() {
  router.push("/transaksi/bayar");
}
</script>

<template>
  <div class="relative flex h-full">
    <!-- Kiri: menu -->
    <section class="flex min-w-0 flex-1 flex-col">
      <div class="px-4 pt-4 md:px-6 md:pt-5">
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

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24 md:px-6 md:pb-6">
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
      <div class="px-4 pt-4 md:px-6 md:pt-5">
        <div class="flex items-start justify-between gap-3">
          <h2 class="text-2xl font-bold leading-tight">{{ title }}</h2>
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

        <div class="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Tipe pesanan">
          <button
            v-for="t in KASIR_ORDER_TYPES"
            :key="t.value"
            type="button"
            role="radio"
            :aria-checked="order.orderType === t.value"
            class="h-11 rounded-lg text-[15px] transition-colors"
            :class="order.orderType === t.value ? 'bg-card font-semibold text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="chooseType(t.value)"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="mt-2.5 flex flex-wrap gap-2">
          <button
            v-if="isDineIn"
            type="button"
            class="h-10 rounded-full px-5 text-sm font-semibold"
            :class="order.table ? 'bg-secondary text-primary hover:bg-secondary-hover' : 'border border-dashed border-primary/50 text-primary hover:bg-secondary'"
            @click="showSetup = true"
          >
            {{ order.table ? `No. ${order.table.code}` : "Pilih nomor" }}
          </button>
          <button
            type="button"
            class="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium"
            :class="order.customer ? 'bg-secondary text-primary' : 'border border-dashed text-muted-foreground hover:bg-muted'"
            @click="openCustomer"
          >
            <UserRound class="size-4" /> {{ order.customer ? order.customer.name : "Pelanggan" }}
          </button>
        </div>
        <p class="mt-2.5 text-sm text-muted-foreground">{{ flowHint }}</p>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 md:px-6">
        <div v-if="order.isEmpty" class="flex h-full flex-col items-center justify-center pb-10 text-center">
          <p class="text-[17px] font-semibold">Belum ada item</p>
          <p class="mt-1 text-[15px] text-muted-foreground">Ketuk menu<span class="hidden md:inline"> di kiri</span> untuk mulai.</p>
        </div>

        <ul v-else class="flex flex-col">
          <li v-for="line in order.lines" :key="line.key" class="border-b last:border-b-0">
            <button
              type="button"
              class="flex w-full items-start gap-3 py-3 text-left"
              :aria-expanded="activeLine === line.key"
              @click="toggleLine(line.key)"
            >
              <span class="tabular w-8 shrink-0 text-[17px] font-semibold">{{ line.qty }}x</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[17px] font-semibold leading-snug">{{ splitName(line.name).title }}</span>
                <span v-if="lineDetail(line)" class="mt-0.5 block text-[15px] text-muted-foreground">{{ lineDetail(line) }}</span>
                <span v-if="line.note" class="mt-0.5 block text-[15px] text-muted-foreground">{{ line.note }}</span>
              </span>
              <span class="tabular shrink-0 pt-0.5 text-base">{{ number.format(line.price * line.qty) }}</span>
            </button>
            <div v-if="activeLine === line.key" class="flex items-center gap-3 pb-4 pl-11">
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

        <div v-if="!order.isEmpty" class="border-t py-4">
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
            class="text-[17px] font-medium text-primary hover:underline"
            @click="editingNote = true"
          >
            + Tambah catatan pesanan
          </button>
        </div>
      </div>

      <div class="border-t px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
        <dl class="tabular grid grid-cols-[1fr_auto] gap-y-1.5 text-[15px]">
          <dt class="text-muted-foreground">Subtotal</dt>
          <dd class="text-right">{{ formatRp(order.subtotal) }}</dd>
          <dt class="text-muted-foreground">Pajak / biaya</dt>
          <dd class="text-right">{{ formatRp(order.tax) }}</dd>
          <dt class="mt-2 self-end text-xl font-semibold">Total</dt>
          <dd class="mt-2 text-right text-[34px] font-bold leading-none tracking-tight">{{ formatRp(order.total) }}</dd>
        </dl>

        <!-- Kiri: aksi sekunder, kanan: aksi utama (satu baris supaya daftar pesanan lebih panjang) -->
        <div class="mt-4 flex gap-2.5">
          <Button
            v-if="inKitchen"
            variant="secondary"
            class="h-13 rounded-xl px-3 text-[15px] font-semibold"
            :disabled="order.isEmpty || order.saving || !order.dirty"
            @click="sendToKitchen"
          >
            Perbarui
          </Button>
          <!-- Simpan sebagai draft jarang dipakai, cukup tombol ikon -->
          <Button
            v-else
            variant="secondary"
            class="size-13 rounded-xl p-0"
            title="Simpan sebagai draft"
            aria-label="Simpan sebagai draft"
            :disabled="order.isEmpty || order.saving"
            @click="saveOrder"
          >
            <FilePenLine class="size-5" />
          </Button>
          <Button
            v-if="showKitchenButton"
            variant="secondary"
            class="h-13 min-w-0 flex-1 gap-2 rounded-xl px-3 text-[15px] font-semibold"
            :disabled="order.isEmpty || order.saving"
            @click="sendToKitchen"
          >
            <Printer class="size-5 shrink-0" /> <span class="truncate">Ke dapur</span>
          </Button>
          <Button
            class="h-13 min-w-0 flex-[1.4] justify-between rounded-xl px-4 text-base font-semibold"
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
    <OrderSetupDialog v-model:open="showSetup" />
    <OrderSlipPopup
      v-model:open="showSlip"
      :bill="slipBill"
      :title="slipTitle"
      :updated="slipUpdated"
      @print="printOrderSlip(slipBill, { updated: slipUpdated })"
    />
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
