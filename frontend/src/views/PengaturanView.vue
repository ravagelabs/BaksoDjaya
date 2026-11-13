<script setup>
import { ref, computed, onMounted } from "vue";
import { Pencil, Plus, Search } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import ProductFormDialog from "@/components/ProductFormDialog.vue";
import { api } from "@/lib/api";
import { formatRp, number, dateTime, splitName, OUTLET_NAME, OUTLET_BRANCH, paymentRows } from "@/lib/format";
import MenuImage from "@/components/MenuImage.vue";
import AccountsSection from "@/components/AccountsSection.vue";
import { useCatalogStore } from "@/stores/catalog";
import { useUiStore } from "@/stores/ui";

const catalog = useCatalogStore();
const ui = useUiStore();

// ---- Menu ----
const query = ref("");
const category = ref("Semua");

const categories = computed(() => {
  const list = [];
  for (const p of catalog.products) {
    const c = p.category || "Lainnya";
    if (!list.includes(c)) list.push(c);
  }
  return list;
});

const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return catalog.products.filter((p) => {
    if (category.value !== "Semua" && (p.category || "Lainnya") !== category.value) return false;
    return !q || p.name.toLowerCase().includes(q);
  });
});

const showForm = ref(false);
const editing = ref(null);

function openNew() {
  editing.value = null;
  showForm.value = true;
}

function openEdit(p) {
  editing.value = p;
  showForm.value = true;
}

const savingId = ref(null);
async function toggleAvailable(p) {
  savingId.value = p.id;
  try {
    const json = await api(`/products/${p.id}`, { method: "PATCH", body: { is_available: !p.is_available } });
    catalog.upsert(json.data);
  } catch (e) {
    ui.toast(e.message, "error");
  } finally {
    savingId.value = null;
  }
}

const marginPct = (p) => (p.price ? Math.round(((p.price - (p.hpp ?? 0)) / p.price) * 100) : 0);

// ---- Riwayat shift ----
const shifts = ref([]);
const shiftsLoading = ref(true);
const shiftsError = ref("");

onMounted(async () => {
  catalog.load(true);
  try {
    shifts.value = (await api("/shifts")).data;
  } catch (e) {
    shiftsError.value = e.message;
  } finally {
    shiftsLoading.value = false;
  }
});

