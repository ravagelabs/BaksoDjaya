<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { Undo2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatRp, minutesSince, orderNo, orderTypeLabel, optionsText, splitName } from "@/lib/format";
import { useOrderStore } from "@/stores/order";
import { useUiStore } from "@/stores/ui";
import { useSafeLoad } from "@/composables/useSafeLoad";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { useLive } from "@/lib/live";

// Halaman Nomor: nomor pager mana sedang dipakai pesanan apa, dan tombol "Kembalikan nomor"
// saat pelanggan mengembalikan pagernya.
const order = useOrderStore();
const ui = useUiStore();
const router = useRouter();
const { confirmOpen, guard, proceed } = useSafeLoad();

const tables = ref([]);
const loading = ref(true);
const error = ref("");
const now = ref(Date.now());
const filter = ref(null); // null | available | occupied | waiting_return

const STATUS = {
  available: { label: "Tersedia", card: "bg-[#f8f7f4]", text: "text-muted-foreground", chip: "bg-muted text-foreground" },
  occupied: { label: "Dipakai", card: "bg-secondary", text: "text-foreground", chip: "bg-secondary text-foreground" },
  waiting_return: { label: "Belum dikembalikan", card: "bg-warning-soft", text: "text-warning", chip: "bg-warning-soft text-warning" },
};

// Posisi pesanan di dapur, dengan bahasa kasir
const KITCHEN = {
  new: "Baru masuk dapur",
  cooking: "Sedang dimasak",
  ready: "Siap, bunyikan nomor",
  served: "Sudah diambil",
};
const kitchenLabel = (t) => KITCHEN[t.kitchen_status] ?? "Belum masuk dapur";

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

// Ikut berubah begitu ada pesanan dibayar, diberi nomor, disiapkan dapur, atau nomor dikembalikan
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
  const c = { available: 0, occupied: 0, waiting_return: 0 };
  for (const t of tables.value) c[t.status] = (c[t.status] ?? 0) + 1;
  return c;
});

const visible = computed(() => (filter.value ? tables.value.filter((t) => t.status === filter.value) : tables.value));

const itemCount = (t) => (t.items ?? []).reduce((s, i) => s + i.qty, 0);

// Ringkasan isi pesanan di kartu: "2x Paket Siji, 1x Es Jeruk"
function itemSummary(t) {
  const items = t.items ?? [];
  const shown = items.slice(0, 2).map((i) => `${i.qty}x ${splitName(i.name).title}`);
  if (items.length > 2) shown.push(`+${items.length - 2} lainnya`);
  return shown.join(", ");
}

// ---- Detail satu nomor ----
const selectedId = ref(null);
const selected = computed(() => tables.value.find((t) => t.id === selectedId.value && t.status !== "available") ?? null);
const returning = ref(false);

function open(t) {
  if (t.status === "available") return;
  selectedId.value = t.id;
}

async function returnNumber() {
  const t = selected.value;
  if (!t || returning.value) return;
  returning.value = true;
  try {
    await api(`/tables/${t.id}/return`, { method: "POST" });
    ui.toast(`Nomor ${t.code} sudah dikembalikan`);
    selectedId.value = null;
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    returning.value = false;
  }
}

