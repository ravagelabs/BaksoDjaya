<script setup>
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { orderNo } from "@/lib/format";

// Nomor pager untuk pesanan yang sudah dibayar: pelanggan pegang nomornya,
// nomor berbunyi saat pesanan siap, lalu dikembalikan ke kasir.
const props = defineProps({
  open: { type: Boolean, default: false },
  billId: { type: Number, default: null },
});
const emit = defineEmits(["update:open", "picked", "skip"]);

const tables = ref([]);
const loading = ref(false);
const error = ref("");
const saving = ref(null); // id nomor yang sedang disimpan

async function load() {
  loading.value = true;
  error.value = "";
  try {
    tables.value = (await api("/tables")).data;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) load();
  },
  { immediate: true }
);

// Nomor yang dipakai pesanan lain tidak bisa dipilih
const taken = (t) => t.bill_id && t.bill_id !== props.billId;

// Ketuk nomor = langsung dipakai, dialog ditutup
async function pick(t) {
  if (saving.value || !props.billId) return;
  saving.value = t.id;
  error.value = "";
  try {
    await api(`/tables/${t.id}/assign`, { method: "POST", body: { billId: props.billId } });
    emit("picked", t);
  } catch (e) {
    error.value = e.message;
    load(); // nomor mungkin baru saja dipakai kasir lain
  } finally {
    saving.value = null;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="!$event && emit('skip')">
    <DialogContent class="max-h-[90vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-8">
      <DialogHeader>
        <DialogTitle class="text-2xl font-bold">Beri nomor ke pelanggan</DialogTitle>
        <DialogDescription class="text-[15px]">
          Pesanan {{ orderNo(billId) }} sudah lunas dan masuk dapur. Ketuk nomor pager yang diberikan ke pelanggan.
        </DialogDescription>
      </DialogHeader>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-if="loading && !tables.length" class="text-sm text-muted-foreground">Memuat nomor...</p>
      <div v-else class="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        <button
          v-for="t in tables"
          :key="t.id"
          type="button"
          class="flex h-20 flex-col items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed"
          :class="taken(t) ? 'bg-muted/60 text-muted-foreground opacity-55' : 'bg-card hover:border-primary hover:bg-secondary'"
          :disabled="taken(t) || saving !== null"
          @click="pick(t)"
        >
          <span class="tabular text-2xl font-bold">{{ t.code }}</span>
          <span class="text-[11px] text-muted-foreground">{{ saving === t.id ? "Menyimpan..." : taken(t) ? "Dipakai" : "Tersedia" }}</span>
        </button>
      </div>

      <Button variant="secondary" class="h-12 rounded-xl text-base" :disabled="saving !== null" @click="emit('skip')">
        Lanjut tanpa nomor
      </Button>
    </DialogContent>
  </Dialog>
</template>
