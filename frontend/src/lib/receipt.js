import { useCatalogStore } from "@/stores/catalog";
import { rupiah, orderTypeLabel, PAYMENT_LABELS, OUTLET_NAME, BANK_ACCOUNT, optionsText, orderNo } from "@/lib/format";

// ESC/POS builder: raw printer commands for a 58mm receipt (32 chars per line, Font A)
// copyLabel: tulisan kecil di atas struk, mis. "PELANGGAN" / "DAPUR" saat dicetak 2 rangkap
export function buildEscposReceipt(bill, { copyLabel = "" } = {}) {
  const W = 32;
  const bytes = [];
  const enc = new TextEncoder();
  const write = (s) => bytes.push(...enc.encode(s));
  const cmd = (...b) => bytes.push(...b);
  const clean = (s) => String(s ?? "-").replace(/ /g, " "); // Intl adds NBSP before "Rp"
  const line = (ch = "-") => ch.repeat(W) + "\n";

  // Left text on the left, right text on the right. If they don't fit on one line,
  // the right text moves to its own line, right-aligned.
  const row = (left, right) => {
    const l = clean(left);
    const r = clean(right);
    if (l.length + r.length + 1 > W) {
      return l + "\n" + " ".repeat(Math.max(0, W - r.length)) + r + "\n";
    }
    return l + " ".repeat(W - l.length - r.length) + r + "\n";
  };

  // Word-wrap a name to the receipt width instead of cutting it off
  const wrap = (text, indent = "") => {
    const words = clean(text).split(" ");
    const lines = [];
    let cur = "";
    const max = W - indent.length;
    for (const w of words) {
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= max) cur += " " + w;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.map((l) => indent + l + "\n").join("");
  };

  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(bill.paid_at ?? bill.created_at));

  cmd(0x1b, 0x40);             // ESC @  init printer
  cmd(0x1b, 0x61, 0x01);       // ESC a 1  center
  if (!writeLogo(bytes)) {      // logo outlet; kalau belum ada, nama outlet
    cmd(0x1b, 0x45, 0x01);     // ESC E 1  bold on
    write(`${OUTLET_NAME.toUpperCase()}\n`);
    cmd(0x1b, 0x45, 0x00);     // bold off
  }
  if (copyLabel) write(`[ ${copyLabel} ]\n`);
  // Nomor pager besar supaya dapur & pelanggan langsung lihat
  if (bill.table_code) {
    cmd(0x1d, 0x21, 0x11);     // GS ! 0x11  teks 2x lebar dan tinggi
    write(`NO. ${bill.table_code}\n`);
    cmd(0x1d, 0x21, 0x00);     // ukuran normal
  }
  write(`Pesanan ${orderNo(bill.billId)}\n`);
  cmd(0x1b, 0x61, 0x00);       // ESC a 0  left
  write(line());
  write(`Tanggal: ${clean(date)}\n`);
  write(`Tipe: ${orderTypeLabel(bill.order_type)}${bill.table_code ? ` / No. ${bill.table_code}` : ""}\n`);
  if (bill.customer_name) write(`Pelanggan: ${clean(bill.customer_name)}\n`);
  write(line());

  for (const i of bill.billItems) {
    write(wrap(i.name));
    if (i.options?.length) write(wrap(optionsText(i.options), "  "));
    if (i.note) write(wrap(`Catatan: ${i.note}`, "  "));
    write(row(`  ${i.qty} x ${rupiah.format(i.price)}`, rupiah.format(i.price * i.qty)));
  }

  write(line());
  cmd(0x1b, 0x45, 0x01);       // bold on
  write(row("TOTAL", rupiah.format(bill.grand_total)));
  cmd(0x1b, 0x45, 0x00);       // bold off
  if (bill.payment_method) write(row("Bayar", PAYMENT_LABELS[bill.payment_method] ?? bill.payment_method));
  if (bill.payment_method === "transfer") write(row("No. rekening", BANK_ACCOUNT));
  if (bill.note) write(wrap(`Catatan pesanan: ${bill.note}`));
  cmd(0x1b, 0x61, 0x01);       // center
  write("Terima kasih!\n");
  // Printer tanpa pisau potong: dorong kertas cukup jauh supaya struk bisa disobek sebelum struk dapur keluar
  cmd(0x1b, 0x64, 0x05);       // ESC d 5  feed 5 lines past the last print
  cmd(0x1d, 0x56, 0x42, 0x00); // GS V B 0  partial cut

  return new Uint8Array(bytes);
}

