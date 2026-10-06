<script setup>
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const props = defineProps({
  open: { type: Boolean, default: false },
  customers: { type: Array, default: () => [] }, // from GET /customers
  loading: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const emit = defineEmits(["update:open", "saveCustomer", "selectCustomer"]);

const TYPES = [
  { value: "dine_in", label: "Dine in" },
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
];

const name = ref("");
const telp = ref("");
const type = ref("dine_in");

// Start with an empty form every time the popup opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      name.value = "";
      telp.value = "";
      type.value = "dine_in";
    }
  }
);

function submit() {
  emit("saveCustomer", { name: name.value.trim(), telp: telp.value.trim(), type: type.value });
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Customer</DialogTitle>
        <DialogDescription>Pick an existing customer or add a new one.</DialogDescription>
      </DialogHeader>

      <!-- Existing customers (GET /customers) -->
      <div class="grid gap-2">
        <p class="text-sm font-medium">Existing customers</p>
        <p v-if="loading" class="text-sm text-muted-foreground">Loading customers...</p>
        <p v-else-if="!customers.length" class="text-sm text-muted-foreground">No customers yet.</p>
        <div v-else class="flex max-h-40 flex-col gap-1 overflow-y-auto">
          <button
            v-for="c in customers"
            :key="c.id"
            type="button"
            class="flex items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-muted"
            @click="emit('selectCustomer', c)"
          >
            <span class="font-medium">{{ c.name }}</span>
            <span class="text-xs text-muted-foreground">{{ c.telp }} · {{ c.type }}</span>
          </button>
        </div>
      </div>

      <!-- New customer (POST /customers) -->
      <form class="grid gap-3 border-t pt-4" @submit.prevent="submit">
        <p class="text-sm font-medium">New customer</p>
        <div class="grid gap-2">
          <Label for="customer-name">Name</Label>
          <Input id="customer-name" v-model="name" required />
        </div>
        <div class="grid gap-2">
          <Label for="customer-telp">Telp</Label>
          <Input id="customer-telp" v-model="telp" type="tel" required />
        </div>
        <div class="grid gap-2">
          <Label>Type</Label>
          <div class="flex gap-2">
            <Button
              v-for="t in TYPES"
              :key="t.value"
              type="button"
              size="sm"
              :variant="type === t.value ? 'default' : 'outline'"
              @click="type = t.value"
            >
              {{ t.label }}
            </Button>
          </div>
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" :disabled="saving">{{ saving ? "Saving..." : "Save customer" }}</Button>
      </form>
    </DialogContent>
  </Dialog>
</template>