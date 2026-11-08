<script setup>
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  createdAt: { type: [String, Date], default: null }, // session start
  endedAt: { type: [String, Date], default: null }, // current time when popup opened
  summary: {
    type: Object,
    default: () => ({ cash: 0, card: 0, qris: 0, total: 0 }),
  },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  unsavedItems: { type: Number, default: 0 }, // items still in the cart
});

const emit = defineEmits(["confirm-logout"]);

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (d) => (d ? fmt.format(new Date(d)) : "-");

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const duration = computed(() => {
  if (!props.createdAt || !props.endedAt) return "-";
  const ms = new Date(props.endedAt) - new Date(props.createdAt);
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? `${h} jam ${m} menit` : `${m} menit`;
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-xl">Akhiri shift</DialogTitle>
        <DialogDescription>Periksa ringkasan shift sebelum keluar.</DialogDescription>
      </DialogHeader>

      <p v-if="loading" class="text-sm text-muted-foreground">Memuat shift...</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
      <template v-else>
        <dl class="grid grid-cols-2 gap-y-2 text-[15px]">
          <dt class="text-muted-foreground">Mulai</dt>
          <dd class="text-right">{{ formatDate(createdAt) }}</dd>
          <dt class="text-muted-foreground">Selesai</dt>
          <dd class="text-right">{{ formatDate(endedAt) }}</dd>
          <dt class="text-muted-foreground">Durasi</dt>
          <dd class="text-right font-semibold">{{ duration }}</dd>
        </dl>

        <section class="rounded-xl bg-muted/60 p-4">
          <h3 class="mb-3 text-sm font-semibold text-muted-foreground">Ringkasan penjualan</h3>
          <dl class="tabular grid grid-cols-2 gap-y-2 text-[15px]">
            <dt class="text-muted-foreground">Tunai</dt>
            <dd class="text-right">{{ rupiah.format(summary.cash) }}</dd>
            <dt class="text-muted-foreground">Kartu</dt>
            <dd class="text-right">{{ rupiah.format(summary.card) }}</dd>
            <dt class="text-muted-foreground">QRIS</dt>
            <dd class="text-right">{{ rupiah.format(summary.qris) }}</dd>
            <dt class="border-t pt-2 font-semibold">Total</dt>
            <dd class="border-t pt-2 text-right text-lg font-bold">{{ rupiah.format(summary.total) }}</dd>
          </dl>
        </section>
      </template>

      <p v-if="unsavedItems > 0" class="rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
        Masih ada {{ unsavedItems }} item di pesanan yang belum disimpan. Keluar akan membuangnya.
      </p>

      <DialogFooter class="gap-2">
        <Button variant="secondary" class="h-12 flex-1 rounded-xl" @click="open = false">Batal</Button>
        <Button class="h-12 flex-1 rounded-xl" :disabled="loading" @click="emit('confirm-logout')">Simpan shift & keluar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
