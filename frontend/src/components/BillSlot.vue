<script setup>
import { computed } from "vue";
import { Button } from "@/components/ui/button";

const props = defineProps({
  customerName: { type: String, default: null },
  creationDate: { type: String, required: true }, // ISO string
  grandTotal: { type: Number, required: true },
});

const emit = defineEmits(["replaceBill"]);

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const formattedDate = computed(() =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(props.creationDate))
);
</script>

<template>
  <div class="flex items-center justify-between rounded-md border p-3">
    <div>
      <p class="text-sm font-medium">{{ customerName ?? "No customer" }}</p>
      <p class="text-xs text-muted-foreground">{{ formattedDate }}</p>
    </div>
    <div class="flex items-center gap-3">
      <p class="text-sm font-semibold">{{ rupiah.format(grandTotal) }}</p>
      <Button variant="outline" size="sm" @click="emit('replaceBill')">Open</Button>
    </div>
  </div>
</template>