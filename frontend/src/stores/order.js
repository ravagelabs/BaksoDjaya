import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@/lib/api";

// Kunci baris keranjang: produk + opsi + catatan. Item sama dengan opsi berbeda jadi baris terpisah.
const lineKey = (productId, options, note) =>
  `${productId}|${JSON.stringify((options ?? []).map((o) => [o.group, o.name]))}|${note ?? ""}`;

// Pesanan yang sedang dibuat di kasir. Disimpan di store supaya tetap ada saat pindah tab.
export const useOrderStore = defineStore("order", () => {
  const billId = ref(null);
  const lines = ref([]); // { key, product_id, name, category, price, qty, note, options }
  const customer = ref(null);
  const table = ref(null); // { id, code }
  const orderType = ref("dine_in");
  const guests = ref(null);
  const note = ref("");
  const kitchenStatus = ref(null);
  const dirty = ref(false);
  const saving = ref(false);

  const subtotal = computed(() => lines.value.reduce((sum, l) => sum + l.price * l.qty, 0));
  const tax = computed(() => 0); // Pajak / biaya mengikuti pengaturan outlet; belum ada pengaturannya
  const total = computed(() => subtotal.value + tax.value);
  const itemCount = computed(() => lines.value.reduce((sum, l) => sum + l.qty, 0));
  const isEmpty = computed(() => lines.value.length === 0);

  function touch() {
    dirty.value = true;
  }

  function addLine({ product, qty = 1, options = [], note: itemNote = "" }) {
    const extras = options.reduce((s, o) => s + (o.price || 0), 0);
    const cleanNote = itemNote.trim() || null;
    const key = lineKey(product.id, options, cleanNote);
    const existing = lines.value.find((l) => l.key === key);
    if (existing) existing.qty += qty;
    else
      lines.value.push({
        key,
        product_id: product.id,
        name: product.name,
        category: product.category,
        price: product.price + extras,
        qty,
        note: cleanNote,
        options,
      });
    touch();
  }

  function changeQty(key, delta) {
    const line = lines.value.find((l) => l.key === key);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) lines.value = lines.value.filter((l) => l.key !== key);
    touch();
  }

  function removeLine(key) {
    lines.value = lines.value.filter((l) => l.key !== key);
    touch();
  }

  function setTable(t) {
    table.value = t ? { id: t.id, code: t.code } : null;
    if (t) orderType.value = "dine_in";
    touch();
  }

  function setOrderType(type) {
    orderType.value = type;
    if (type !== "dine_in") table.value = null;
    touch();
  }

  function setCustomer(c) {
    customer.value = c;
    touch();
  }

  function setNote(text) {
    note.value = text;
    touch();
  }

  function setGuests(n) {
    guests.value = n;
    touch();
  }

  function reset() {
    billId.value = null;
    lines.value = [];
    customer.value = null;
    table.value = null;
    orderType.value = "dine_in";
    guests.value = null;
    note.value = "";
    kitchenStatus.value = null;
    dirty.value = false;
  }

  // Memuat bill dari server (GET /bills/:id atau daftar bill) ke kasir
  function loadBill(bill) {
    reset();
    billId.value = bill.billId;
    // Item dengan produk + opsi + catatan yang sama digabung, supaya kunci baris tetap unik
    const merged = new Map();
    for (const i of bill.billItems) {
      const options = Array.isArray(i.options) ? i.options : [];
      const key = lineKey(i.product_id, options, i.note);
      const existing = merged.get(key);
      if (existing) existing.qty += i.qty;
      else
        merged.set(key, {
          key,
          product_id: i.product_id,
          name: i.name,
          price: i.price,
          qty: i.qty,
          note: i.note,
          options,
        });
    }
    lines.value = [...merged.values()];
    customer.value = bill.customer_id
      ? { id: bill.customer_id, name: bill.customer_name, type: bill.customer_type }
      : null;
    table.value = bill.table_id ? { id: bill.table_id, code: bill.table_code } : null;
    orderType.value = bill.order_type ?? "dine_in";
    guests.value = bill.guests ?? null;
    note.value = bill.note ?? "";
    kitchenStatus.value = bill.kitchen_status ?? null;
    dirty.value = false;
  }

  async function fetchAndLoad(id) {
    const json = await api(`/bills/${id}`);
    loadBill(json.data);
    return json.data;
  }

  function payload(employeeId, extra = {}) {
    return {
      ...(billId.value ? { billId: billId.value } : {}),
      customerId: customer.value?.id ?? null,
      employeeId,
      grandTotal: total.value,
      tableId: table.value?.id ?? null,
      orderType: orderType.value,
      guests: guests.value,
      note: note.value,
      billItems: lines.value.map(({ product_id, price, qty, note: n, options }) => ({
        product_id,
        price,
        qty,
        note: n,
        options,
      })),
      ...extra,
    };
  }

  // Data nota dari isi kasir saat ini, bentuknya sama dengan GET /bills/:id
  function snapshot(id, extra = {}) {
    return {
      billId: id,
      table_code: table.value?.code ?? null,
      order_type: orderType.value,
      guests: guests.value,
      customer_name: customer.value?.name ?? null,
      note: note.value || null,
      grand_total: total.value,
      created_at: new Date().toISOString(),
      billItems: lines.value.map((l, idx) => ({
        id: idx,
        name: l.name,
        qty: l.qty,
        price: l.price,
        note: l.note,
        options: l.options,
      })),
      ...extra,
    };
  }

  // Simpan sebagai pending (opsional sekaligus kirim ke dapur). Mengembalikan id bill.
  async function save(employeeId, { sendToKitchen = false } = {}) {
    saving.value = true;
    try {
      const json = await api("/bills", { method: "POST", body: payload(employeeId, { sendToKitchen }) });
      return billId.value ?? json.data?.id;
    } finally {
      saving.value = false;
    }
  }

  // Finalisasi pembayaran. Mengembalikan id bill yang sudah dibayar.
  async function pay(employeeId, paymentMethod) {
    saving.value = true;
    try {
      const json = await api("/bills", { method: "POST", body: payload(employeeId, { paymentMethod }) });
      return json.data?.id ?? billId.value;
    } finally {
      saving.value = false;
    }
  }

  return {
    billId,
    lines,
    customer,
    table,
    orderType,
    guests,
    note,
    kitchenStatus,
    dirty,
    saving,
    subtotal,
    tax,
    total,
    itemCount,
    isEmpty,
    addLine,
    changeQty,
    removeLine,
    setTable,
    setOrderType,
    setCustomer,
    setNote,
    setGuests,
    reset,
    loadBill,
    fetchAndLoad,
    save,
    pay,
    snapshot,
  };
});
