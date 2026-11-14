<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Store, UsersRound, UtensilsCrossed } from "@lucide/vue";
import OutletSection from "@/components/OutletSection.vue";
import ResetSection from "@/components/ResetSection.vue";
import { ChevronDown, ChevronRight, Pencil, Plus, Search } from "@lucide/vue";
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
  { key: "toko", short: "Toko", label: "Toko & logo", hint: "Logo di aplikasi & struk", icon: Store },
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

// Daftar sederhana: grup jadi judul kecil, isinya baris biasa. Harga & HPP diisi langsung di baris.
// Grup (paket / menu gabungan) tampil SATU baris. Kalau semua pilihan yang dijual harganya sama,
// harga & HPP cukup diisi sekali di baris itu (berlaku ke semua pilihan). Kalau beda, pilihannya tampil di bawahnya.
const expanded = ref(new Set());
function toggleExpand(key) {
  const s = new Set(expanded.value);
  s.has(key) ? s.delete(key) : s.add(key);
  expanded.value = s;
}
const rows = computed(() => {
  const out = [];
  for (const c of cards.value) {
    if (c.single) {
      out.push({ kind: "item", key: c.key, p: c.product, name: splitName(c.product.name).title, sub: splitName(c.product.name).detail || c.product.category || "" });
      continue;
    }
    const avail = c.items.filter((i) => i.is_available);
    const base = avail.length ? avail : c.items;
    const uniform = base.every((i) => i.price === base[0].price && (i.hpp ?? 0) === (base[0].hpp ?? 0));
    const open = expanded.value.has(c.key) || !uniform;
    out.push({
      kind: "group",
      key: c.key,
      items: c.items,
      base,
      uniform,
      open,
      name: titleCase(c.name),
      sub: !avail.length
        ? "Semua stok habis"
        : c.name.startsWith("PAKET ")
          ? `${avail.length} pilihan dijual · harga & HPP berlaku untuk semua`
          : avail.map((i) => memberName(c, i)).join(", "),
      p: { id: c.key, picture: c.picture, price: base[0].price, hpp: base[0].hpp ?? 0, is_available: avail.length > 0 },
      availCount: avail.length,
    });
    if (open) for (const p of c.items) out.push({ kind: "item", key: `p${p.id}`, p, name: memberName(c, p), sub: "", member: true });
  }
  return out;
});

// Simpan harga / HPP grup ke semua pilihannya sekaligus
async function saveGroupMoney(r, field, e) {
  const value = Number(String(e.target.value).replace(/\D/g, "")) || 0;
  e.target.value = field === "hpp" && !value ? "" : rpInput(value);
  if (value === Number(r.p[field] ?? 0) && r.items.every((i) => Number(i[field] ?? 0) === value)) return;
  if (field === "price" && value <= 0) {
    e.target.value = rpInput(r.p.price);
    return ui.toast("Harga harus lebih dari 0", "error");
  }
  savingId.value = r.key;
  try {
    for (const i of r.items) {
      if (Number(i[field] ?? 0) === value) continue;
      const json = await api(`/products/${i.id}`, { method: "PATCH", body: { [field]: value } });
      catalog.upsert(json.data);
    }
    ui.toast(`${field === "hpp" ? "HPP" : "Harga"} ${r.name} disimpan`);
  } catch (err) {
    ui.toast(err.message, "error");
  } finally {
    savingId.value = null;
  }
}

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

// Dari tombol + di header: ?aksi=tambah langsung membuka form
watch(
  () => route.query.aksi,
  (aksi) => {
    if (aksi !== "tambah") return;
    if (route.query.bagian === "akun") section.value = "akun"; // form akun dibuka oleh AccountsSection
    else {
      section.value = "menu";
      openNew();
      router.replace({ query: { ...route.query, aksi: undefined } });
    }
  },
  { immediate: true }
);

function openEdit(p) {
  editing.value = p;
  showForm.value = true;
}

// Dari daftar isi grup: tutup daftar dulu supaya form tidak ketiban, baru buka form lengkap (foto/nama)
function openEditFromGroup(p) {
  openGroupKey.value = null;
  setTimeout(() => openEdit(p), 180);
}