// Hands the ESC/POS bytes to RawBT, which sends them to the USB printer
export function openInRawBT(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  window.location.href =
    `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`;
}

// Ubah perintah ESC/POS jadi HTML struk 58mm (dipakai untuk cetak lewat browser di non-Android).
// Mendukung perintah yang dipakai builder di file ini: init, rata, tebal, ukuran 2x, feed, potong.
// ---- Logo outlet di struk ----
// Logo diubah jadi gambar hitam-putih (ESC/POS raster GS v 0) supaya bisa dicetak printer thermal 58mm.
let logoRaster = null; // Uint8Array perintah GS v 0 lengkap
let logoPreview = ""; // data URL hitam-putih untuk print browser & pratinjau
const LOGO_DOTS = 288; // lebar logo di kertas (58mm = 384 titik)

export async function prepareReceiptLogo(url) {
  logoRaster = null;
  logoPreview = "";
  if (!url) return "";
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const w = LOGO_DOTS;
  const h = Math.max(8, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const rowBytes = Math.ceil(w / 8);
  const data = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const ink = lum < 150;
      if (ink) data[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      px[i] = px[i + 1] = px[i + 2] = ink ? 0 : 255;
    }
  }
  ctx.putImageData(new ImageData(px, w, h), 0, 0);
  logoPreview = canvas.toDataURL("image/png");
  logoRaster = new Uint8Array([0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, h & 0xff, h >> 8, ...data, 0x0a]);
  return logoPreview;
}

// Tulisan dicoret (mis. SELEDRI dicoret = jangan pakai seledri). Printer thermal tidak punya huruf coret,
// jadi tulisan digambar jadi gambar hitam-putih selebar kertas (384 titik) lalu dicetak sebagai raster.
// Return null kalau tidak ada canvas (mis. bukan di browser).
function strikeRaster(text, { indentChars = 3 } = {}) {
  if (typeof document === "undefined") return null;
  // Meniru huruf printer "tinggi 2x": 12 titik lebar x 48 titik tinggi per huruf, tebal
  const w = 384;
  const h = 52;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  const x0 = indentChars * 12;
  ctx.save();
  ctx.scale(1, 2); // tinggi 2x seperti teks printer
  ctx.font = `bold 20px "Courier New", ui-monospace, Menlo, monospace`;
  ctx.textBaseline = "middle";
  // paksa lebar tiap huruf 12 titik supaya sejajar dengan baris lain
  const chars = [...text];
  chars.forEach((ch, k) => {
    const cw = ctx.measureText(ch).width;
    ctx.fillText(ch, x0 + k * 12 + (12 - cw) / 2, h / 4);
  });
  ctx.restore();
  // garis coret tebal di tengah tulisan
  ctx.fillRect(x0 - 6, Math.round(h / 2) - 3, chars.length * 12 + 12, 5);
  const px = ctx.getImageData(0, 0, w, h).data;
  const rowBytes = w / 8;
  const data = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i] < 128) data[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  return [0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, h & 0xff, h >> 8, ...data, 0x0a];
}

