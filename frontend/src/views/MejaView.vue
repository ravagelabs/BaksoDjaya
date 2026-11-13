<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/lib/api";
import { formatRp, minutesSince } from "@/lib/format";
import { useOrderStore } from "@/stores/order";
import { useUiStore } from "@/stores/ui";
import { useSafeLoad } from "@/composables/useSafeLoad";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { useLive } from "@/lib/live";

const order = useOrderStore();
const ui = useUiStore();
const router = useRouter();
const { confirmOpen, guard, proceed } = useSafeLoad();

const tables = ref([]);
const loading = ref(true);
const error = ref("");
const now = ref(Date.now());
const filter = ref(null); // null | available | occupied | waiting_payment

const STATUS = {
  available: { label: "Tersedia", card: "bg-[#f8f7f4]", text: "text-muted-foreground", chip: "bg-muted text-foreground" },
  occupied: { label: "Terisi", card: "bg-secondary", text: "text-primary", chip: "bg-secondary text-primary" },
  waiting_payment: { label: "Menunggu bayar", card: "bg-warning-soft", text: "text-warning", chip: "bg-warning-soft text-warning" },
};

async function load() {
  try {
    tables.value = (await api("/tables")).data;
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

// Status meja ikut berubah begitu ada pesanan dikirim, disajikan, atau dibayar
useLive(() => load());

let timer;
onMounted(() => {
  load();
  timer = setInterval(() => {
    now.value = Date.now();
    load();
  }, 15000);
});
onUnmounted(() => clearInterval(timer));

const counts = computed(() => {
  const c = { available: 0, occupied: 0, waiting_payment: 0 };
  for (const t of tables.value) c[t.status]++;
  return c;
});

const visible = computed(() => (filter.value ? tables.value.filter((t) => t.status === filter.value) : tables.value));

function subline(t) {
  if (t.status === "available") return "Ketuk untuk buka";
  if (t.status === "waiting_payment") return formatRp(t.grand_total);
  const parts = [];
  if (t.guests) parts.push(`${t.guests} tamu`);
  parts.push(`${minutesSince(t.bill_created_at, now.value)} menit`);
  return parts.join(" · ");
}

function open(t) {
  guard(async () => {
    try {
      if (t.status === "available") {
        order.reset();
        order.setTable(t);
        order.dirty = false;
        router.push("/kasir");
        return;
      }
      await order.fetchAndLoad(t.bill_id);
      router.push(t.status === "waiting_payment" ? "/transaksi/bayar" : "/kasir");
    } catch (e) {
      ui.toast(e.message, "error");
    }
  });
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-8 py-7">
    <h1 class="text-[32px] font-bold leading-tight">Ruang makan</h1>
    <p class="mt-1 text-[15px] text-muted-foreground">
      {{ tables.length }} meja · {{ counts.available }} tersedia · {{ counts.occupied }} terisi ·
      {{ counts.waiting_payment }} menunggu bayar
    </p>

    <div class="mt-6 flex flex-wrap gap-3" role="group" aria-label="Filter status meja">
      <button
        v-for="(s, key) in STATUS"
        :key="key"
        type="button"
        class="h-11 w-56 rounded-full px-5 text-left text-[15px] font-medium ring-primary/50 transition"
        :class="[s.chip, filter === key ? 'ring-2' : 'opacity-90 hover:opacity-100']"
        :aria-pressed="filter === key"
        @click="filter = filter === key ? null : key"
      >
        {{ s.label }} <span class="tabular opacity-70">({{ counts[key] }})</span>
      </button>
    </div>

    <p v-if="loading" class="mt-8 text-[15px] text-muted-foreground">Memuat meja...</p>
    <p v-else-if="error" class="mt-8 text-[15px] text-destructive">{{ error }}</p>
    <div v-else class="mt-7 grid grid-cols-2 gap-6 lg:grid-cols-3 xl:grid-cols-4">
      <button
        v-for="t in visible"
        :key="t.id"
        type="button"
        class="flex min-h-40 flex-col rounded-[20px] p-7 text-left transition hover:brightness-[0.98] focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        :class="STATUS[t.status].card"
        @click="open(t)"
      >
        <span class="flex items-baseline justify-between">
          <span class="tabular text-[40px] font-semibold leading-none">{{ t.code }}</span>
          <span class="text-[15px] text-muted-foreground">{{ t.seats }} kursi</span>
        </span>
        <span class="mt-5 text-xl font-semibold" :class="STATUS[t.status].text">{{ STATUS[t.status].label }}</span>
        <span class="tabular mt-3 text-[17px] text-muted-foreground">{{ subline(t) }}</span>
      </button>
    </div>

    <ConfirmDialog
      v-model:open="confirmOpen"
      title="Ganti pesanan di kasir?"
      description="Pesanan yang sedang dibuat belum disimpan dan akan dibuang."
      confirm-label="Buang & lanjutkan"
      @confirm="proceed"
    />
  </div>
</template>
