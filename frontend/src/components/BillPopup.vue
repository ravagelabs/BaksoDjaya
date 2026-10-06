<script setup>
import BillSlot from "@/components/BillSlot.vue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

defineProps({
  open: { type: Boolean, default: false },
  bills: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const emit = defineEmits(["update:open", "replaceBill"]);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Ongoing bills</DialogTitle>
        <DialogDescription>Bills that are still pending.</DialogDescription>
      </DialogHeader>

      <p v-if="loading" class="text-sm text-muted-foreground">Loading bills...</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-else-if="!bills.length" class="text-sm text-muted-foreground">No ongoing bills.</p>
      <div v-else class="flex flex-col gap-2">
        <BillSlot
          v-for="bill in bills"
          :key="bill.billId"
          :customer-name="bill.customer_name"
          :creation-date="bill.created_at"
          :grand-total="bill.grand_total"
          @replace-bill="emit('replaceBill', bill)"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>