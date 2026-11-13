<script setup>
import { ref } from "vue";
import { RotateCcw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useUiStore } from "@/stores/ui";

// Mulai dari nol sebelum go-live: hapus semua transaksi uji coba (akun utama saja)
const ui = useUiStore();
const open = ref(false);
const typed = ref("");
const busy = ref(false);

function start() {
  typed.value = "";
  open.value = true;
}

async function doReset() {
  if (typed.value.trim().toUpperCase() !== "RESET") return;
  busy.value = true;
  try {
    const res = await api("/finance/reset", { method: "POST", body: { confirm: "RESET" } });
    const c = res.data ?? {};
    open.value = false;
    ui.toast(`Data dinolkan: ${c.bills ?? 0} pesanan, ${c.expenses ?? 0} biaya, ${c.journals ?? 0} jurnal dihapus`);
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    ui.toast(err.message, "error");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="mt-6 rounded-[20px] border border-destructive/30 bg-destructive/5 p-5 md:p-6">
    <h2 class="text-xl font-semibold">Mulai dari nol</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Untuk sebelum buka (go-live): hapus semua transaksi uji coba supaya laporan mulai dari 0.
    </p>
    <ul class="mt-3 grid gap-1 text-sm md:grid-cols-2">
      <li><span class="font-semibold text-destructive">Dihapus:</span> semua pesanan, pelanggan, biaya, jurnal (termasuk saldo awal &amp; aset), dan laporan shift lama.</li>
      <li><span class="font-semibold">Tetap:</span> menu &amp; harga, nomor meja, akun login, logo, dan daftar kas/bank (Kas, Petty cash, Bank BCA).</li>
    </ul>
    <Button variant="destructive" class="mt-4 h-11 rounded-xl px-5" @click="start">
      <RotateCcw class="size-4" /> Nolkan semua transaksi
    </Button>

    <Dialog v-model:open="open">
      <DialogContent class="p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">Nolkan semua transaksi?</DialogTitle>
          <DialogDescription class="text-[15px]">
            Semua pesanan, biaya, dan jurnal akan dihapus permanen dan <b>tidak bisa dikembalikan</b>. Menu, akun, dan kas/bank tetap ada.
          </DialogDescription>
        </DialogHeader>
        <label class="text-sm font-semibold" for="reset-confirm">Ketik <b>RESET</b> untuk lanjut</label>
        <input
          id="reset-confirm"
          v-model="typed"
          autocomplete="off"
          class="h-12 rounded-xl border bg-background px-4 text-base tracking-widest uppercase outline-none focus:ring-2 focus:ring-destructive/40"
          placeholder="RESET"
          @keyup.enter="doReset"
        />
        <div class="grid grid-cols-2 gap-2">
          <Button variant="secondary" class="h-12 rounded-xl text-base" @click="open = false">Batal</Button>
          <Button
            variant="destructive"
            class="h-12 rounded-xl text-base"
            :disabled="busy || typed.trim().toUpperCase() !== 'RESET'"
            @click="doReset"
          >
            {{ busy ? "Menghapus..." : "Nolkan" }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </section>
</template>
