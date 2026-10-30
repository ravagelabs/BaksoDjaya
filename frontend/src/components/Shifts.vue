<script setup>
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const open = defineModel("open", { type: Boolean, default: false });

defineProps({
  shifts: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (d) => (d ? fmt.format(new Date(d)) : "-");

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function duration(start, end) {
  const totalMinutes = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 60000));
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Shifts</DialogTitle>
        <DialogDescription>Previous shifts and their sales summary.</DialogDescription>
      </DialogHeader>

      <p v-if="loading" class="text-sm text-muted-foreground">Loading shifts...</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-else-if="!shifts.length" class="text-sm text-muted-foreground">No shifts yet.</p>

      <ul v-else class="flex flex-col gap-3">
        <li v-for="s in shifts" :key="s.id" class="rounded-md border p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="font-semibold">Shift #{{ s.id }}</span>
            <span class="text-muted-foreground">{{ duration(s.created_at, s.ended_at) }}</span>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ formatDate(s.created_at) }} - {{ formatDate(s.ended_at) }}
          </p>

          <dl class="mt-2 grid grid-cols-2 gap-y-1 border-t pt-2">
            <dt class="text-muted-foreground">CASH</dt>
            <dd class="text-right">{{ rupiah.format(s.cash) }}</dd>
            <dt class="text-muted-foreground">CARD</dt>
            <dd class="text-right">{{ rupiah.format(s.card) }}</dd>
            <dt class="text-muted-foreground">QRIS</dt>
            <dd class="text-right">{{ rupiah.format(s.qris) }}</dd>
            <dt class="font-semibold">TOTAL</dt>
            <dd class="text-right font-semibold">{{ rupiah.format(s.total) }}</dd>
          </dl>
        </li>
      </ul>
    </DialogContent>
  </Dialog>
</template>