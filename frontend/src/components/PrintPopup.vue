<script setup>
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

defineProps({
  open: { type: Boolean, default: false },
  bill: { type: Object, default: null }, // from GET /bills/:billId
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const emit = defineEmits(["update:open", "printBill"]);

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const formatDate = (iso) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Print bill</DialogTitle>
        <DialogDescription>Payment recorded. Print the receipt for this bill.</DialogDescription>
      </DialogHeader>

      <p v-if="loading" class="text-sm text-muted-foreground">Loading bill...</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

      <template v-else-if="bill">
        <div class="grid gap-1 text-sm">
          <p><span class="text-muted-foreground">Bill:</span> #{{ bill.billId }}</p>
          <p><span class="text-muted-foreground">Customer:</span> {{ bill.customer_name ?? "-" }}</p>
          <p><span class="text-muted-foreground">Customer ID:</span> {{ bill.customer_id ?? "-" }}</p>
          <p><span class="text-muted-foreground">Created at:</span> {{ formatDate(bill.created_at) }}</p>
        </div>

        <div class="flex flex-col gap-1 border-y py-2">
          <div v-for="item in bill.billItems" :key="item.id" class="flex justify-between text-sm">
            <span>{{ item.name }} × {{ item.qty }}</span>
            <span>{{ rupiah.format(item.price * item.qty) }}</span>
          </div>
        </div>

        <p class="text-right font-semibold">Total: {{ rupiah.format(bill.grand_total) }}</p>

        <div class="flex gap-2">
          <Button class="flex-1" variant="outline" @click="emit('update:open', false)">Close</Button>
          <Button class="flex-1" @click="emit('printBill')">Print</Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>