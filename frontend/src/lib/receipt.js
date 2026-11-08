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
  write(`Bill #${bill.billId}\n`);
  cmd(0x1b, 0x61, 0x00);       // ESC a 0  left
  write(line());
  write(`Tanggal: ${clean(date)}\n`);
  write(`Tipe: ${orderTypeLabel(bill.order_type)}${bill.table_code ? ` / Meja ${bill.table_code}` : ""}\n`);
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

export const printBill = (bill) => openInRawBT(buildEscposReceipt(bill));

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
  const where = bill.table_code ? `MEJA ${bill.table_code}` : orderTypeLabel(bill.order_type).toUpperCase();

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

export const printOrderSlip = (bill, opts) => openInRawBT(buildOrderSlip(bill, opts));

// RawBT hanya ada di Android; di laptop cukup tampilkan pratinjau
export const canAutoPrint = () => /Android/i.test(navigator.userAgent);
