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
  cmd(0x1b, 0x45, 0x01);       // ESC E 1  bold on
  write(`${OUTLET_NAME.toUpperCase()}\n`);
  cmd(0x1b, 0x45, 0x00);       // bold off
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
  cmd(0x1b, 0x64, 0x02);       // ESC d 2  feed 2 lines past the last print
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
export function escposToHtml(bytes) {
  const dec = new TextDecoder();
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = [];
  let align = "left";
  let bold = false;
  let big = 0;
  let buf = [];
  let lineStyle = null; // gaya diambil dari awal baris
  const flush = () => {
    const text = dec.decode(new Uint8Array(buf));
    const st = lineStyle ?? { align, bold, big };
    lines.push(
      `<div style="text-align:${st.align};font-weight:${st.bold ? 700 : 400};${st.big === 2 ? "font-size:22px;line-height:1.25;font-weight:700;" : st.big ? "font-size:16px;line-height:1.35;font-weight:600;" : ""}">${esc(text) || "&nbsp;"}</div>`
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
      else if (c === 0x1d && op === 0x21) { big = bytes[i + 2] === 0x11 ? 2 : bytes[i + 2] ? 1 : 0; i += 2; }
      else if (c === 0x1d && op === 0x56) { i += 3; if (buf.length) flush(); lines.push('<div style="break-after:page;height:0"></div>'); }
      else i += 1;
      continue;
    }
    if (c === 0x0a) { flush(); continue; }
    if (!buf.length && !lineStyle) lineStyle = { align, bold, big };
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
    body { width: 52mm; font: 12px/1.35 ui-monospace, "SF Mono", Menlo, Consolas, monospace; white-space: pre-wrap; }
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

  cmd(0x1b, 0x40);
  cmd(0x1b, 0x61, 0x01);       // tengah
  write("STRUK DAPUR\n");
  BIG();
  cmd(0x1b, 0x45, 0x01);
  write(bill.table_code ? `NO. ${bill.table_code}\n` : `${orderTypeLabel(bill.order_type).toUpperCase()}\n`);
  cmd(0x1b, 0x45, 0x00);
  NORMAL();
  write(`${orderTypeLabel(bill.order_type)} - ${clean(time)} - ${orderNo(bill.billId)}\n`);
  cmd(0x1b, 0x61, 0x00);       // kiri
  write("=".repeat(32) + "\n");

  for (const i of bill.billItems) {
    const { head, parts } = title(i.name);
    BIG();
    cmd(0x1b, 0x45, 0x01);
    write(wrap(`${i.qty}x ${head.toUpperCase()}`, 16));
    cmd(0x1b, 0x45, 0x00);
    TALL();
    for (const p of parts) write(wrap(`- ${p.toUpperCase()}`, 32, " "));
    const opts = optionsText(i.options);
    if (opts) for (const o of opts.split(", ")) write(wrap(`- ${o.replace(/ \(\+[\d.]+\)$/, "").toUpperCase()}`, 32, " "));
    if (i.note) write(wrap(`! ${i.note.toUpperCase()}`, 32, " "));
    NORMAL();
    write("-".repeat(32) + "\n");
  }
  if (bill.note) {
    TALL();
    write(wrap(`CATATAN: ${bill.note.toUpperCase()}`, 32));
    NORMAL();
  }
  cmd(0x1b, 0x64, 0x03);
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
  cmd(0x1b, 0x45, 0x01);
  write(`${OUTLET_NAME.toUpperCase()}\n`);
  cmd(0x1b, 0x45, 0x00);
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
