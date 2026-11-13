<script setup>
import { ref, watch, computed } from "vue";
import { Check, ChefHat, Printer } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRp, number, dateTime, orderNo, orderTypeLabel, PAYMENT_LABELS, optionsText } from "@/lib/format";

const props = defineProps({
  open: { type: Boolean, default: false },
  bill: { type: Object, default: null }, // from GET /bills/:billId
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  title: { type: String, default: "Pembayaran tercatat" },
  description: { type: String, default: "Cetak berurutan: struk pelanggan dulu, lalu struk dapur." },
  reprintLabel: { type: String, default: "Cetak struk" },
  kitchen: { type: Boolean, default: false }, // tampilkan tombol "Struk dapur" terpisah
  sequential: { type: Boolean, default: false }, // wajib urut: pelanggan → dapur → selesai (setelah bayar)
});

const emit = defineEmits(["update:open", "printBill", "printKitchen"]);

// Alur berurutan supaya tidak ada struk yang kelewat: 1) struk pelanggan → 2) struk dapur → Selesai
const printedBill = ref(false);
const printedKitchen = ref(false);
watch(
  () => [props.open, props.bill?.billId],
  () => {
    printedBill.value = false;
    printedKitchen.value = false;
  }
);
const step = computed(() => (!printedBill.value ? 1 : !printedKitchen.value ? 2 : 3));

// Mode urut: popup tidak bisa ditutup (X / klik luar) sebelum 2 struk tercetak
function onOpenChange(value) {
  if (!value && props.sequential && props.bill && step.value !== 3) return;
  emit("update:open", value);
}

function doBill() {
  emit("printBill");
  printedBill.value = true;
}
function doKitchen() {
  emit("printKitchen");
  printedKitchen.value = true;
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="max-h-[88vh] overflow-y-auto p-8 sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-2xl font-bold">{{ title }}</DialogTitle>
        <DialogDescription class="text-[15px]">{{ description }}</DialogDescription>
      </DialogHeader>

      <p v-if="loading" class="text-sm text-muted-foreground">Memuat struk...</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

      <template v-else-if="bill">
        <div class="flex items-center gap-4">
          <div v-if="bill.table_code" class="flex size-[4.5rem] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <span class="text-[11px] leading-none opacity-70">Nomor</span>
            <span class="tabular mt-1 text-3xl font-bold leading-none">{{ bill.table_code }}</span>
          </div>
          <div class="grid min-w-0 gap-1 text-[15px]">
            <p class="font-semibold">Pesanan {{ orderNo(bill.billId) }}</p>
            <p class="truncate text-muted-foreground">
              {{ orderTypeLabel(bill.order_type) }}<template v-if="bill.customer_name"> · {{ bill.customer_name }}</template>
            </p>
            <p class="text-muted-foreground">{{ dateTime(bill.paid_at ?? bill.created_at) }}</p>
          </div>
        </div>

        <ul class="flex flex-col gap-2 border-y py-4">
          <li v-for="item in bill.billItems" :key="item.id" class="text-[15px]">
            <div class="flex justify-between gap-3">
              <span>{{ item.qty }}x {{ item.name }}</span>
              <span class="tabular">{{ number.format(item.price * item.qty) }}</span>
            </div>
            <p v-if="item.options?.length || item.note" class="text-sm text-muted-foreground">
              {{ [optionsText(item.options), item.note].filter(Boolean).join(" · ") }}
            </p>
          </li>
        </ul>

        <div class="flex items-end justify-between">
          <span class="text-muted-foreground">
            Total<template v-if="bill.payment_method"> · {{ PAYMENT_LABELS[bill.payment_method] }}</template>
          </span>
          <span class="tabular text-2xl font-bold">{{ formatRp(bill.grand_total) }}</span>
        </div>

        <div class="grid gap-3">
          <template v-if="kitchen">
            <!-- Langkah 1: struk pelanggan -->
            <Button
              :variant="sequential && step === 1 ? 'default' : 'secondary'"
              class="h-14 justify-start gap-3 rounded-xl px-5 text-base font-semibold"
              @click="doBill"
            >
              <span class="flex size-7 items-center justify-center rounded-full text-sm" :class="printedBill ? 'bg-success text-white' : sequential && step === 1 ? 'bg-white/25' : 'bg-black/10'">
                <Check v-if="printedBill" class="size-4" /><template v-else>1</template>
              </span>
              <Printer class="size-5" /> {{ printedBill ? "Struk pelanggan tercetak" : "Cetak struk pelanggan" }}
              <span v-if="printedBill" class="ml-auto text-sm font-normal opacity-70">cetak ulang</span>
            </Button>
            <!-- Langkah 2: struk dapur (aktif setelah struk pelanggan) -->
            <Button
              :variant="sequential && step === 2 ? 'default' : 'secondary'"
              class="h-14 justify-start gap-3 rounded-xl px-5 text-base font-semibold"
              :disabled="sequential && !printedBill"
              @click="doKitchen"
            >
              <span class="flex size-7 items-center justify-center rounded-full text-sm" :class="printedKitchen ? 'bg-success text-white' : sequential && step === 2 ? 'bg-white/25' : 'bg-black/10'">
                <Check v-if="printedKitchen" class="size-4" /><template v-else>2</template>
              </span>
              <ChefHat class="size-5" /> {{ printedKitchen ? "Struk dapur tercetak" : "Cetak struk dapur" }}
              <span v-if="printedKitchen" class="ml-auto text-sm font-normal opacity-70">cetak ulang</span>
            </Button>
            <!-- Selesai setelah dua struk tercetak -->
            <Button
              :variant="step === 3 || !sequential ? 'default' : 'secondary'"
              class="h-12 rounded-xl text-base"
              :disabled="sequential && step !== 3"
              @click="emit('update:open', false)"
            >
              {{ step === 3 || !sequential ? "Selesai" : "Selesai (cetak 2 struk dulu)" }}
            </Button>
          </template>
          <template v-else>
            <Button variant="secondary" class="h-12 rounded-xl text-base" @click="emit('printBill')"><Printer /> {{ reprintLabel }}</Button>
            <Button class="h-12 rounded-xl text-base" @click="emit('update:open', false)">Selesai</Button>
          </template>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
