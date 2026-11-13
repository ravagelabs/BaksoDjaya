<script setup>
import { ref, computed, watch } from "vue";
import { X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { number, todayISO } from "@/lib/format";
import { acc } from "@/lib/pdf";
import { useUiStore } from "@/stores/ui";

// Dialog aksi cepat dari tombol + (akun utama): Biaya, Transfer kas, Aset, Kas/Bank baru, Jurnal.
// Dibuka lewat ui.quickAction; setelah tersimpan ui.financeVersion naik supaya halaman memuat ulang.
const ui = useUiStore();

const EXPENSE_CATEGORIES = [
  "Bahan baku", "Gaji karyawan", "Sewa tempat", "Listrik & air", "Gas",
  "Kemasan", "Transport", "Marketing", "Perawatan", "Lainnya",
];

const accounts = ref([]);
const cashAccounts = computed(() => accounts.value.filter((a) => a.cash));
const fixedAccounts = computed(() => accounts.value.filter((a) => a.fixed));
const accountName = (code) => accounts.value.find((a) => a.code === code)?.name ?? code;

async function loadAccounts() {
  try {
    accounts.value = (await api("/finance/accounts")).data;
  } catch {
    accounts.value = [];
  }
}

const open = computed({
  get: () => Boolean(ui.quickAction),
  set: (v) => {
    if (!v) ui.quickAction = null;
  },
});

// ---- Angka rupiah di input ----
const parse = (v) => Number(String(v ?? "").replace(/\D/g, "")) || 0;
function fmtInput(e, set) {
  const d = e.target.value.replace(/\D/g, "");
  const v = d ? number.format(Number(d)) : "";
  e.target.value = v;
  set(v);
}

const saving = ref(false);
const error = ref("");
function done(message) {
  ui.toast(message);
  ui.financeVersion++;
  ui.quickAction = null;
}

// ---- Form per aksi ----
const f = ref({});
const JOURNAL_TEMPLATES = [
  { key: "modal", label: "Setor modal", description: "Setoran modal pemilik", debit: "1-1100", credit: "3-1100" },
  { key: "qris", label: "Pencairan QRIS", description: "Pencairan saldo QRIS ke bank", debit: "1-1200", credit: "1-1300" },
  { key: "gofood", label: "Pencairan GoFood", description: "Pencairan GoFood ke bank", debit: "1-1200", credit: "1-1400" },
  { key: "grabfood", label: "Pencairan GrabFood", description: "Pencairan GrabFood ke bank", debit: "1-1200", credit: "1-1500" },
  { key: "prive", label: "Prive / ambil uang pemilik", description: "Penarikan oleh pemilik", debit: "3-1200", credit: "1-1100" },
  { key: "bebas", label: "Jurnal bebas", description: "", debit: "", credit: "" },
];
// Template sederhana: akun debit/kredit bisa diganti, cukup isi satu jumlah
const simpleTemplate = computed(() => f.value.template && f.value.template !== "bebas");

function useTemplate(t) {
  f.value = {
    ...f.value,
    template: t.key,
    description: t.description,
    debit: t.debit,
    credit: t.credit,
    amount: "",
    lines: [
      { account: t.debit, debit: "", credit: "" },
      { account: t.credit, debit: "", credit: "" },
    ],
  };
}

watch(
  () => ui.quickAction,
  async (a) => {
    if (!a) return;
    error.value = "";
    await loadAccounts();
    const today = todayISO();
    if (a === "biaya") f.value = { date: today, category: "Bahan baku", name: "", amount: "", paid_from: "1-1100" };
    if (a === "transfer") f.value = { date: today, from: cashAccounts.value.find((x) => x.code.startsWith("1-12"))?.code ?? "1-1200", to: "1-1100", amount: "", description: "" };
    if (a === "aset") f.value = { date: today, name: "", account: "1-2100", amount: "", source: "1-1100" };
    if (a === "kasbank") f.value = { kind: "bank", name: "", opening: "", date: today };
    if (a === "jurnal") {
      f.value = { date: today };
      useTemplate(JOURNAL_TEMPLATES[0]);
    }
  }
);

const journalTotals = computed(() => {
  if (simpleTemplate.value) return { d: parse(f.value.amount), c: parse(f.value.amount) };
  const lines = f.value.lines ?? [];
  return { d: lines.reduce((s, l) => s + parse(l.debit), 0), c: lines.reduce((s, l) => s + parse(l.credit), 0) };
});

const TITLES = {
  biaya: ["Catat biaya", "Pengeluaran operasional, otomatis masuk laporan laba rugi."],
  transfer: ["Transfer antar kas & bank", "Pindahkan uang, mis. dari Bank BCA ke Petty cash."],
  aset: ["Tambah aset", "Pembelian peralatan, kendaraan, atau renovasi."],
  kasbank: ["Tambah kas / bank", "Mis. Bank BCA, Bank Mandiri, atau Petty cash."],
  jurnal: ["Catat jurnal", "Modal, pencairan, prive, atau jurnal bebas."],
};

async function submit() {
  error.value = "";
  saving.value = true;
  try {
    const a = ui.quickAction;
    if (a === "biaya") {
      await api("/expenses", {
        method: "POST",
        body: { name: f.value.name, amount: parse(f.value.amount), date: f.value.date, category: f.value.category, paid_from: f.value.paid_from },
      });
      done(`Biaya ${f.value.name} dicatat`);
    } else if (a === "transfer") {
      if (f.value.from === f.value.to) throw new Error("Akun asal dan tujuan tidak boleh sama.");
      const amt = parse(f.value.amount);
      await api("/finance/journal", {
        method: "POST",
        body: {
          date: f.value.date,
          kind: "transfer",
          description: f.value.description || `Transfer ${accountName(f.value.from)} ke ${accountName(f.value.to)}`,
          lines: [
            { account: f.value.to, debit: amt, credit: 0 },
            { account: f.value.from, debit: 0, credit: amt },
          ],
        },
      });
      done("Transfer dicatat");
    } else if (a === "aset") {
      const amt = parse(f.value.amount);
      await api("/finance/journal", {
        method: "POST",
        body: {
          date: f.value.date,
          kind: "aset",
          description: f.value.name,
          lines: [
            { account: f.value.account, debit: amt, credit: 0 },
            { account: f.value.source, debit: 0, credit: amt },
          ],
        },
      });
      done(`Aset ${f.value.name} dicatat`);
    } else if (a === "kasbank") {
      await api("/finance/accounts", {
        method: "POST",
        body: { name: f.value.name, kind: f.value.kind, opening: parse(f.value.opening), date: f.value.date },
      });
      done(`${f.value.name} ditambahkan`);
    } else if (a === "jurnal") {
      const lines = simpleTemplate.value
        ? [
            { account: f.value.lines[0].account, debit: parse(f.value.amount), credit: 0 },
            { account: f.value.lines[1].account, debit: 0, credit: parse(f.value.amount) },
          ]
        : f.value.lines.map((l) => ({ account: l.account, debit: parse(l.debit), credit: parse(l.credit) }));
      await api("/finance/journal", { method: "POST", body: { date: f.value.date, description: f.value.description, lines } });
      done("Jurnal disimpan");
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

const input =
  "h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-[15px] font-normal outline-none focus:border-primary";
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="ui.quickAction" class="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-lg sm:p-8">
      <DialogHeader>
        <DialogTitle class="text-2xl font-bold">{{ TITLES[ui.quickAction][0] }}</DialogTitle>
        <DialogDescription class="text-[15px]">{{ TITLES[ui.quickAction][1] }}</DialogDescription>
      </DialogHeader>

      <form class="grid gap-3" @submit.prevent="submit">
        <!-- Biaya -->
        <template v-if="ui.quickAction === 'biaya'">
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm font-semibold">Tanggal<input v-model="f.date" type="date" :max="todayISO()" required :class="input" /></label>
            <label class="grid gap-1 text-sm font-semibold">Kategori
              <select v-model="f.category" :class="input"><option v-for="c in EXPENSE_CATEGORIES" :key="c" :value="c">{{ c }}</option></select>
            </label>
          </div>
          <label class="grid gap-1 text-sm font-semibold">Keterangan<input v-model="f.name" required placeholder="Contoh: Daging sapi 5 kg" :class="input" /></label>
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm font-semibold">Jumlah (Rp)
              <input :value="f.amount" inputmode="numeric" required placeholder="0" :class="[input, 'tabular']" @input="fmtInput($event, (v) => (f.amount = v))" />
            </label>
            <label class="grid gap-1 text-sm font-semibold">Dibayar dari
              <select v-model="f.paid_from" :class="input"><option v-for="a in cashAccounts" :key="a.code" :value="a.code">{{ a.name }}</option></select>
            </label>
          </div>
        </template>

        <!-- Transfer -->
        <template v-else-if="ui.quickAction === 'transfer'">
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm font-semibold">Dari
              <select v-model="f.from" :class="input"><option v-for="a in cashAccounts" :key="a.code" :value="a.code">{{ a.name }}</option></select>
            </label>
            <label class="grid gap-1 text-sm font-semibold">Ke
              <select v-model="f.to" :class="input"><option v-for="a in cashAccounts" :key="a.code" :value="a.code" :disabled="a.code === f.from">{{ a.name }}</option></select>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm font-semibold">Jumlah (Rp)
              <input :value="f.amount" inputmode="numeric" required placeholder="0" :class="[input, 'tabular']" @input="fmtInput($event, (v) => (f.amount = v))" />
            </label>
            <label class="grid gap-1 text-sm font-semibold">Tanggal<input v-model="f.date" type="date" :max="todayISO()" required :class="input" /></label>
          </div>
          <label class="grid gap-1 text-sm font-semibold">Keterangan <span class="font-normal text-muted-foreground">(opsional)</span>
            <input v-model="f.description" :placeholder="`Transfer ${accountName(f.from)} ke ${accountName(f.to)}`" :class="input" />
          </label>
        </template>

        <!-- Aset -->
        <template v-else-if="ui.quickAction === 'aset'">
          <label class="grid gap-1 text-sm font-semibold">Nama aset<input v-model="f.name" required placeholder="Contoh: Kompor 2 tungku, Freezer, Motor" :class="input" /></label>
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm font-semibold">Jenis aset
              <select v-model="f.account" :class="input"><option v-for="a in fixedAccounts" :key="a.code" :value="a.code">{{ a.name }}</option></select>
            </label>
            <label class="grid gap-1 text-sm font-semibold">Tanggal beli<input v-model="f.date" type="date" :max="todayISO()" required :class="input" /></label>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm font-semibold">Harga (Rp)
              <input :value="f.amount" inputmode="numeric" required placeholder="0" :class="[input, 'tabular']" @input="fmtInput($event, (v) => (f.amount = v))" />
            </label>
            <label class="grid gap-1 text-sm font-semibold">Dibayar dari
              <select v-model="f.source" :class="input">
                <option v-for="a in cashAccounts" :key="a.code" :value="a.code">{{ a.name }}</option>
                <option value="3-1100">Disetor pemilik (modal)</option>
                <option value="2-1100">Belum dibayar (utang)</option>
              </select>
            </label>
          </div>
        </template>

        <!-- Kas / bank baru -->
        <template v-else-if="ui.quickAction === 'kasbank'">
          <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis akun">
            <button
              v-for="k in [{ v: 'bank', l: 'Rekening bank' }, { v: 'kas', l: 'Kas / petty cash' }]"
              :key="k.v"
              type="button"
              role="radio"
              :aria-checked="f.kind === k.v"
              class="h-12 rounded-xl border text-[15px] transition-colors"
              :class="f.kind === k.v ? 'border-primary bg-secondary font-semibold' : 'bg-card hover:bg-muted/50'"
              @click="f.kind = k.v"
            >
              {{ k.l }}
            </button>
          </div>
          <label class="grid gap-1 text-sm font-semibold">Nama
            <input v-model="f.name" required maxlength="60" :placeholder="f.kind === 'bank' ? 'Contoh: Bank BCA 8015566899' : 'Contoh: Petty cash dapur'" :class="input" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm font-semibold">Saldo awal (Rp) <span class="font-normal text-muted-foreground">(opsional)</span>
              <input :value="f.opening" inputmode="numeric" placeholder="0" :class="[input, 'tabular']" @input="fmtInput($event, (v) => (f.opening = v))" />
            </label>
            <label class="grid gap-1 text-sm font-semibold">Per tanggal<input v-model="f.date" type="date" :max="todayISO()" :class="input" /></label>
          </div>
          <p class="text-sm text-muted-foreground">Saldo awal dicatat sebagai setoran modal pemilik.</p>
        </template>

        <!-- Jurnal -->
        <template v-else-if="ui.quickAction === 'jurnal'">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="t in JOURNAL_TEMPLATES"
              :key="t.key"
              type="button"
              class="h-9 rounded-full px-3 text-sm transition-colors"
              :class="f.template === t.key ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted hover:bg-secondary'"
              @click="useTemplate(t)"
            >
              {{ t.label }}
            </button>
          </div>
          <div class="grid grid-cols-[10rem_1fr] gap-3">
            <label class="grid gap-1 text-sm font-semibold">Tanggal<input v-model="f.date" type="date" required :class="input" /></label>
            <label class="grid gap-1 text-sm font-semibold">Keterangan<input v-model="f.description" required placeholder="Contoh: Setoran modal awal" :class="input" /></label>
          </div>
          <template v-if="simpleTemplate">
            <div class="grid grid-cols-2 gap-3">
              <label class="grid gap-1 text-sm font-semibold">Masuk ke (debit)
                <select v-model="f.lines[0].account" :class="input"><option v-for="a in accounts" :key="a.code" :value="a.code">{{ a.name }}</option></select>
              </label>
              <label class="grid gap-1 text-sm font-semibold">Dari (kredit)
                <select v-model="f.lines[1].account" :class="input"><option v-for="a in accounts" :key="a.code" :value="a.code">{{ a.name }}</option></select>
              </label>
            </div>
            <label class="grid gap-1 text-sm font-semibold">Jumlah (Rp)
              <input :value="f.amount" inputmode="numeric" required placeholder="0" :class="[input, 'tabular h-12 text-lg']" @input="fmtInput($event, (v) => (f.amount = v))" />
            </label>
          </template>
          <template v-else>
            <div v-for="(l, i) in f.lines" :key="i" class="grid grid-cols-[1fr_7rem_7rem_2.25rem] items-center gap-2">
              <select v-model="l.account" required :class="[input, 'px-2 text-[14px]']">
                <option value="" disabled>Pilih akun</option>
                <option v-for="a in accounts" :key="a.code" :value="a.code">{{ a.code }} {{ a.name }}</option>
              </select>
              <input :value="l.debit" inputmode="numeric" placeholder="Debit" :class="[input, 'px-2 text-right text-[14px] tabular']" @input="fmtInput($event, (v) => { l.debit = v; if (v) l.credit = ''; })" />
              <input :value="l.credit" inputmode="numeric" placeholder="Kredit" :class="[input, 'px-2 text-right text-[14px] tabular']" @input="fmtInput($event, (v) => { l.credit = v; if (v) l.debit = ''; })" />
              <button type="button" class="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30" :disabled="f.lines.length <= 2" aria-label="Hapus baris" @click="f.lines.splice(i, 1)">
                <X class="size-4" />
              </button>
            </div>
            <button type="button" class="w-fit text-sm font-medium text-primary hover:underline" @click="f.lines.push({ account: '', debit: '', credit: '' })">+ Tambah baris</button>
            <p class="tabular text-sm" :class="journalTotals.d === journalTotals.c && journalTotals.d ? 'text-success' : 'text-muted-foreground'">
              Debit {{ acc(journalTotals.d) }} · Kredit {{ acc(journalTotals.c) }} {{ journalTotals.d === journalTotals.c && journalTotals.d ? "· seimbang" : "· harus sama" }}
            </p>
          </template>
        </template>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button
          type="submit"
          class="mt-1 h-12 rounded-xl text-base"
          :disabled="saving || (ui.quickAction === 'jurnal' && (!journalTotals.d || journalTotals.d !== journalTotals.c))"
        >
          {{ saving ? "Menyimpan..." : "Simpan" }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
