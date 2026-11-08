<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { Printer, ReceiptText } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import PrintPopup from "@/components/PrintPopup.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import OrderSlipPopup from "@/components/OrderSlipPopup.vue";
import { api } from "@/lib/api";
import { formatRp, orderNo, orderTypeLabel, timeOnly, todayISO, longDate, PAYMENT_LABELS } from "@/lib/format";
import { printBill, printOrderSlip } from "@/lib/receipt";
import { useOrderStore } from "@/stores/order";
import { useSafeLoad } from "@/composables/useSafeLoad";
import { useLive } from "@/lib/live";

const order = useOrderStore();
const router = useRouter();
const { confirmOpen, guard, proceed } = useSafeLoad();

const tab = ref("pending"); // pending | paid
const bills = ref([]);
const loading = ref(false);
const error = ref("");

const KITCHEN = {
  new: { label: "Baru di dapur", cls: "bg-secondary text-primary" },
  cooking: { label: "Dimasak", cls: "bg-warning-soft text-warning" },
  ready: { label: "Siap saji", cls: "bg-success-soft text-success" },
  served: { label: "Disajikan", cls: "bg-muted text-muted-foreground" },
};

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const params = tab.value === "pending" ? "status=pending" : `status=paid&date=${todayISO()}`;
    bills.value = (await api(`/bills?${params}`)).data;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(tab, load);
useLive(() => load());

const total = computed(() => bills.value.reduce((s, b) => s + b.grand_total, 0));
const itemCount = (b) => b.billItems.reduce((s, i) => s + i.qty, 0);
const where = (b) =>
  [b.table_code ? `Meja ${b.table_code}` : orderTypeLabel(b.order_type), b.customer_name].filter(Boolean).join(" · ");

function openInKasir(b, pay = false) {
  guard(() => {
    order.loadBill(b);
    router.push(pay ? "/transaksi/bayar" : "/kasir");
  });
}

// Cetak ulang struk transaksi yang sudah dibayar
const showPrint = ref(false);
const printData = ref(null);
function reprint(b) {
  printData.value = b;
  showPrint.value = true;
}

// Cetak ulang nota pesanan untuk pesanan yang belum dibayar
const showSlip = ref(false);
const slipBill = ref(null);
function openSlip(b) {
  slipBill.value = b;
  showSlip.value = true;
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-8 py-7">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-[32px] font-bold leading-tight">Transaksi</h1>
        <p class="mt-1 text-[15px] text-muted-foreground">{{ longDate() }}</p>
      </div>
      <div class="flex rounded-xl bg-muted p-1" role="tablist">
        <button
          v-for="t in [{ v: 'pending', l: 'Pesanan terbuka' }, { v: 'paid', l: 'Selesai hari ini' }]"
          :key="t.v"
          type="button"
          role="tab"
          :aria-selected="tab === t.v"
          class="h-11 rounded-lg px-5 text-[15px] font-medium transition-colors"
          :class="tab === t.v ? 'bg-card font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
          @click="tab = t.v"
        >
          {{ t.l }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="mt-8 text-[15px] text-muted-foreground">Memuat transaksi...</p>
    <p v-else-if="error" class="mt-8 text-[15px] text-destructive">{{ error }}</p>
    <p v-else-if="!bills.length" class="mt-8 rounded-[20px] border border-dashed px-6 py-12 text-center text-[15px] text-muted-foreground">
      {{ tab === "pending" ? "Tidak ada pesanan terbuka." : "Belum ada transaksi selesai hari ini." }}
    </p>

    <template v-else>
      <p class="tabular mt-6 text-[15px] text-muted-foreground">
        {{ bills.length }} transaksi · {{ formatRp(total) }}
      </p>
      <ul class="mt-4 flex flex-col divide-y rounded-[20px] border">
        <li v-for="b in bills" :key="b.billId" class="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
          <div class="w-20">
            <p class="tabular text-lg font-semibold">{{ orderNo(b.billId) }}</p>
            <p class="tabular text-sm text-muted-foreground">{{ timeOnly(b.paid_at ?? b.created_at) }}</p>
          </div>
          <div class="min-w-48 flex-1">
            <p class="text-[17px] font-medium">{{ where(b) }}</p>
            <p class="text-sm text-muted-foreground">
              {{ itemCount(b) }} item · {{ b.employee_name }}
              <template v-if="b.payment_method"> · {{ PAYMENT_LABELS[b.payment_method] }}</template>
            </p>
          </div>
          <span
            v-if="b.kitchen_status && tab === 'pending'"
            class="rounded-full px-3 py-1 text-sm font-semibold"
            :class="KITCHEN[b.kitchen_status]?.cls"
          >
            {{ KITCHEN[b.kitchen_status]?.label }}
          </span>
          <p class="tabular w-32 text-right text-lg font-semibold">{{ formatRp(b.grand_total) }}</p>
          <div class="flex gap-2">
            <template v-if="tab === 'pending'">
              <Button variant="secondary" class="h-12 rounded-xl px-4 text-[15px]" :aria-label="`Nota pesanan ${orderNo(b.billId)}`" @click="openSlip(b)">
                <ReceiptText /> Nota
              </Button>
              <Button variant="secondary" class="h-12 rounded-xl px-5 text-[15px]" @click="openInKasir(b)">Buka di kasir</Button>
              <Button class="h-12 rounded-xl px-5 text-[15px]" @click="openInKasir(b, true)">Bayar</Button>
            </template>
            <Button v-else variant="secondary" class="h-12 rounded-xl px-5 text-[15px]" @click="reprint(b)">
              <Printer /> Struk
            </Button>
          </div>
        </li>
      </ul>
    </template>

    <OrderSlipPopup
      v-model:open="showSlip"
      :bill="slipBill"
      :title="`Nota pesanan ${orderNo(slipBill?.billId)}`"
      @print="printOrderSlip(slipBill)"
    />
    <PrintPopup v-model:open="showPrint" :bill="printData" title="Struk transaksi" @print-bill="printBill(printData)" />
    <ConfirmDialog
      v-model:open="confirmOpen"
      title="Ganti pesanan di kasir?"
      description="Pesanan yang sedang dibuat belum disimpan dan akan dibuang."
      confirm-label="Buang & lanjutkan"
      @confirm="proceed"
    />
  </div>
</template>
