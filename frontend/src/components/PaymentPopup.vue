<script setup>
import { ref, computed, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const props = defineProps({
  open: { type: Boolean, default: false },
  totalBill: { type: Number, required: true },
  saving: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const emit = defineEmits(["update:open", "saveBill"]);

const METHODS = [
  { value: "qris", label: "QRIS" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
];

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const paymentMethod = ref("qris");
const payment = ref(""); // cash handed over (input)

// change = payment - totalBill
const change = computed(() => (Number(payment.value) || 0) - props.totalBill);

const canConfirm = computed(
  () => paymentMethod.value !== "cash" || (Number(payment.value) || 0) >= props.totalBill
);

// Fresh state every time the popup opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      paymentMethod.value = "qris";
      payment.value = "";
    }
  }
);

function confirm() {
  emit("saveBill", paymentMethod.value);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Payment</DialogTitle>
        <DialogDescription>Total bill: {{ rupiah.format(totalBill) }}</DialogDescription>
      </DialogHeader>

      <div class="grid gap-4">
        <div class="grid gap-2">
          <Label>Payment method</Label>
          <div class="flex gap-2">
            <Button
              v-for="m in METHODS"
              :key="m.value"
              type="button"
              size="sm"
              :variant="paymentMethod === m.value ? 'default' : 'outline'"
              @click="paymentMethod = m.value"
            >
              {{ m.label }}
            </Button>
          </div>
        </div>

        <!-- Cash only -->
        <template v-if="paymentMethod === 'cash'">
          <div class="grid gap-2">
            <Label for="payment">Payment</Label>
            <Input id="payment" v-model="payment" type="number" min="0" inputmode="numeric" />
          </div>
          <div class="grid gap-2">
            <Label for="change">Change</Label>
            <Input id="change" :model-value="rupiah.format(Math.max(change, 0))" readonly />
            <p v-if="payment !== '' && change < 0" class="text-sm text-destructive">
              Short by {{ rupiah.format(-change) }}
            </p>
          </div>
        </template>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <Button :disabled="saving || !canConfirm" @click="confirm">
          {{ saving ? "Saving..." : "Confirm" }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>