// Blok hitam dengan tulisan putih selebar kertas, dibuat gambar supaya pasti tercetak di semua printer
function bannerRaster(text) {
  if (typeof document === "undefined") return null;
  const w = 384;
  const h = 72;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  let fs = 46;
  const font = (n) => `bold ${n}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font(fs);
  while (ctx.measureText(text).width > w - 24 && fs > 18) ctx.font = font(--fs);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 2);
  const px = ctx.getImageData(0, 0, w, h).data;
  const rowBytes = w / 8;
  const data = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i] < 128) data[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  return [0x1d, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, h & 0xff, h >> 8, ...data, 0x0a];
}

// Tulis logo (kalau ada) di posisi sekarang; return true kalau logo dicetak
function writeLogo(bytes) {
  if (!logoRaster) return false;
  for (const b of logoRaster) bytes.push(b);
  return true;
}

// Gambar raster ESC/POS -> data URL (untuk cetak lewat browser)
function rasterToDataUrl(data, xb, yd) {
  if (typeof document === "undefined") return "";
  const w = xb * 8;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = yd;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, yd);
  for (let y = 0; y < yd; y++)
    for (let x = 0; x < w; x++) {
      const on = data[y * xb + (x >> 3)] & (0x80 >> (x & 7));
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = on ? 0 : 255;
      img.data[k + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

export function escposToHtml(bytes) {
  const dec = new TextDecoder();
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = [];
  let align = "left";
  let bold = false;
  let big = 0;
  let inv = false;
  let buf = [];
  let lineStyle = null; // gaya diambil dari awal baris
  const flush = () => {
    const text = dec.decode(new Uint8Array(buf));
    const st = lineStyle ?? { align, bold, big, inv };
    // Ukuran meniru printer 58mm: normal 32 huruf/baris, besar (2x) 16 huruf, tinggi (2x) tetap 32 huruf
    const size =
      st.big === 2
        ? "font-size:20px;line-height:1.2;font-weight:700;"
        : st.big
          ? "display:block;transform:scaleY(1.8);transform-origin:top;margin-bottom:0.95em;font-weight:700;"
          : "";
    const body = esc(text) || "&nbsp;";
    lines.push(
      `<div style="text-align:${st.align};font-weight:${st.bold ? 700 : 400};${size}">${st.inv ? `<span style="background:#000;color:#fff">${body}</span>` : body}</div>`
    );
    buf = [];
    lineStyle = null;
  };
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 0x1b || c === 0x1d) {
      const op = bytes[i + 1];
      if (c === 0x1b && op === 0x40) { align = "left"; bold = false; big = 0; i += 1; }
      else if (c === 0x1b && op === 0x61) { const n = bytes[i + 2]; align = n === 1 ? "center" : n === 2 ? "right" : "left"; i += 2; }
      else if (c === 0x1b && op === 0x45) { bold = bytes[i + 2] === 1; i += 2; }
      else if (c === 0x1b && op === 0x64) { i += 2; }
      else if (c === 0x1d && op === 0x42) { inv = bytes[i + 2] === 1; i += 2; }
      else if (c === 0x1d && op === 0x21) { big = bytes[i + 2] === 0x11 ? 2 : bytes[i + 2] ? 1 : 0; i += 2; }
      else if (c === 0x1d && op === 0x56) { i += 3; if (buf.length) flush(); lines.push('<div style="break-after:page;height:0"></div>'); }
      else if (c === 0x1d && op === 0x76 && bytes[i + 2] === 0x30) {
        // GS v 0: gambar raster (logo)
        const xb = bytes[i + 4] + bytes[i + 5] * 256;
        const yd = bytes[i + 6] + bytes[i + 7] * 256;
        if (buf.length) flush();
        const src = rasterToDataUrl(bytes.subarray(i + 8, i + 8 + xb * yd), xb, yd) || logoPreview;
        if (src) lines.push(`<div style="text-align:center"><img src="${src}" style="width:${Math.round(((xb * 8) / 384) * 100)}%;image-rendering:pixelated;display:block;margin:0 auto"></div>`);
        i += 7 + xb * yd;
        if (bytes[i + 1] === 0x0a) i += 1;
      }
      else i += 1;
      continue;
    }
    if (c === 0x0a) { flush(); continue; }
    if (!buf.length && !lineStyle) lineStyle = { align, bold, big, inv };
    buf.push(c);
  }
  if (buf.length) flush();
  return lines.join("");
}

// Cetak lewat dialog print browser (Safari/Chrome di Mac, iPad, Windows) memakai iframe tersembunyi
export function printInBrowser(bytes, title = "Struk") {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: 58mm auto; margin: 3mm; }
    html, body { margin: 0; background: #fff; color: #000; }
    body { width: 52mm; font: 10px/1.35 ui-monospace, "SF Mono", Menlo, Consolas, monospace; white-space: pre-wrap; }
  </style></head><body>${escposToHtml(bytes)}</body></html>`);
  doc.close();
  const run = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  if (doc.readyState === "complete") setTimeout(run, 50);
  else frame.onload = run;
}

// Android: kirim ke RawBT (printer USB/Bluetooth). Perangkat lain: dialog print browser.
function sendToPrinter(bytes, title) {
  if (canAutoPrint()) openInRawBT(bytes);
  else printInBrowser(bytes, title);
}

export const printBill = (bill) => sendToPrinter(buildEscposReceipt(bill), `Struk ${orderNo(bill.billId)}`);

