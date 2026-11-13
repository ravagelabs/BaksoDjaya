import { rupiah, orderTypeLabel, PAYMENT_LABELS, OUTLET_NAME, optionsText, orderNo } from "@/lib/format";

// ESC/POS builder: raw printer commands for a 58mm receipt (32 chars per line, Font A)
export function buildEscposReceipt(bill) {
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
  let big = false;
  let buf = [];
  let lineStyle = null; // gaya diambil dari awal baris
  const flush = () => {
    const text = dec.decode(new Uint8Array(buf));
    const st = lineStyle ?? { align, bold, big };
    lines.push(
      `<div style="text-align:${st.align};font-weight:${st.bold ? 700 : 400};${st.big ? "font-size:20px;line-height:1.25;font-weight:700;" : ""}">${esc(text) || "&nbsp;"}</div>`
    );
    buf = [];
    lineStyle = null;
  };
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 0x1b || c === 0x1d) {
      const op = bytes[i + 1];
      if (c === 0x1b && op === 0x40) { align = "left"; bold = false; big = false; i += 1; }
      else if (c === 0x1b && op === 0x61) { const n = bytes[i + 2]; align = n === 1 ? "center" : n === 2 ? "right" : "left"; i += 2; }
      else if (c === 0x1b && op === 0x45) { bold = bytes[i + 2] === 1; i += 2; }
      else if (c === 0x1b && op === 0x64) { i += 2; }
      else if (c === 0x1d && op === 0x21) { big = bytes[i + 2] !== 0; i += 2; }
      else if (c === 0x1d && op === 0x56) { i += 3; }
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
  write(updated ? "NOTA PESANAN (DIPERBARUI)\n" : "NOTA PESANAN\n");
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
  write(row("TOTAL SEMENTARA", rupiah.format(bill.grand_total)));
  cmd(0x1b, 0x45, 0x00);
  cmd(0x1b, 0x61, 0x01);
  write("BELUM DIBAYAR\n");
  write("Tunjukkan nota ini ke kasir\n");
  write("saat membayar.\n");
  cmd(0x1b, 0x64, 0x02);
  cmd(0x1d, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
}

export const printOrderSlip = (bill, opts) => sendToPrinter(buildOrderSlip(bill, opts), `Nota ${orderNo(bill.billId)}`);

// RawBT hanya ada di Android; di perangkat lain pratinjau tampil dan cetak lewat browser
export function canAutoPrint() {
  return /Android/i.test(navigator.userAgent);
}
