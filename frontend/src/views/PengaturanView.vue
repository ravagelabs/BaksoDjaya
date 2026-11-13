<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { UsersRound, UtensilsCrossed } from "@lucide/vue";
import { ChevronRight, Pencil, Plus, Search } from "@lucide/vue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ProductFormDialog from "@/components/ProductFormDialog.vue";
import { api } from "@/lib/api";
import { formatRp, number, dateTime, splitName, titleCase, OUTLET_NAME, OUTLET_BRANCH, paymentRows } from "@/lib/format";
import MenuImage from "@/components/MenuImage.vue";
import AccountsSection from "@/components/AccountsSection.vue";
import { useCatalogStore } from "@/stores/catalog";
import { useUiStore } from "@/stores/ui";

const catalog = useCatalogStore();
const ui = useUiStore();
const route = useRoute();
const router = useRouter();

// Bagian pengaturan, diingat di URL (?bagian=akun) supaya bisa dibuka langsung
const SECTIONS = [
  { key: "menu", short: "Menu", label: "Menu", hint: "Harga, foto, stok", icon: UtensilsCrossed },
  { key: "akun", short: "Akun", label: "Akun pengguna", hint: "Akun utama & admin", icon: UsersRound },
];
const section = ref(SECTIONS.some((x) => x.key === route.query.bagian) ? route.query.bagian : "menu");
watch(section, (v) => router.replace({ query: { ...route.query, bagian: v === "menu" ? undefined : v } }));

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
    return !q || p.name.toLowerCase().includes(q) || (p.variant_group ?? "").toLowerCase().includes(q);
  });
});

// Kombinasi paket dan menu gabungan tampil sebagai satu kartu (sama seperti di Kasir).
// Ketuk kartu -> daftar isinya, masing-masing bisa diubah atau di-set stok habis.
const groupKey = (p) => (p.name.startsWith("PAKET ") ? p.name.split(" - ")[0] : p.variant_group || null);

const cards = computed(() => {
  const out = [];
  const groups = new Map();
  for (const p of visible.value) {
    const key = groupKey(p);
    if (!key) {
      out.push({ single: true, key: `p${p.id}`, product: p });
      continue;
    }
    let g = groups.get(key);
    if (!g) {
      const grid = catalog.gridProducts.find((x) => (x.isPaket || x.isVariant) && x.name === key);
      g = { single: false, key: `g:${key}`, name: key, picture: grid?.picture ?? p.picture, category: p.category, items: [] };
      groups.set(key, g);
      out.push(g);
    }
    g.items.push(p);
  }
  return out;
});