// Struk dapur: tulisan besar, tanpa harga. Hanya nomor, menu, dan keterangan (mudah dibaca semua umur).
// Lebar 58mm: teks 2x = 16 huruf per baris, teks tinggi 2x = 32 huruf per baris.
export function buildKitchenSlip(bill) {
  const bytes = [];
  const enc = new TextEncoder();
  const write = (s) => bytes.push(...enc.encode(s));
  const cmd = (...b) => bytes.push(...b);
  const clean = (s) => String(s ?? "").replace(/\u00a0/g, " ");
  const wrap = (text, width, indent = "") => {
    const words = clean(text).split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      if (!cur) cur = w;
      else if ((indent + cur + " " + w).length <= width) cur += " " + w;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.map((l) => indent + l + "\n").join("");
  };
  const BIG = () => cmd(0x1d, 0x21, 0x11); // lebar & tinggi 2x
  const TALL = () => cmd(0x1d, 0x21, 0x01); // tinggi 2x
  const NORMAL = () => cmd(0x1d, 0x21, 0x00);
  const title = (name) => {
    const [head, ...rest] = clean(name).split(" - ");
    return { head, parts: rest.length ? rest.join(" - ").split(" + ") : [] };
  };
  const time = new Intl.DateTimeFormat("id-ID", { timeStyle: "short" })
    .format(new Date(bill.paid_at ?? bill.sent_to_kitchen_at ?? bill.created_at ?? Date.now()));

  const BOLD = (on) => cmd(0x1b, 0x45, on ? 1 : 0);
  const CENTER = () => cmd(0x1b, 0x61, 0x01);
  const LEFT = () => cmd(0x1b, 0x61, 0x00);
  const catalog = (() => {
    try {
      return useCatalogStore();
    } catch {
      return null;
    }
  })();
  const categoryOf = (i) => String(i.category ?? catalog?.byId?.(i.product_id)?.category ?? "").toLowerCase();
  // Urutan: paket, bakso, mie, lainnya, minuman paling bawah
  const rank = (i) => ({ paket: 0, bakso: 1, mie: 2, minuman: 9 })[categoryOf(i)] ?? 5;
  const items = [...bill.billItems].sort((a, b) => rank(a) - rank(b));
  const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);
  const isTakeaway = bill.order_type === "pickup";
  const typeLine = isTakeaway ? "BUNGKUS" : "MAKAN DI TEMPAT";


  // Kepala: tanpa logo. Judul STRUK DAPUR, nomor meja, dan cara makan besar supaya tidak salah bungkus.
  cmd(0x1b, 0x40);
  CENTER();
  BOLD(true);
  TALL();
  write("*** STRUK DAPUR ***\n");
  BIG();
  if (bill.table_code) write(`NO. ${clean(bill.table_code)}\n`);
  const b = bannerRaster(typeLine);
  if (b) bytes.push(...b);
  else write(`${typeLine}\n`);
  NORMAL();
  BOLD(false);
  write(`Jam ${clean(time)}  -  Pesanan ${orderNo(bill.billId)}\n`);
  LEFT();
  write("=".repeat(32) + "\n");

  // Tiap menu: jumlah + nama besar; pilihan di bawahnya. "Tanpa ..." dicetak JANGAN di blok hitam.
  items.forEach((i, idx) => {
    const { head, parts } = title(i.name);
    BIG();
    BOLD(true);
    const q = `${i.qty}x`;
    wrap(head.toUpperCase(), 16 - q.length - 1)
      .split("\n")
      .filter(Boolean)
      .forEach((l, k) => write(`${k === 0 ? q : " ".repeat(q.length)} ${l}\n`));
    TALL();
    // "Pakai seledri" -> SELEDRI biasa, "Tanpa seledri" / "Tanpa mie" -> SELEDRI / MIE dicoret. Ukuran sama dengan BIHUN dll.
    const line = (name, group = "") => {
      const m = /^(pakai|tanpa)\b\s*(.*)$/i.exec(clean(name));
      const what = (m ? m[2] || group : clean(name)).toUpperCase();
      if (!what) return;
      if (m && m[1].toLowerCase() === "tanpa") {
        const r = strikeRaster(what);
        if (r) bytes.push(...r);
        else write(`   JANGAN ${what}\n`);
      } else write(wrap(what, 32, "   "));
    };
    for (const p of parts) line(p);
    for (const o of i.options ?? []) line(o.name, o.group);
    if (i.note) write(wrap(`CATATAN: ${i.note.toUpperCase()}`, 32, "   "));
    BOLD(false);
    NORMAL();
    if (idx < items.length - 1) write("-".repeat(32) + "\n");
  });

  write("=".repeat(32) + "\n");
  if (bill.note) {
    TALL();
    BOLD(true);
    write(wrap(`CATATAN: ${bill.note.toUpperCase()}`, 32));
    BOLD(false);
    NORMAL();
  }
  CENTER();
  TALL();
  BOLD(true);
  write(`${totalQty} PORSI - ${typeLine}\n`);
  BOLD(false);
  NORMAL();
  cmd(0x1b, 0x64, 0x05);
  cmd(0x1d, 0x56, 0x42, 0x00);
  return new Uint8Array(bytes);
}

