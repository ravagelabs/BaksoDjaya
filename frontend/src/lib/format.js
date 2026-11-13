export const OUTLET_TZ = "Asia/Jakarta";
export const OUTLET_NAME = "Bakso Djaya";
export const OUTLET_BRANCH = "Outlet utama";

export const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Angka tanpa "Rp", untuk kolom yang rata kanan
export const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export const formatRp = (v) => rupiah.format(v ?? 0).replace(/ /g, " ");

export const longDate = (d = new Date()) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: OUTLET_TZ,
  }).format(new Date(d));

export const shortDate = (d) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: OUTLET_TZ }).format(
    new Date(d)
  );

export const timeOnly = (d) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: OUTLET_TZ }).format(new Date(d));

export const dateTime = (d) =>
  d
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: OUTLET_TZ }).format(
        new Date(d)
      )
    : "-";

// YYYY-MM-DD menurut zona waktu outlet
export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: OUTLET_TZ }).format(new Date());

export const minutesSince = (iso, now = Date.now()) =>
  iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)) : 0;

export const orderNo = (id) => (id ? `#${String(id).padStart(3, "0")}` : "");

export const ORDER_TYPES = [
  { value: "dine_in", label: "Dine-in" },
  { value: "pickup", label: "Take away" },
  { value: "delivery", label: "Delivery" },
];
// Dua alur pemesanan di kasir
export const KASIR_ORDER_TYPES = ORDER_TYPES.slice(0, 2);
export const orderTypeLabel = (v) => ORDER_TYPES.find((t) => t.value === v)?.label ?? "Dine-in";

export const PAYMENT_LABELS = {
  qris: "QRIS",
  transfer: "Transfer",
  cash: "Tunai",
  gofood: "GoFood",
  grabfood: "GrabFood",
  card: "Kartu", // metode lama, tetap terbaca di transaksi sebelumnya
};

// Metode yang dipilih di kasir, sesuai urutan tombol di halaman Bayar
export const PAYMENT_METHODS = ["qris", "transfer", "cash", "gofood", "grabfood"];

// Baris ringkasan per metode: metode aktif selalu tampil, "Kartu" hanya kalau ada nilainya
export const paymentRows = (summary = {}) =>
  [...PAYMENT_METHODS, "card"]
    .filter((k) => PAYMENT_METHODS.includes(k) || Number(summary[k]) > 0)
    .map((k) => ({ key: k, label: PAYMENT_LABELS[k], value: Number(summary[k]) || 0 }));

// "BAKSO URAT" -> "Bakso Urat"
export const titleCase = (s = "") =>
  s.toLowerCase().replace(/(^|[\s(+/-])(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());

// "PAKET SIJI - BAKSO URAT + BIHUN" -> { title: "Paket Siji", detail: "Bakso Urat + Bihun" }
export const splitName = (name = "") => {
  const [title, ...rest] = name.split(" - ");
  return { title: titleCase(title), detail: rest.length ? titleCase(rest.join(" - ")) : "" };
};

// Baris kecil di bawah nama item: opsi terpilih
export const optionsText = (options = []) =>
  options
    .map((o) => (o.price ? `${o.name} (+${number.format(o.price)})` : o.name))
    .join(", ");

// Foto yang di-upload disimpan backend di /uploads; di dev frontend dan backend beda port
const API_URL = import.meta.env.VITE_API_URL || "";
export const assetUrl = (src) => (src && src.startsWith("/uploads/") ? `${API_URL}${src}` : src || "");
