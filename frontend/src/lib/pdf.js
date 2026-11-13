// Cetak laporan A4 yang rapi (kop logo outlet) lewat dialog print browser → "Simpan sebagai PDF".
// Dipakai halaman Beranda dan Keuangan. Tidak butuh library tambahan dan jalan di Mac, iPad, Android.
import { OUTLET_NAME, OUTLET_BRANCH } from "@/lib/format";

const esc = (t) =>
  String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const money = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
// Angka laporan keuangan: negatif ditulis dalam kurung
export const acc = (n) => {
  const v = Math.round(Number(n) || 0);
  return v < 0 ? `(${money.format(-v)})` : money.format(v);
};

/**
 * doc = {
 *   title: "Laporan Laba Rugi",
 *   period: "1 Nov 2026 – 13 Nov 2026",
 *   logo: "https://.../uploads/logo.png" | "",
 *   sections: [
 *     { heading: "Pendapatan", rows: [ { label, value, indent, bold, total, note } ], columns?: ["Akun","Jumlah"] },
 *     { heading: "...", table: { columns: ["Tanggal","Keterangan","Debit","Kredit"], rows: [[...]], align: ["left","left","right","right"] } },
 *   ],
 *   note: "Catatan kaki",
 * }
 */
export function buildReportHtml(doc) {
  const printedAt = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const section = (s) => {
    let body = "";
    if (s.rows) {
      body = `<table class="rows">${s.rows
        .map(
          (r) => `<tr class="${r.total ? "total" : ""} ${r.bold ? "bold" : ""} ${r.grand ? "grand" : ""}">
            <td style="padding-left:${(r.indent ?? 0) * 18 + 4}px">${esc(r.label)}${r.note ? `<span class="note"> ${esc(r.note)}</span>` : ""}</td>
            <td class="num">${r.value === null || r.value === undefined ? "" : typeof r.value === "number" ? acc(r.value) : esc(r.value)}</td>
          </tr>`
        )
        .join("")}</table>`;
    }
    if (s.table) {
      const al = s.table.align ?? [];
      body = `<table class="grid"><thead><tr>${s.table.columns
        .map((c, i) => `<th style="text-align:${al[i] ?? "left"}">${esc(c)}</th>`)
        .join("")}</tr></thead><tbody>${s.table.rows
        .map(
          (r) =>
            `<tr class="${r.className ?? ""}">${(r.cells ?? r)
              .map((c, i) => `<td style="text-align:${al[i] ?? "left"}">${typeof c === "number" ? acc(c) : esc(c)}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody></table>`;
      if (!s.table.rows.length) body += `<p class="empty">Tidak ada data di periode ini.</p>`;
    }
    return `<section>${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}${body}</section>`;
  };

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(doc.title)} ${esc(doc.period)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1c1917; margin: 0; }
  header { display: flex; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #1c1917; }
  header img { height: 58px; width: auto; }
  header .who { flex: 1; }
  header .outlet { font-size: 13pt; font-weight: 700; }
  header .branch { color: #57534e; font-size: 9.5pt; }
  header .doc { text-align: right; }
  header .doc h1 { margin: 0; font-size: 16pt; letter-spacing: .2px; }
  header .doc p { margin: 2px 0 0; color: #57534e; font-size: 10pt; }
  section { margin-top: 18px; break-inside: avoid; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: .6px; color: #57534e; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .rows td { padding: 5px 4px; border-bottom: 1px solid #ece9e4; }
  .rows td.num, .grid td:not(:first-child) { font-variant-numeric: tabular-nums; }
  .num { text-align: right; white-space: nowrap; }
  .rows tr.bold td { font-weight: 600; }
  .rows tr.total td { font-weight: 700; border-top: 1px solid #1c1917; border-bottom: 1px solid #1c1917; }
  .rows tr.grand td { font-weight: 800; font-size: 12pt; border-top: 2px solid #1c1917; border-bottom: 3px double #1c1917; }
  .note { color: #78716c; font-weight: 400; font-size: 9pt; }
  .grid th { font-size: 9pt; text-transform: uppercase; letter-spacing: .4px; color: #57534e; border-bottom: 1.5px solid #1c1917; padding: 6px 4px; }
  .grid td { padding: 5px 4px; border-bottom: 1px solid #ece9e4; font-size: 10pt; }
  .grid tr.sum td { font-weight: 700; border-top: 1.5px solid #1c1917; }
  .empty { color: #78716c; font-size: 10pt; }
  footer { margin-top: 26px; padding-top: 8px; border-top: 1px solid #d6d3ce; color: #78716c; font-size: 8.5pt; display: flex; justify-content: space-between; }
</style></head><body>
<header>
  ${doc.logo ? `<img src="${esc(doc.logo)}" alt="">` : ""}
  <div class="who"><div class="outlet">${esc(OUTLET_NAME)}</div><div class="branch">${esc(OUTLET_BRANCH)}</div></div>
  <div class="doc"><h1>${esc(doc.title)}</h1><p>${esc(doc.period)}</p></div>
</header>
${doc.sections.map(section).join("")}
${doc.note ? `<p class="empty" style="margin-top:16px">${esc(doc.note)}</p>` : ""}
<footer><span>Dicetak ${esc(printedAt)} · Ravage POS</span><span>${esc(OUTLET_NAME)}</span></footer>
</body></html>`;
}

// Buka dialog print untuk dokumen A4 (pilih "Simpan sebagai PDF")
export function printReport(doc) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const d = frame.contentDocument;
  d.open();
  d.write(buildReportHtml(doc));
  d.close();
  const go = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  };
  // tunggu logo termuat supaya ikut tercetak
  const img = d.querySelector("img");
  if (img && !img.complete) {
    img.onload = go;
    img.onerror = go;
  } else setTimeout(go, 50);
}
