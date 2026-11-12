<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import PrintPopup from "@/components/PrintPopup.vue";
import { api } from "@/lib/api";
import { formatRp, number, orderNo, orderTypeLabel, splitName, optionsText } from "@/lib/format";
import { printBill } from "@/lib/receipt";
import { useOrderStore } from "@/stores/order";
import { useUiStore } from "@/stores/ui";

const order = useOrderStore();
const ui = useUiStore();
const router = useRouter();

// Tidak ada pesanan untuk dibayar: kembali ke daftar transaksi
onMounted(() => {
  if (order.isEmpty) router.replace("/transaksi");
});

const METHODS = [
  { value: "cash", label: "Tunai" },
  { value: "qris", label: "QRIS" },
  { value: "card", label: "Kartu" },
];
const method = ref("cash");

// ---- Tunai: uang diterima, nominal cepat, kembalian ----
const received = ref("");
const receivedValue = computed(() => Number(String(received.value).replace(/\D/g, "")) || 0);
const change = computed(() => receivedValue.value - order.total);

function onReceivedInput(e) {
  const digits = e.target.value.replace(/\D/g, "");
  received.value = digits ? number.format(Number(digits)) : "";
  e.target.value = received.value;
}

const quickAmounts = computed(() => {
  const t = order.total;
  const out = [];
  for (const step of [10000, 50000, 100000]) {
    const v = Math.ceil(t / step) * step;
    if (v > t && !out.includes(v)) out.push(v);
  }
  let next = (out.at(-1) ?? t) + 50000;
  while (out.length < 2) {
    out.push(next);
    next += 50000;
  }
  return out.slice(0, 2);
});

function setReceived(v) {
  received.value = number.format(v);
}

watch(method, () => (received.value = ""));

const canConfirm = computed(
  () => !order.isEmpty && !order.saving && (method.value !== "cash" || receivedValue.value >= order.total)
);

// ---- Konfirmasi: tombol dikunci selama proses, lalu tampilkan struk ----
const showPrint = ref(false);
const printData = ref(null);
const printLoading = ref(false);
const printError = ref("");
const error = ref("");

const meta = computed(() =>
  [
    order.table ? `Meja ${order.table.code}` : null,
    orderTypeLabel(order.orderType),
    order.customer?.name,
    ui.user?.name?.split(" ")[0],
  ]
    .filter(Boolean)
    .join(" · ")
);

async function confirm() {
  if (!canConfirm.value) return;
  error.value = "";
  try {
    const wasInKitchen = Boolean(order.kitchenStatus);
    const id = await order.pay(ui.user.id, method.value);
    order.reset();
    ui.toast(wasInKitchen ? `Pesanan ${orderNo(id)} lunas` : `Pesanan ${orderNo(id)} lunas dan dikirim ke dapur`);
    received.value = "";
    showPrint.value = true;
    printLoading.value = true;
    printError.value = "";
    try {
      printData.value = (await api(`/bills/${id}`)).data;
    } catch (e) {
      printError.value = e.message;
    } finally {
      printLoading.value = false;
    }
  } catch (e) {
    error.value = e.message;
  }
}

