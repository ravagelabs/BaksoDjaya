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
  return `${h}h ${m}m`;
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>End shift</DialogTitle>
        <DialogDescription>Review your shift before logging out.</DialogDescription>
      </DialogHeader>

      <p v-if="loading" class="text-sm text-muted-foreground">Loading shift...</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
      <template v-else>
        <dl class="grid grid-cols-2 gap-y-2 text-sm">
          <dt class="text-muted-foreground">Shift start</dt>
          <dd class="text-right">{{ formatDate(createdAt) }}</dd>
          <dt class="text-muted-foreground">Shift end</dt>
          <dd class="text-right">{{ formatDate(endedAt) }}</dd>
          <dt class="text-muted-foreground">Duration</dt>
          <dd class="text-right font-semibold">{{ duration }}</dd>
        </dl>

        <section class="border-t pt-3">
          <h3 class="mb-2 text-sm font-semibold">SALES SUMMARY</h3>
          <dl class="grid grid-cols-2 gap-y-2 text-sm">
            <dt class="text-muted-foreground">CASH</dt>
            <dd class="text-right">{{ rupiah.format(summary.cash) }}</dd>
            <dt class="text-muted-foreground">CARD</dt>
            <dd class="text-right">{{ rupiah.format(summary.card) }}</dd>
            <dt class="text-muted-foreground">QRIS</dt>
            <dd class="text-right">{{ rupiah.format(summary.qris) }}</dd>
            <dt class="border-t pt-2 font-semibold">TOTAL</dt>
            <dd class="border-t pt-2 text-right font-semibold">{{ rupiah.format(summary.total) }}</dd>
          </dl>
        </section>
      </template>

      <p v-if="unsavedItems > 0" class="text-sm text-destructive">
        You still have {{ unsavedItems }} unsaved item(s) in the current order. Logging out will discard them.
      </p>

      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button :disabled="loading" @click="emit('confirm-logout')">Log out</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>