const priceRange = (items) => {
  const prices = items.map((i) => i.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? formatRp(lo) : `${formatRp(lo)} – ${number.format(hi)}`;
};
const availableCount = (items) => items.filter((i) => i.is_available).length;

// Nama di daftar isi grup: "PAKET SIJI - BAKSO URAT + MIE" -> "Bakso Urat + Mie"
const memberName = (g, p) => {
  const { title, detail } = splitName(p.name);
  if (detail) return detail;
  const prefix = g.name.toUpperCase() + " ";
  return titleCase(p.name.toUpperCase().startsWith(prefix) ? p.name.slice(prefix.length) : title);
};

const openGroupKey = ref(null);
const openGroup = computed(() => cards.value.find((c) => c.key === openGroupKey.value) ?? null);

async function setGroupAvailable(g, value) {
  for (const p of g.items) if (p.is_available !== value) await toggleAvailable(p);
}

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

onMounted(() => catalog.load(true));

</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain px-6 py-5">
    <div class="flex flex-wrap items-baseline gap-3">
      <h1 class="text-2xl font-bold leading-tight">Pengaturan</h1>
      <p class="text-sm text-muted-foreground">{{ OUTLET_NAME }} · {{ OUTLET_BRANCH }}</p>
    </div>

    <!-- Pilih bagian pengaturan -->
    <nav class="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5 md:max-w-lg" aria-label="Bagian pengaturan">
      <button
        v-for="sct in SECTIONS"
        :key="sct.key"
        type="button"
        class="flex min-h-14 items-center justify-center gap-2.5 rounded-xl px-2 text-left transition md:justify-start md:px-4"
        :class="section === sct.key ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground'"
        :aria-current="section === sct.key ? 'page' : undefined"
        @click="section = sct.key"
      >
        <component :is="sct.icon" class="size-5 shrink-0" />
        <span class="min-w-0">
          <span class="block truncate text-[15px] font-semibold"><span class="md:hidden">{{ sct.short }}</span><span class="hidden md:inline">{{ sct.label }}</span></span>
          <span class="hidden truncate text-xs text-muted-foreground md:block">{{ sct.hint }}</span>
        </span>
      </button>
    </nav>

    <!-- Menu -->
    <section v-if="section === 'menu'" class="mt-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold">Menu</h2>
          <p class="text-sm text-muted-foreground">
            {{ cards.length }} menu · Ketuk kartu untuk mengubah. HPP dipakai untuk estimasi di Laporan.
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

        <template v-for="c in cards" :key="c.key">
        <!-- Grup: paket atau menu gabungan -->
        <article
          v-if="!c.single"
          class="group flex flex-col overflow-hidden rounded-[18px] border bg-card p-2.5 transition hover:border-primary/30 hover:shadow-card"
        >
          <button type="button" class="flex flex-1 flex-col rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40" @click="openGroupKey = c.key">
            <div class="relative overflow-hidden rounded-xl bg-[#f6efe7]">
              <MenuImage :src="c.picture" :name="titleCase(c.name)" :class="availableCount(c.items) ? '' : 'opacity-50 grayscale'" />
              <span class="absolute top-2 left-2 rounded-full bg-card px-2.5 py-1 text-xs font-semibold shadow-xs">
                {{ c.items.length }} pilihan
              </span>
            </div>
            <p class="mt-3 px-1.5 text-[17px] font-semibold leading-snug">{{ titleCase(c.name) }}</p>
            <p class="mt-1 px-1.5 text-sm text-muted-foreground">{{ c.category || "Tanpa kategori" }}</p>
            <div class="tabular mt-2 flex items-baseline justify-between px-1.5">
              <span class="text-[15px] font-semibold">{{ priceRange(c.items) }}</span>
            </div>
          </button>
          <button
            type="button"
            class="mt-3 flex items-center justify-between border-t px-1.5 pt-2.5 text-sm"
            @click="openGroupKey = c.key"
          >
            <span :class="availableCount(c.items) ? 'text-foreground' : 'text-muted-foreground'">
              {{ availableCount(c.items) }} dari {{ c.items.length }} tersedia
            </span>
            <span class="flex items-center gap-1 font-semibold">Lihat isi <ChevronRight class="size-4" /></span>
          </button>
        </article>

        <template v-else>
        <article
          v-for="p in [c.product]"
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
        </template>
        </template>
      </div>
      <p v-if="!catalog.loading && catalog.products.length && !visible.length" class="mt-4 text-[15px] text-muted-foreground">
        Menu tidak ditemukan.
      </p>
    </section>

    <!-- Riwayat shift pindah ke menu Shift -->

    <AccountsSection v-if="section === 'akun'" />

    <!-- Isi grup -->
    <Dialog :open="Boolean(openGroup)" @update:open="!$event && (openGroupKey = null)">
      <DialogContent v-if="openGroup" class="max-h-[88dvh] overflow-y-auto overscroll-contain p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle class="text-xl font-bold">{{ titleCase(openGroup.name) }}</DialogTitle>
          <DialogDescription class="text-[15px]">
            {{ openGroup.items.length }} pilihan · Ketuk untuk mengubah harga, HPP, atau foto.
          </DialogDescription>
        </DialogHeader>
        <div class="flex gap-2">
          <Button variant="secondary" class="h-10 flex-1 rounded-xl text-sm" @click="setGroupAvailable(openGroup, true)">Semua tersedia</Button>
          <Button variant="secondary" class="h-10 flex-1 rounded-xl text-sm" @click="setGroupAvailable(openGroup, false)">Semua stok habis</Button>
        </div>
        <ul class="flex flex-col divide-y rounded-xl border">
          <li v-for="p in openGroup.items" :key="p.id" class="flex items-center gap-3 px-3 py-2.5">
            <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="openEdit(p)">
              <span class="size-14 shrink-0 overflow-hidden rounded-lg bg-[#f6efe7]">
                <MenuImage :src="p.picture" :name="memberName(openGroup, p)" :class="p.is_available ? '' : 'opacity-50 grayscale'" />
              </span>
              <span class="min-w-0">
                <span class="block truncate text-[15px] font-semibold">{{ memberName(openGroup, p) }}</span>
                <span class="tabular block text-sm text-muted-foreground">
                  {{ formatRp(p.price) }} · HPP {{ number.format(p.hpp ?? 0) }}
                </span>
              </span>
              <Pencil class="ml-auto size-4 shrink-0 text-muted-foreground" />
            </button>
            <button
              type="button"
              role="switch"
              :aria-checked="p.is_available"
              :aria-label="`${memberName(openGroup, p)} tersedia`"
              class="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
              :class="p.is_available ? 'bg-primary' : 'bg-[#d6d3ce]'"
              :disabled="savingId === p.id"
              @click="toggleAvailable(p)"
            >
              <span class="inline-block size-6 rounded-full bg-white shadow transition-transform" :class="p.is_available ? 'translate-x-7' : 'translate-x-1'" />
            </button>
          </li>
        </ul>
      </DialogContent>
    </Dialog>

    <ProductFormDialog v-model:open="showForm" :product="editing" />
  </div>
</template>
