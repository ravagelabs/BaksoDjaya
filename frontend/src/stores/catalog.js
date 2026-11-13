import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@/lib/api";

const isPaket = (p) => p.name.startsWith("PAKET ");
const paketBase = (name) => name.split(" - ")[0]; // "PAKET SIJI - BAKSO BULAT + MIE" -> "PAKET SIJI"
const PAKET_RE = /^(PAKET .+) - BAKSO (.+) \+ (.+)$/;

// Database mengirim harga sebagai teks ("5000.00"): ubah ke angka supaya tambahan harga ikut terjumlah
const normalize = (p) => ({ ...p, price: Number(p.price) || 0, hpp: Number(p.hpp) || 0 });

// Menu, kategori, paket, dan modifier (pilihan + tambahan)
export const useCatalogStore = defineStore("catalog", () => {
  const products = ref([]);
  const modifiers = ref([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref("");

  async function load(force = false) {
    if (loaded.value && !force) return;
    loading.value = true;
    error.value = "";
    try {
      const [p, m] = await Promise.all([api("/products"), api("/modifiers")]);
      products.value = p.map(normalize);
      modifiers.value = (m.data ?? []).map((x) => ({ ...x, price: Number(x.price) || 0 }));
      loaded.value = true;
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  const byId = (id) => products.value.find((p) => p.id === id);

  // Grid kasir: produk biasa apa adanya, paket digabung jadi satu kartu per nama paket
  const gridProducts = computed(() => {
    const seen = new Map();
    const result = [];
    for (const p of products.value) {
      if (!isPaket(p)) {
        result.push({ ...p, isPaket: false });
        continue;
      }
      const base = paketBase(p.name);
      const card = seen.get(base);
      if (card) {
        // Paket dianggap tersedia kalau masih ada minimal satu kombinasi yang tersedia
        card.is_available = card.is_available || p.is_available;
        card.price = Math.min(card.price, p.price);
        continue;
      }
      const entry = { ...p, name: base, isPaket: true };
      seen.set(base, entry);
      result.push(entry);
    }
    return result;
  });

  const categories = computed(() => {
    const list = [];
    for (const p of gridProducts.value) {
      const c = p.category || "Lainnya";
      if (!list.includes(c)) list.push(c);
    }
    return list;
  });

  // Pilihan bakso dan mie untuk satu paket, diambil dari nama kombinasi yang ada di database
  function paketOptions(base) {
    const bakso = [];
    const mie = [];
    for (const p of products.value) {
      const m = p.name.match(PAKET_RE);
      if (!m || m[1] !== base) continue;
      if (!bakso.includes(m[2])) bakso.push(m[2]);
      if (!mie.includes(m[3])) mie.push(m[3]);
    }
    return { bakso, mie };
  }

  // Baris keranjang -> kartu grid + pilihan paketnya (untuk mengubah item yang sudah di keranjang)
  function cardForLine(line) {
    const m = line.name.match(PAKET_RE);
    if (m) {
      const card = gridProducts.value.find((g) => g.isPaket && g.name === m[1]);
      return card ? { product: card, paket: { bakso: m[2], mie: m[3] } } : null;
    }
    const card = gridProducts.value.find((g) => g.id === line.product_id);
    return card ? { product: card, paket: null } : null;
  }

  const findPaket = (base, bakso, mie) =>
    products.value.find((p) => p.name === `${base} - BAKSO ${bakso} + ${mie}`);

  // Grup modifier untuk satu menu: berlaku kalau dipasang ke kategorinya ATAU ke menu itu sendiri.
  // Hasil: [{ name, kind, options: [...] }]
  function modifierGroups(category, productId = null) {
    const groups = new Map();
    for (const m of modifiers.value) {
      const forCategory = m.categories?.includes(category);
      const forProduct = productId != null && m.product_ids?.includes(productId);
      if (!forCategory && !forProduct) continue;
      if (!groups.has(m.group_name)) groups.set(m.group_name, { name: m.group_name, kind: m.kind, options: [] });
      groups.get(m.group_name).options.push(m);
    }
    return [...groups.values()];
  }

  // Pilihan default (opsi pertama tiap grup "choice"), dipakai tombol + cepat
  function defaultOptions(category, productId = null) {
    return modifierGroups(category, productId)
      .filter((g) => g.kind === "choice")
      .map((g) => ({ group: g.name, name: g.options[0].name, price: g.options[0].price }));
  }

  // Menu yang punya pilihan wajib (mis. Panas / Es): tombol + membuka dialog, bukan langsung tambah
  const hasChoices = (product) =>
    modifierGroups(product.category, product.id).some((g) => g.kind === "choice" && g.options.length > 1);

  // Menyisipkan menu baru atau mengganti data menu yang sudah ada
  function upsert(product) {
    product = normalize(product);
    const i = products.value.findIndex((p) => p.id === product.id);
    if (i === -1) products.value.push(product);
    else products.value[i] = product;
  }

  function remove(id) {
    products.value = products.value.filter((p) => p.id !== id);
  }

  function setAvailability(id, isAvailable) {
    const p = byId(id);
    if (p) p.is_available = isAvailable;
  }

  return {
    products,
    modifiers,
    loading,
    loaded,
    error,
    load,
    byId,
    gridProducts,
    categories,
    paketOptions,
    findPaket,
    cardForLine,
    modifierGroups,
    defaultOptions,
    hasChoices,
    setAvailability,
    upsert,
    remove,
  };
});
