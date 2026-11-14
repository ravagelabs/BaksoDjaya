// Laporan A4 yang rapi (kop logo outlet): bisa dicetak (dialog print browser) atau langsung jadi file PDF.
// Dipakai halaman Beranda, Keuangan, dan Laporan harian.
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

const REPORT_CSS = `
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
  .rows td.num, .rtable td:not(:first-child) { font-variant-numeric: tabular-nums; }
  .num { text-align: right; white-space: nowrap; }
  .rows tr.bold td { font-weight: 600; }
  .rows tr.total td { font-weight: 700; border-top: 1px solid #1c1917; border-bottom: 1px solid #1c1917; }
  .rows tr.grand td { font-weight: 800; font-size: 12pt; border-top: 2px solid #1c1917; border-bottom: 3px double #1c1917; }
  .note { color: #78716c; font-weight: 400; font-size: 9pt; }
  .rtable th { font-size: 9pt; text-transform: uppercase; letter-spacing: .4px; color: #57534e; border-bottom: 1.5px solid #1c1917; padding: 6px 4px; }
  .rtable td { padding: 5px 4px; border-bottom: 1px solid #ece9e4; font-size: 10pt; }
  .rtable tr.sum td { font-weight: 700; border-top: 1.5px solid #1c1917; }
  .empty { color: #78716c; font-size: 10pt; }
  footer { margin-top: 26px; padding: 8px 0 4px; line-height: 1.6; border-top: 1px solid #d6d3ce; color: #78716c; font-size: 8.5pt; display: flex; justify-content: space-between; }
`;

const reportBody = (doc, section, printedAt) => `
<header>
  ${doc.logo ? `<img src="${esc(doc.logo)}" alt="">` : ""}
  <div class="who"><div class="outlet">${esc(OUTLET_NAME)}</div><div class="branch">${esc(OUTLET_BRANCH)}</div></div>
  <div class="doc"><h1>${esc(doc.title)}</h1><p>${esc(doc.period)}</p></div>
</header>
${doc.sections.map(section).join("")}
${doc.note ? `<p class="empty" style="margin-top:16px">${esc(doc.note)}</p>` : ""}
<footer><span>Dicetak ${esc(printedAt)} · Ravage POS</span><span>${esc(OUTLET_NAME)}</span></footer>
`;

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
      body = `<table class="rtable"><thead><tr>${s.table.columns
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
<style>${REPORT_CSS}</style></head><body>${reportBody(doc, section, printedAt)}</body></html>`;
}

// mode "print": dialog cetak browser. mode "pdf": langsung jadi file PDF (unduh / bagikan di HP).
export function printReport(doc, mode = "print") {
  if (mode === "pdf") return saveReportPdf(doc);
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

// File PDF A4 sungguhan (tanpa dialog cetak). Di HP pakai lembar Bagikan (Simpan ke File / WhatsApp).
export async function saveReportPdf(doc) {
  const { default: html2pdf } = await import("html2pdf.js");
  // isi laporan sama persis dengan versi cetak
  const html = buildReportHtml(doc);
  const inner = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:-10000px;top:0;width:182mm;padding-bottom:14mm;background:#fff;line-height:1.5;";
  box.innerHTML = `<style>${scopeCss(REPORT_CSS, ".rp")}</style><div class="rp" style="padding-bottom:10mm">${inner}</div>`;
  document.body.appendChild(box);
  try {
    const name = `${doc.title} ${doc.period}`.replace(/[–—]/g, "-").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() + ".pdf";
    const blob = await html2pdf()
      .set({
        margin: [12, 14, 12, 14],
        filename: name,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "section"] },
      })
      .from(box.querySelector(".rp"))
      .outputPdf("blob");
    const file = new File([blob], name, { type: "application/pdf" });
    const touch = matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } finally {
    box.remove();
  }
}

// Batasi CSS laporan hanya ke dalam .rp supaya tampilan aplikasi tidak ikut berubah
function scopeCss(css, scope) {
  return css
    .replace(/@page[^}]*}/g, "")
    .replace(/([^{}]+)\{/g, (_, sel) =>
      sel
        .split(",")
        .map((x) => {
          const t = x.trim();
          if (t === "body") return scope;
          if (t === "*") return `${scope} *`;
          return `${scope} ${t}`;
        })
        .join(", ") + " {"
    );
}