function duration(from, to) {
  const m = Math.max(0, Math.floor((new Date(to) - new Date(from)) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} jam ${m % 60} menit` : `${m} menit`;
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-6 py-5">
    <div class="flex flex-wrap items-baseline gap-3">
      <h1 class="text-2xl font-bold leading-tight">Pengaturan</h1>
      <p class="text-sm text-muted-foreground">{{ OUTLET_NAME }} · {{ OUTLET_BRANCH }}</p>
    </div>

    <!-- Menu -->
    <section class="mt-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold">Menu</h2>
          <p class="text-sm text-muted-foreground">
            {{ catalog.products.length }} menu · Ketuk kartu untuk mengubah. HPP dipakai untuk estimasi di Laporan.
          </p>
        </div>
        <Button class="h-12 rounded-xl px-5 text-base" @click="openNew"><Plus /> Tambah menu</Button>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <label class="relative block min-w-56 flex-1 basis-72">
          <span class="sr-only">Cari menu</span>
          <Search class="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="query"
            type="search"
            placeholder="Cari menu..."
            class="h-12 w-full rounded-xl bg-muted pr-4 pl-11 text-base outline-none placeholder:text-muted-foreground focus:ring-3 focus:ring-ring/20"
          />
        </label>
        <div class="flex gap-2 overflow-x-auto" role="tablist" aria-label="Kategori">
          <button
            v-for="c in ['Semua', ...categories]"
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

      <p v-if="catalog.loading && !catalog.products.length" class="mt-6 text-[15px] text-muted-foreground">Memuat menu...</p>
      <p v-else-if="catalog.error" class="mt-6 text-[15px] text-destructive">{{ catalog.error }}</p>

      <div v-else class="mt-5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
        <!-- Kartu tambah -->
        <button
          type="button"
          class="flex min-h-72 flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-dashed border-primary/30 text-primary transition-colors hover:border-primary/60 hover:bg-secondary/50"
          @click="openNew"
        >
          <span class="flex size-12 items-center justify-center rounded-full bg-secondary"><Plus class="size-6" /></span>
          <span class="text-base font-semibold">Tambah menu</span>
        </button>

        <article
          v-for="p in visible"
          :key="p.id"
          class="group flex flex-col overflow-hidden rounded-[18px] border bg-card p-2.5 transition hover:border-primary/30 hover:shadow-card"
        >
          <button type="button" class="flex flex-1 flex-col rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40" @click="openEdit(p)">
            <div class="relative overflow-hidden rounded-xl bg-[#f6efe7]">
              <MenuImage
                :src="p.picture"
                :name="splitName(p.name).title"
                :class="p.is_available ? '' : 'opacity-50 grayscale'"
              />
              <span
                v-if="!p.is_available"
                class="absolute top-2 left-2 rounded-full bg-card px-2.5 py-1 text-xs font-semibold shadow-xs"
              >
                Stok habis
              </span>
              <span class="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-card/90 text-muted-foreground opacity-0 shadow-xs transition group-hover:opacity-100">
                <Pencil class="size-4" />
              </span>
            </div>
            <p class="mt-3 px-1.5 text-[17px] font-semibold leading-snug">{{ splitName(p.name).title }}</p>
            <p v-if="splitName(p.name).detail" class="px-1.5 text-sm text-muted-foreground">{{ splitName(p.name).detail }}</p>
            <p class="mt-1 px-1.5 text-sm text-muted-foreground">{{ p.category || "Tanpa kategori" }}</p>
            <div class="tabular mt-2 flex items-baseline justify-between px-1.5">
              <span class="text-[15px] font-semibold">{{ formatRp(p.price) }}</span>
              <span class="text-xs text-muted-foreground">HPP {{ number.format(p.hpp ?? 0) }} · {{ marginPct(p) }}%</span>
            </div>
          </button>

          <div class="mt-3 flex items-center justify-between border-t px-1.5 pt-2.5">
            <span class="text-sm" :class="p.is_available ? 'text-foreground' : 'text-muted-foreground'">
              {{ p.is_available ? "Tersedia" : "Stok habis" }}
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="p.is_available"
              :aria-label="`${splitName(p.name).title} tersedia`"
              class="relative inline-flex h-8 w-14 items-center rounded-full transition-colors disabled:opacity-50"
              :class="p.is_available ? 'bg-primary' : 'bg-[#d6d3ce]'"
              :disabled="savingId === p.id"
              @click="toggleAvailable(p)"
            >
              <span class="inline-block size-6 rounded-full bg-white shadow transition-transform" :class="p.is_available ? 'translate-x-7' : 'translate-x-1'" />
            </button>
          </div>
        </article>
      </div>
      <p v-if="!catalog.loading && catalog.products.length && !visible.length" class="mt-4 text-[15px] text-muted-foreground">
        Menu tidak ditemukan.
      </p>
    </section>

    <!-- Riwayat shift -->
    <section class="mt-10 rounded-[20px] bg-muted/50 p-6">
      <h2 class="text-xl font-semibold">Riwayat shift</h2>
      <p class="text-sm text-muted-foreground">10 shift terakhir dan penjualannya.</p>
      <p v-if="shiftsLoading" class="mt-4 text-[15px] text-muted-foreground">Memuat shift...</p>
      <p v-else-if="shiftsError" class="mt-4 text-[15px] text-destructive">{{ shiftsError }}</p>
      <p v-else-if="!shifts.length" class="mt-4 text-[15px] text-muted-foreground">Belum ada shift tersimpan.</p>
      <ul v-else class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <li v-for="s in shifts" :key="s.id" class="rounded-xl bg-card p-5">
          <div class="flex items-baseline justify-between">
            <span class="text-lg font-semibold">Shift #{{ s.id }}</span>
            <span class="text-sm text-muted-foreground">{{ duration(s.created_at, s.ended_at) }}</span>
          </div>
          <p class="text-sm text-muted-foreground">{{ dateTime(s.created_at) }} – {{ dateTime(s.ended_at) }}</p>
          <dl class="tabular mt-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
            <div v-for="r in paymentRows(s)" :key="r.key"><dt class="text-muted-foreground">{{ r.label }}</dt><dd>{{ number.format(r.value) }}</dd></div>
            <div><dt class="text-muted-foreground">Total</dt><dd class="font-semibold">{{ number.format(s.total) }}</dd></div>
          </dl>
        </li>
      </ul>
    </section>

    <AccountsSection />

    <ProductFormDialog v-model:open="showForm" :product="editing" />
  </div>
</template>