// Ubah harga / HPP langsung di daftar (simpan otomatis waktu selesai mengetik)
const rpInput = (v) => number.format(Number(String(v ?? "").replace(/\D/g, "")) || 0);
async function saveMoney(p, field, e) {
  const value = Number(String(e.target.value).replace(/\D/g, "")) || 0;
  e.target.value = field === "hpp" && !value ? "" : rpInput(value);
  if (value === Number(p[field] ?? 0)) return;
  if (field === "price" && value <= 0) {
    e.target.value = rpInput(p.price);
    return ui.toast("Harga harus lebih dari 0", "error");
  }
  savingId.value = p.id;
  try {
    const json = await api(`/products/${p.id}`, { method: "PATCH", body: { [field]: value } });
    catalog.upsert(json.data);
    ui.toast(field === "hpp" ? "HPP disimpan" : "Harga disimpan");
  } catch (err) {
    e.target.value = rpInput(p[field]);
    ui.toast(err.message, "error");
  } finally {
    savingId.value = null;
  }
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
    <nav class="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1.5 md:max-w-2xl" aria-label="Bagian pengaturan">
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
            Ketik harga dan HPP langsung di daftar, tersimpan otomatis.
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

      <div v-else class="mt-5 overflow-hidden rounded-2xl border bg-card">
        <!-- Judul kolom (layar lebar) -->
        <div class="hidden grid-cols-[minmax(0,1fr)_150px_150px_120px_64px_44px] items-center gap-3 border-b bg-muted/50 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
          <span>Menu</span><span class="text-right">Harga jual</span><span class="text-right">HPP (modal)</span><span class="text-right">Untung</span><span class="text-center">Ada</span><span></span>
        </div>
        <template v-for="r in rows" :key="r.key">
          <!-- Baris menu -->
          <div
            class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_150px_150px_120px_64px_44px]"
            :class="[r.p.is_available ? '' : 'bg-muted/40', r.member ? 'bg-muted/25' : '']"
          >
            <button
              type="button"
              class="flex min-w-0 items-center gap-3 text-left"
              :class="r.member ? 'pl-6 md:pl-8' : ''"
              :title="r.kind === 'group' ? 'Lihat pilihan' : 'Ubah foto / nama'"
              @click="r.kind === 'group' ? toggleExpand(r.key) : openEdit(r.p)"
            >
              <span v-if="!r.member" class="size-11 shrink-0 overflow-hidden rounded-lg bg-[#f6efe7]">
                <MenuImage :src="r.p.picture" :name="r.name" :class="r.p.is_available ? '' : 'opacity-50 grayscale'" />
              </span>
              <span class="min-w-0">
                <span class="block truncate text-[15px] font-semibold" :class="r.p.is_available ? '' : 'text-muted-foreground'">{{ r.name }}</span>
                <span v-if="r.kind === 'group' || r.sub || !r.p.is_available" class="block truncate text-xs text-muted-foreground">
                  {{ r.kind === "group" ? r.sub : r.p.is_available ? r.sub : "Stok habis" }}
                </span>
              </span>
            </button>
            <!-- HP: tombol tersedia di kanan nama (grup: buka/tutup pilihan) -->
            <button
              v-if="r.kind === 'group'"
              type="button"
              class="flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-sm font-semibold md:hidden"
              :aria-expanded="r.open"
              @click="toggleExpand(r.key)"
            >
              {{ r.availCount }}/{{ r.items.length }} <ChevronDown class="size-4 transition-transform" :class="r.open ? 'rotate-180' : ''" />
            </button>
            <button
              v-else
              type="button"
              role="switch"
              :aria-checked="r.p.is_available"
              :aria-label="`${r.name} tersedia`"
              class="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 md:hidden"
              :class="r.p.is_available ? 'bg-primary' : 'bg-[#d6d3ce]'"
              :disabled="savingId === r.p.id"
              @click="toggleAvailable(r.p)"
            >
              <span class="inline-block size-6 rounded-full bg-white shadow transition-transform" :class="r.p.is_available ? 'translate-x-7' : 'translate-x-1'" />
            </button>
            <div v-if="r.kind === 'group' && !r.uniform" class="col-span-2 text-sm text-muted-foreground md:col-span-3 md:text-right">
              Harga beda per pilihan, isi di bawah
            </div>
            <div v-else class="col-span-2 grid grid-cols-2 gap-2 md:contents">
              <label class="flex h-11 items-center gap-2 rounded-xl bg-muted px-3 focus-within:ring-2 focus-within:ring-ring/40">
                <span class="text-xs font-semibold text-muted-foreground md:hidden">Harga</span>
                <span class="hidden text-sm text-muted-foreground md:inline">Rp</span>
                <input
                  class="tabular min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold outline-none"
                  inputmode="numeric"
                  :aria-label="`Harga jual ${r.name}`"
                  :value="rpInput(r.p.price)"
                  @focus="$event.target.select()"
                  @keydown.enter="$event.target.blur()"
                  @blur="r.kind === 'group' ? saveGroupMoney(r, 'price', $event) : saveMoney(r.p, 'price', $event)"
                />
              </label>
              <label
                class="flex h-11 items-center gap-2 rounded-xl px-3 focus-within:ring-2 focus-within:ring-ring/40"
                :class="(r.p.hpp ?? 0) > 0 ? 'bg-muted' : 'bg-warning-soft'"
              >
                <span class="text-xs font-semibold text-muted-foreground md:hidden">HPP</span>
                <span class="hidden text-sm text-muted-foreground md:inline">Rp</span>
                <input
                  class="tabular min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-warning"
                  inputmode="numeric"
                  placeholder="isi"
                  :aria-label="`HPP ${r.name}`"
                  :value="(r.p.hpp ?? 0) > 0 ? rpInput(r.p.hpp) : ''"
                  @focus="$event.target.select()"
                  @keydown.enter="$event.target.blur()"
                  @blur="r.kind === 'group' ? saveGroupMoney(r, 'hpp', $event) : saveMoney(r.p, 'hpp', $event)"
                />
              </label>
            </div>
            <span v-if="!(r.kind === 'group' && !r.uniform)" class="tabular hidden text-right text-sm md:block" :class="(r.p.hpp ?? 0) > 0 ? '' : 'text-muted-foreground'">
              <template v-if="(r.p.hpp ?? 0) > 0">{{ number.format(r.p.price - r.p.hpp) }} <span class="text-muted-foreground">· {{ marginPct(r.p) }}%</span></template>
              <template v-else>–</template>
            </span>
            <div class="hidden justify-center md:flex">
              <button
                v-if="r.kind === 'group'"
                type="button"
                class="flex h-8 items-center gap-1 rounded-full bg-muted px-2.5 text-sm font-semibold hover:bg-secondary"
                :aria-expanded="r.open"
                :title="r.open ? 'Tutup pilihan' : 'Lihat pilihan'"
                @click="toggleExpand(r.key)"
              >
                {{ r.availCount }}/{{ r.items.length }} <ChevronDown class="size-4 transition-transform" :class="r.open ? 'rotate-180' : ''" />
              </button>
              <button
                v-else
                type="button"
                role="switch"
                :aria-checked="r.p.is_available"
                :aria-label="`${r.name} tersedia`"
                class="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
                :class="r.p.is_available ? 'bg-primary' : 'bg-[#d6d3ce]'"
                :disabled="savingId === r.p.id"
                @click="toggleAvailable(r.p)"
              >
                <span class="inline-block size-6 rounded-full bg-white shadow transition-transform" :class="r.p.is_available ? 'translate-x-7' : 'translate-x-1'" />
              </button>
            </div>
            <button
              type="button"
              class="hidden size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted md:flex"
              :aria-label="`Ubah foto dan nama ${r.name}`"
              title="Ubah foto / nama"
              @click="openEdit(r.kind === 'group' ? r.base[0] : r.p)"
            >
              <Pencil class="size-4" />
            </button>
          </div>
        </template>
      </div>
      <p v-if="!catalog.loading && catalog.products.length && !visible.length" class="mt-4 text-[15px] text-muted-foreground">
        Menu tidak ditemukan.
      </p>
    </section>

    <!-- Riwayat shift pindah ke menu Shift -->

    <AccountsSection v-if="section === 'akun'" />
    <OutletSection v-if="section === 'toko'" />
    <ResetSection v-if="section === 'toko'" />


    <ProductFormDialog v-model:open="showForm" :product="editing" />
  </div>
</template>
