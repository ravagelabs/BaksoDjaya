<script setup>
import { computed } from "vue";
import { Button } from "@/components/ui/button";

const props = defineProps({
  id: { type: [Number, String], required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
});

const emit = defineEmits(["removeProduct"]);

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const subtotal = computed(() => rupiah.format(props.price * props.quantity));
</script>

<template>
  <div class="flex items-center justify-between rounded-md border p-3">
    <div>
      <p class="text-sm font-medium">{{ name }}</p>
      <p class="text-xs text-muted-foreground">{{ rupiah.format(price) }} × {{ quantity }}</p>
    </div>
    <div class="flex items-center gap-3">
      <p class="text-sm font-semibold">{{ subtotal }}</p>
      <Button variant="outline" size="sm" @click="emit('removeProduct', id)">X</Button>
    </div>
  </div>
</template>