export const printKitchenSlip = (bill) => sendToPrinter(buildKitchenSlip(bill), `Dapur ${orderNo(bill.billId)}`);

// Laporan shift 58mm: kasir, jam mulai-selesai, uang masuk per metode, total, jumlah transaksi
export function buildShiftReport(s, { running = false } = {}) {
  const W = 32;
  const bytes = [];
  const enc = new TextEncoder();
  const write = (t) => bytes.push(...enc.encode(t));
  const cmd = (...b) => bytes.push(...b);
  const clean = (t) => String(t ?? "-").replace(/\u00a0/g, " ");
  const row = (l, r) => {
    l = clean(l);
    r = clean(r);
    return l.length + r.length + 1 > W ? `${l}\n${" ".repeat(Math.max(0, W - r.length))}${r}\n` : `${l}${" ".repeat(W - l.length - r.length)}${r}\n`;
  };
  const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
  const start = new Date(s.created_at);
  const end = new Date(s.ended_at ?? Date.now());
  const mins = Math.max(0, Math.floor((end - start) / 60000));

  cmd(0x1b, 0x40);
  cmd(0x1b, 0x61, 0x01);
  if (!writeLogo(bytes)) {
    cmd(0x1b, 0x45, 0x01);
    write(`${OUTLET_NAME.toUpperCase()}\n`);
    cmd(0x1b, 0x45, 0x00);
  }
  cmd(0x1d, 0x21, 0x01);
  write(running ? "LAPORAN SHIFT (BERJALAN)\n" : "LAPORAN SHIFT\n");
  cmd(0x1d, 0x21, 0x00);
  if (s.id) write(`Shift #${s.id}\n`);
  cmd(0x1b, 0x61, 0x00);
  write("-".repeat(W) + "\n");
  write(row("Kasir", s.employee_name ?? "-"));
  write(row("Mulai", fmt.format(start)));
  write(row(running ? "Sampai" : "Selesai", fmt.format(end)));
  write(row("Durasi", mins >= 60 ? `${Math.floor(mins / 60)} jam ${mins % 60} mnt` : `${mins} mnt`));
  write("-".repeat(W) + "\n");
  for (const key of ["cash", "qris", "transfer", "gofood", "grabfood", "card"]) {
    if (key === "card" && !s.card) continue;
    write(row(PAYMENT_LABELS[key] ?? key, rupiah.format(s[key] ?? 0)));
  }
  write("-".repeat(W) + "\n");
  cmd(0x1b, 0x45, 0x01);
  write(row("TOTAL", rupiah.format(s.total ?? 0)));
  cmd(0x1b, 0x45, 0x00);
  write(row("Transaksi", String(s.transactions ?? 0)));
  write(row("Uang tunai di laci", rupiah.format(s.cash ?? 0)));
  write("\n\nParaf kasir:\n\n\n" + "_".repeat(20) + "\n");
  cmd(0x1b, 0x64, 0x03);
  cmd(0x1d, 0x56, 0x42, 0x00);
  return new Uint8Array(bytes);
}

export const printShiftReport = (s, opts) => sendToPrinter(buildShiftReport(s, opts), `Shift ${s.id ?? ""}`);

// Satu struk dengan label rangkap (PELANGGAN / DAPUR)
export const printBillCopy = (bill, copyLabel) =>
  sendToPrinter(buildEscposReceipt(bill, { copyLabel }), `Struk ${orderNo(bill.billId)}`);

