<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Volume2, VolumeX } from "@lucide/vue";
import { useLive, unlockSound, soundReady, chime } from "@/lib/live";
import { api } from "@/lib/api";
import { minutesSince, orderNo, orderTypeLabel, splitName, optionsText } from "@/lib/format";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();

const bills = ref([]);
const loading = ref(true);
const online = ref(true);
const now = ref(Date.now());
const busy = ref(null); // id bill yang sedang diperbarui
const fresh = ref(new Set()); // pesanan yang baru masuk, disorot beberapa detik
const soundOn = ref(false);

// Ketukan pertama di halaman mengaktifkan suara (aturan browser, terutama Safari iPad)
function enableSound() {
  unlockSound();
  setTimeout(() => (soundOn.value = soundReady()), 50);
}

function highlight(id) {
  fresh.value = new Set(fresh.value).add(id);
  setTimeout(() => {
    const next = new Set(fresh.value);
    next.delete(id);
    fresh.value = next;
  }, 6000);
}

// Update realtime dari backend: pesanan baru langsung muncul tanpa menunggu polling
const { connected } = useLive(async (type, data) => {
  await load();
  if (type === "kitchen:new") {
    if (data.billId) highlight(data.billId);
    if (soundOn.value) chime();
    const b = bills.value.find((x) => x.billId === data.billId);
    ui.toast(b ? `Pesanan baru: ${label(b)}` : "Pesanan baru masuk");
  }
});

const COLUMNS = [
  { key: "new", title: "Baru", action: "Mulai masak", next: "cooking", time: "text-primary", primary: true },
  { key: "cooking", title: "Dimasak", action: "Tandai siap", next: "ready", time: "text-[#8a5a12]", primary: true },
  { key: "ready", title: "Siap saji", action: "Sudah disajikan", next: "served", time: "text-success", primary: false },
];

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
  }, 10000);
});
onUnmounted(() => clearInterval(timer));

const byStatus = computed(() => {
  const groups = { new: [], cooking: [], ready: [] };
  for (const b of bills.value) groups[b.kitchen_status]?.push(b);
  return groups;
});

const label = (b) => (b.table_code ? `Meja ${b.table_code}` : `${orderTypeLabel(b.order_type)} ${orderNo(b.billId)}`);

// Catatan pelanggan: catatan pesanan + catatan per item
function notes(b) {
  const list = [];
  if (b.note) list.push(b.note);
  for (const i of b.billItems) if (i.note) list.push(`${splitName(i.name).title}: ${i.note}`);
  return list;
}

function itemDetail(i) {
  return [splitName(i.name).detail, optionsText(i.options)].filter(Boolean).join(" · ");
}

async function advance(b, next) {
  busy.value = b.billId;
  try {
    await api(`/bills/${b.billId}/kitchen`, { method: "PATCH", body: { kitchenStatus: next } });
    b.kitchen_status = next; // langsung pindah kolom, sinkron lagi di polling berikutnya
    if (next === "served") bills.value = bills.value.filter((x) => x.billId !== b.billId);
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-8 py-7">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-[32px] font-bold leading-tight">Antrean dapur</h1>
        <p class="mt-1 text-[15px] text-muted-foreground">
          {{ bills.length }} pesanan aktif · Urutan berdasarkan waktu masuk
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors"
          :class="soundOn ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'"
          :aria-pressed="soundOn"
          @click="soundOn ? (soundOn = false) : enableSound()"
        >
          <Volume2 v-if="soundOn" class="size-4" />
          <VolumeX v-else class="size-4" />
          {{ soundOn ? "Suara aktif" : "Aktifkan suara" }}
        </button>
        <span
          class="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold"
          :class="connected && online ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'"
          role="status"
        >
          <span class="size-2 rounded-full" :class="connected && online ? 'animate-pulse bg-success' : 'bg-warning'" />
          {{ connected && online ? "Live" : online ? "Menyambung ulang..." : "Belum sinkron" }}
        </span>
      </div>
    </div>

    <p v-if="loading" class="mt-8 text-[15px] text-muted-foreground">Memuat antrean...</p>
    <div v-else class="mt-8 grid gap-8 lg:grid-cols-3">
      <section v-for="col in COLUMNS" :key="col.key">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-semibold">{{ col.title }}</h2>
          <span class="tabular rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-primary">
            {{ byStatus[col.key].length }} pesanan
          </span>
        </div>

        <p v-if="!byStatus[col.key].length" class="mt-5 rounded-[20px] border border-dashed px-6 py-10 text-center text-[15px] text-muted-foreground">
          Kosong
        </p>

        <article
          v-for="b in byStatus[col.key]"
          :key="b.billId"
          class="mt-5 rounded-[20px] border bg-[#fbfbfd] p-6 transition-shadow duration-500"
          :class="fresh.has(b.billId) ? 'border-primary shadow-[0_0_0_4px_rgba(101,54,181,0.18)]' : ''"
        >
          <header class="flex items-baseline justify-between">
            <h3 class="flex items-center gap-2 text-2xl font-semibold">
              {{ label(b) }}
              <span v-if="fresh.has(b.billId)" class="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Baru</span>
            </h3>
            <span class="tabular text-[15px] font-medium" :class="col.time">{{ minutesSince(b.sent_to_kitchen_at, now) }} menit</span>
          </header>

          <ul class="mt-4 flex flex-col gap-2">
            <li v-for="i in b.billItems" :key="i.id">
              <p class="text-xl" :class="i === b.billItems[0] ? 'font-semibold' : ''">
                <span class="tabular mr-2">{{ i.qty }}x</span>{{ splitName(i.name).title }}
              </p>
              <p v-if="itemDetail(i)" class="ml-9 text-[15px] text-muted-foreground">{{ itemDetail(i) }}</p>
            </li>
          </ul>

          <p
            v-for="(n, idx) in notes(b)"
            :key="idx"
            class="mt-3 rounded-xl bg-warning-soft px-4 py-2.5 text-[15px] font-semibold text-warning"
          >
            Catatan: {{ n }}
          </p>

          <button
            type="button"
            class="mt-4 h-14 w-full rounded-xl px-7 text-left text-lg font-semibold transition-colors disabled:opacity-60"
            :class="col.primary ? 'bg-cta text-cta-foreground hover:bg-cta-hover' : 'bg-muted text-foreground hover:bg-[#e9e9ec]'"
            :disabled="busy === b.billId"
            @click="advance(b, col.next)"
          >
            {{ busy === b.billId ? "Menyimpan..." : col.action }}
          </button>
        </article>
      </section>
    </div>
  </div>
</template>