function closePrint(open) {
  showPrint.value = open;
  if (!open) router.push("/kasir");
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-6 py-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold leading-tight">
          Pembayaran {{ order.billId ? orderNo(order.billId) : "pesanan baru" }}
        </h1>
        <p class="mt-0.5 text-sm text-muted-foreground">{{ meta }}</p>
      </div>
      <Button variant="secondary" class="h-11 rounded-xl px-4 text-[15px]" @click="router.push('/kasir')">
        <ArrowLeft /> Kembali ke kasir
      </Button>
    </div>

    <div v-if="!order.isEmpty" class="mt-5 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <!-- Ringkasan -->
      <section class="flex flex-col rounded-[20px] bg-muted/50 p-6">
        <h2 class="text-lg font-semibold">Ringkasan pesanan</h2>
        <ul class="mt-4 flex flex-col gap-3">
          <li v-for="line in order.lines" :key="line.key" class="tabular grid grid-cols-[1fr_auto] gap-x-6 text-[15px]">
            <span>{{ line.qty }}x {{ splitName(line.name).title }}</span>
            <span class="text-right">{{ number.format(line.price * line.qty) }}</span>
            <span
              v-if="splitName(line.name).detail || line.options?.length || line.note"
              class="col-span-2 text-xs text-muted-foreground"
            >
              {{ [splitName(line.name).detail, optionsText(line.options), line.note].filter(Boolean).join(" · ") }}
            </span>
          </li>
        </ul>
        <dl class="tabular mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t pt-4 text-[15px]">
          <dt>Subtotal</dt>
          <dd class="text-right">{{ number.format(order.subtotal) }}</dd>
          <dt>Pajak / biaya</dt>
          <dd class="text-right">{{ number.format(order.tax) }}</dd>
        </dl>
        <p class="mt-6 text-sm text-muted-foreground">Total bayar</p>
        <p class="tabular mt-1 text-[38px] font-bold leading-none tracking-tight">{{ formatRp(order.total) }}</p>
        <p class="mt-4 text-xs text-muted-foreground">Pajak mengikuti pengaturan outlet.</p>
      </section>

      <!-- Metode -->
      <section class="flex flex-col">
        <h2 class="text-lg font-semibold">Metode pembayaran</h2>
        <div class="mt-3 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Metode pembayaran">
          <button
            v-for="m in METHODS"
            :key="m.value"
            type="button"
            role="radio"
            :aria-checked="method === m.value"
            class="h-12 rounded-xl border px-4 text-left text-base transition-colors"
            :class="method === m.value ? 'border-primary bg-secondary font-semibold text-primary' : 'bg-card hover:bg-muted/50'"
            @click="method = m.value"
          >
            {{ m.label }}
          </button>
        </div>

        <template v-if="method === 'cash'">
          <label for="received" class="mt-5 text-sm text-muted-foreground">Uang diterima</label>
          <div class="relative mt-2">
            <span class="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-[28px] font-semibold">Rp</span>
            <input
              id="received"
              :value="received"
              inputmode="numeric"
              autocomplete="off"
              placeholder="0"
              class="tabular h-16 w-full rounded-2xl border bg-card pr-5 pl-[3.75rem] text-[28px] font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-ring/20"
              @input="onReceivedInput"
              @keydown.enter="confirm"
            />
          </div>
          <div class="mt-3 grid grid-cols-3 gap-3">
            <button
              type="button"
              class="h-11 rounded-full bg-secondary px-4 text-left text-sm font-semibold text-primary hover:bg-[#e6ddf4]"
              @click="setReceived(order.total)"
            >
              Uang pas
            </button>
            <button
              v-for="v in quickAmounts"
              :key="v"
              type="button"
              class="tabular h-11 rounded-full bg-secondary px-4 text-left text-sm font-semibold text-primary hover:bg-[#e6ddf4]"
              @click="setReceived(v)"
            >
              {{ formatRp(v) }}
            </button>
          </div>

          <div
            class="mt-4 flex items-center justify-between rounded-2xl px-5 py-4"
            :class="received && change < 0 ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'"
          >
            <span class="text-[15px]">{{ received && change < 0 ? "Kurang" : "Kembalian" }}</span>
            <span class="tabular text-[28px] font-bold leading-none">{{ formatRp(Math.abs(received ? change : 0)) }}</span>
          </div>
        </template>

        <p v-else-if="method === 'qris'" class="mt-5 rounded-2xl bg-muted/60 px-5 py-4 text-[15px]">
          Tunjukkan QRIS ke pelanggan, lalu konfirmasi setelah pembayaran masuk.
        </p>
        <p v-else class="mt-5 rounded-2xl bg-muted/60 px-5 py-4 text-[15px]">
          Proses kartu di mesin EDC, lalu konfirmasi setelah transaksi berhasil.
        </p>

        <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

        <Button class="mt-5 h-13 justify-start rounded-xl px-5 text-base font-semibold" :disabled="!canConfirm" @click="confirm">
          {{ order.saving ? "Memproses..." : "Konfirmasi pembayaran" }}
        </Button>
        <p v-if="method === 'qris'" class="mt-2 text-xs text-muted-foreground">QRIS: selesai hanya setelah status pembayaran terverifikasi.</p>
      </section>
    </div>

    <PrintPopup
      :open="showPrint"
      :bill="printData"
      :loading="printLoading"
      :error="printError"
      @update:open="closePrint"
      @print-bill="printBill(printData)"
    />
  </div>
</template>