// Setelah bayar: struk dicetak 2 rangkap dalam satu kali cetak (pelanggan + dapur), jadi tidak perlu nota terpisah
export function printBillTwice(bill) {
  const a = buildEscposReceipt(bill, { copyLabel: "PELANGGAN" });
  const b = buildEscposReceipt(bill, { copyLabel: "DAPUR" });
  const both = new Uint8Array(a.length + b.length);
  both.set(a, 0);
  both.set(b, a.length);
  sendToPrinter(both, `Struk ${orderNo(bill.billId)}`);
}

// Nota pesanan: dicetak saat pesanan masuk dapur, ditaruh di meja sampai pelanggan membayar.
// Format 58mm sama dengan struk, tapi tanpa metode bayar dan dengan tanda "BELUM DIBAYAR".
export function buildOrderSlip(bill, { updated = false } = {}) {
  const W = 32;
  const bytes = [];
  const enc = new TextEncoder();
  const write = (s) => bytes.push(...enc.encode(s));
  const cmd = (...b) => bytes.push(...b);
  const clean = (s) => String(s ?? "-").replace(/\u00a0/g, " ");
  const line = (ch = "-") => ch.repeat(W) + "\n";
  const row = (left, right) => {
    const l = clean(left);
    const r = clean(right);
    if (l.length + r.length + 1 > W) return l + "\n" + " ".repeat(Math.max(0, W - r.length)) + r + "\n";
    return l + " ".repeat(W - l.length - r.length) + r + "\n";
  };
  const wrap = (text, indent = "") => {
    const words = clean(text).split(" ");
    const lines = [];
    let cur = "";
    const max = W - indent.length;
    for (const w of words) {
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= max) cur += " " + w;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.map((l) => indent + l + "\n").join("");
  };

  const time = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(bill.sent_to_kitchen_at ?? bill.created_at ?? Date.now()));
  const where = bill.table_code ? `NO. ${bill.table_code}` : orderTypeLabel(bill.order_type).toUpperCase();

  cmd(0x1b, 0x40);             // init
  cmd(0x1b, 0x61, 0x01);       // center
  write(`${OUTLET_NAME.toUpperCase()}\n`);
  const paid = bill.status === "paid" || Boolean(bill.payment_method);
  write(updated ? "NOTA PESANAN (DIPERBARUI)\n" : paid ? "NOTA DAPUR\n" : "NOTA PESANAN\n");
  cmd(0x1d, 0x21, 0x11);       // GS ! 0x11  teks 2x lebar dan tinggi
  write(`${where}\n`);
  cmd(0x1d, 0x21, 0x00);       // ukuran normal
  write(`Pesanan ${orderNo(bill.billId)}\n`);
  cmd(0x1b, 0x61, 0x00);       // left
  write(line());
  write(`Waktu: ${clean(time)}\n`);
  if (bill.guests) write(`Tamu: ${bill.guests} orang\n`);
  if (bill.customer_name) write(`Pelanggan: ${clean(bill.customer_name)}\n`);
  write(line());

  for (const i of bill.billItems) {
    cmd(0x1b, 0x45, 0x01);
    write(wrap(`${i.qty}x ${i.name}`));
    cmd(0x1b, 0x45, 0x00);
    if (i.options?.length) write(wrap(optionsText(i.options), "   "));
    if (i.note) write(wrap(`Catatan: ${i.note}`, "   "));
    write(row("", rupiah.format(i.price * i.qty)));
  }
  if (bill.note) {
    write(line());
    write(wrap(`Catatan pesanan: ${bill.note}`));
  }

  write(line());
  cmd(0x1b, 0x45, 0x01);
  write(row(paid ? "TOTAL" : "TOTAL SEMENTARA", rupiah.format(bill.grand_total)));
  cmd(0x1b, 0x45, 0x00);
  cmd(0x1b, 0x61, 0x01);
  if (paid) {
    write(`LUNAS${bill.payment_method ? ` - ${PAYMENT_LABELS[bill.payment_method] ?? bill.payment_method}` : ""}\n`);
  } else {
    write("BELUM DIBAYAR\n");
    write("Tunjukkan nota ini ke kasir\n");
    write("saat membayar.\n");
  }
  cmd(0x1b, 0x64, 0x02);
  cmd(0x1d, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
}

export const printOrderSlip = (bill, opts) => sendToPrinter(buildOrderSlip(bill, opts), `Nota ${orderNo(bill.billId)}`);

// RawBT hanya ada di Android; di perangkat lain pratinjau tampil dan cetak lewat browser
export function canAutoPrint() {
  return /Android/i.test(navigator.userAgent);
}
