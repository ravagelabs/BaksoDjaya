<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { X } from "@lucide/vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { useLive } from "@/lib/live";
import { api } from "@/lib/api";
import { minutesSince, orderNo, orderTypeLabel, splitName, optionsText } from "@/lib/format";
import { useUiStore } from "@/stores/ui";

// Dapur tanpa tombol: pesanan otomatis dianggap selesai begitu struk jadi.
// Halaman ini hanya daftar pesanan masuk 3 jam terakhir (terbaru di atas) untuk dilihat dapur.
const ui = useUiStore();
const isOwner = computed(() => ui.user?.role === "owner"); // hanya akun utama yang bisa batalkan pesanan

const bills = ref([]);
const loading = ref(true);
const online = ref(true);
const now = ref(Date.now());
const busy = ref(null);
const fresh = ref(new Set()); // pesanan yang baru masuk, disorot beberapa detik

function highlight(id) {
  fresh.value = new Set(fresh.value).add(id);
  setTimeout(() => {
    const next = new Set(fresh.value);
    next.delete(id);
    fresh.value = next;
  }, 8000);
}

const { connected } = useLive(async (type, data) => {
  await load();
  if (type === "kitchen:new" && data.billId) highlight(data.billId);
});

async function load() {
  try {
    bills.value = (await api("/bills/kitchen")).data;
    online.value = true;
  } catch {
    online.value = false;
  } finally {
    loading.value = false;
  }
}

let timer;
onMounted(() => {
  load();
  timer = setInterval(() => {
    now.value = Date.now();
    load();
  }, 15000);
});
onUnmounted(() => clearInterval(timer));

const label = (b) => (b.table_code ? `No. ${b.table_code}` : `${orderTypeLabel(b.order_type)} ${orderNo(b.billId)}`);
const clock = (t) => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(t));

function notes(b) {
  const list = [];
  if (b.note) list.push(b.note);
  for (const i of b.billItems) if (i.note) list.push(`${splitName(i.name).title}: ${i.note}`);
  return list;
}
function itemDetail(i) {
  return [splitName(i.name).detail, optionsText(i.options)].filter(Boolean).join(" · ");
}

// ---- Batalkan pesanan (hanya akun utama) ----
const cancelTarget = ref(null);
async function cancelOrder() {
  const b = cancelTarget.value;
  cancelTarget.value = null;
  if (!b) return;
  busy.value = b.billId;
  try {
    await api(`/bills/${b.billId}`, { method: "DELETE" });
    bills.value = bills.value.filter((x) => x.billId !== b.billId);
    ui.toast(`Pesanan ${orderNo(b.billId)} dibatalkan`);
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-5 py-6 md:px-8 md:py-7">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-[28px] font-bold leading-tight md:text-[32px]">Pesanan masuk</h1>
        <p class="mt-1 text-[15px] text-muted-foreground">3 jam terakhir · terbaru di atas · tidak perlu ditekan apa-apa</p>
      </div>
      <span
        class="flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold"
        :class="connected && online ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'"
        role="status"
      >
        <span class="size-2 rounded-full" :class="connected && online ? 'animate-pulse bg-success' : 'bg-warning'" />
        {{ connected && online ? "Live" : online ? "Menyambung ulang..." : "Belum sinkron" }}
      </span>
    </div>

    <p v-if="loading" class="mt-8 text-[15px] text-muted-foreground">Memuat...</p>
    <p v-else-if="!bills.length" class="mt-8 rounded-[20px] border border-dashed px-6 py-12 text-center text-[15px] text-muted-foreground">
      Belum ada pesanan dalam 3 jam terakhir.
    </p>
    <div v-else class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="b in bills"
        :key="b.billId"
        class="rounded-[20px] border bg-[#fbfaf8] p-5 transition-shadow duration-500"
        :class="fresh.has(b.billId) ? 'border-cta shadow-[0_0_0_4px_rgb(217_72_15/0.16)]' : ''"
      >
        <header class="flex items-baseline justify-between gap-3">
          <h3 class="flex items-center gap-2 text-xl font-semibold" :class="!b.table_code && b.order_type === 'pickup' ? 'text-cta' : ''">
            {{ label(b) }}
            <span v-if="fresh.has(b.billId)" class="rounded-full bg-cta px-2 py-0.5 text-xs font-semibold text-cta-foreground">Baru</span>
          </h3>
          <span class="tabular shrink-0 text-sm text-muted-foreground">
            {{ clock(b.sent_to_kitchen_at) }} · {{ minutesSince(b.sent_to_kitchen_at, now) }} menit
          </span>
        </header>
        <p v-if="b.table_code" class="mt-0.5 text-sm font-semibold" :class="b.order_type === 'pickup' ? 'text-cta' : 'text-muted-foreground'">
          {{ orderTypeLabel(b.order_type) }} · Pesanan {{ orderNo(b.billId) }}
        </p>

        <ul class="mt-3 flex flex-col gap-1.5">
          <li v-for="i in b.billItems" :key="i.id">
            <p class="text-lg font-semibold"><span class="tabular mr-2">{{ i.qty }}x</span>{{ splitName(i.name).title }}</p>
            <p v-if="itemDetail(i)" class="ml-8 text-[15px] text-muted-foreground">{{ itemDetail(i) }}</p>
          </li>
        </ul>

        <p v-for="(n, idx) in notes(b)" :key="idx" class="mt-3 rounded-xl bg-warning-soft px-4 py-2.5 text-[15px] font-semibold text-warning">
          Catatan: {{ n }}
        </p>

        <button
          v-if="isOwner"
          type="button"
          class="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          :disabled="busy === b.billId"
          @click="cancelTarget = b"
        >
          <X class="size-4" /> Batalkan pesanan
        </button>
      </article>
    </div>

    <ConfirmDialog
      :open="Boolean(cancelTarget)"
      :title="cancelTarget ? `Batalkan ${label(cancelTarget)}?` : ''"
      :description="cancelTarget ? `Pesanan ${orderNo(cancelTarget.billId)} tidak dihitung di penjualan. Nomor pager langsung tersedia lagi. Kalau sudah dibayar, kembalikan uang pelanggan.` : ''"
      confirm-label="Batalkan pesanan"
      @update:open="!$event && (cancelTarget = null)"
      @confirm="cancelOrder"
    />
  </div>
</template>