// Pesanan lama yang belum dibayar: buka di kasir untuk dibayar
function openInKasir() {
  const t = selected.value;
  if (!t) return;
  guard(async () => {
    try {
      await order.fetchAndLoad(t.bill_id);
      selectedId.value = null;
      router.push("/transaksi/bayar");
    } catch (e) {
      ui.toast(e.message, "error");
    }
  });
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-4 py-5 md:px-8 md:py-7">
    <h1 class="text-[28px] font-bold leading-tight md:text-[32px]">Nomor pesanan</h1>
    <p class="mt-1 text-[15px] text-muted-foreground">
      {{ tables.length }} nomor · {{ counts.available }} tersedia · {{ counts.occupied }} dipakai ·
      {{ counts.waiting_return }} belum dikembalikan
    </p>

    <div class="mt-5 flex flex-wrap gap-2.5" role="group" aria-label="Filter status nomor">
      <button
        v-for="(s, key) in STATUS"
        :key="key"
        type="button"
        class="h-11 rounded-full px-5 text-left text-[15px] font-medium ring-primary/50 transition"
        :class="[s.chip, filter === key ? 'ring-2' : 'opacity-90 hover:opacity-100']"
        :aria-pressed="filter === key"
        @click="filter = filter === key ? null : key"
      >
        {{ s.label }} <span class="tabular opacity-70">({{ counts[key] }})</span>
      </button>
    </div>

    <p v-if="loading" class="mt-8 text-[15px] text-muted-foreground">Memuat nomor...</p>
    <p v-else-if="error" class="mt-8 text-[15px] text-destructive">{{ error }}</p>
    <div v-else class="mt-6 grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      <component
        :is="t.status === 'available' ? 'div' : 'button'"
        v-for="t in visible"
        :key="t.id"
        :type="t.status === 'available' ? undefined : 'button'"
        class="flex min-h-40 flex-col rounded-[20px] p-5 text-left md:p-6"
        :class="[
          STATUS[t.status].card,
          t.status === 'available' ? '' : 'transition hover:brightness-[0.98] focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none',
        ]"
        @click="open(t)"
      >
        <span class="flex items-baseline justify-between gap-2">
          <span class="tabular text-[40px] font-semibold leading-none" :class="t.status === 'available' ? 'text-muted-foreground/70' : ''">
            {{ t.code }}
          </span>
          <span v-if="t.bill_id" class="tabular text-sm text-muted-foreground">{{ minutesSince(t.bill_created_at, now) }} menit</span>
        </span>

        <template v-if="t.status === 'available'">
          <span class="mt-4 text-lg font-semibold text-muted-foreground">Tersedia</span>
        </template>
        <template v-else>
          <span class="mt-4 text-lg font-semibold leading-snug" :class="STATUS[t.status].text">{{ kitchenLabel(t) }}</span>
          <span class="mt-1 text-[15px] font-medium">Pesanan {{ orderNo(t.bill_id) }}</span>
          <span class="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{{ itemSummary(t) }}</span>
        </template>
      </component>
    </div>

    <!-- Detail nomor: isi pesanan + kembalikan nomor -->
    <Dialog :open="Boolean(selected)" @update:open="!$event && (selectedId = null)">
      <DialogContent v-if="selected" class="max-h-[88dvh] overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-4 text-left">
            <span class="tabular flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
              {{ selected.code }}
            </span>
            <span class="min-w-0">
              <span class="block text-xl font-bold">Pesanan {{ orderNo(selected.bill_id) }}</span>
              <span class="mt-0.5 block text-[15px] font-normal text-muted-foreground">
                {{ orderTypeLabel(selected.order_type) }}<template v-if="selected.customer_name"> · {{ selected.customer_name }}</template>
                · {{ minutesSince(selected.bill_created_at, now) }} menit lalu
              </span>
            </span>
          </DialogTitle>
          <DialogDescription class="sr-only">Isi pesanan untuk nomor {{ selected.code }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-wrap gap-2 text-sm font-medium">
          <span class="rounded-full px-3 py-1" :class="STATUS[selected.status].chip">{{ kitchenLabel(selected) }}</span>
          <span
            class="rounded-full px-3 py-1"
            :class="selected.bill_status === 'paid' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'"
          >
            {{ selected.bill_status === "paid" ? "Lunas" : "Belum dibayar" }}
          </span>
        </div>

        <ul class="flex flex-col gap-2.5 border-y py-4">
          <li v-for="(i, idx) in selected.items" :key="idx" class="flex gap-3 text-[15px]">
            <span class="tabular w-7 shrink-0 font-semibold">{{ i.qty }}x</span>
            <span class="min-w-0">
              <span class="block font-medium">{{ splitName(i.name).title }}</span>
              <span
                v-if="splitName(i.name).detail || i.options?.length || i.note"
                class="block text-sm text-muted-foreground"
              >
                {{ [splitName(i.name).detail, optionsText(i.options), i.note].filter(Boolean).join(" · ") }}
              </span>
            </span>
          </li>
        </ul>

        <div class="flex items-end justify-between">
          <span class="text-muted-foreground">{{ itemCount(selected) }} item</span>
          <span class="tabular text-2xl font-bold">{{ formatRp(selected.grand_total) }}</span>
        </div>

        <div class="grid gap-2.5">
          <Button class="h-13 rounded-xl text-base font-semibold" :disabled="returning" @click="returnNumber">
            <Undo2 class="size-5" /> {{ returning ? "Menyimpan..." : "Kembalikan nomor" }}
          </Button>
          <Button
            v-if="selected.bill_status !== 'paid'"
            variant="secondary"
            class="h-12 rounded-xl text-base"
            @click="openInKasir"
          >
            Bayar pesanan ini
          </Button>
          <p class="text-center text-sm text-muted-foreground">
            Tekan saat pelanggan mengembalikan pager. Nomor langsung bisa dipakai lagi.
          </p>
        </div>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      title="Ganti pesanan di kasir?"
      description="Pesanan yang sedang dibuat belum disimpan dan akan dibuang."
      confirm-label="Buang & lanjutkan"
      @confirm="proceed"
    />
  </div>
</template>
