<script setup>
import { Printer } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRp, number, dateTime, orderNo, orderTypeLabel, PAYMENT_LABELS, optionsText } from "@/lib/format";

defineProps({
  open: { type: Boolean, default: false },
  bill: { type: Object, default: null }, // from GET /bills/:billId
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  title: { type: String, default: "Pembayaran tercatat" },
});

const emit = defineEmits(["update:open", "printBill"]);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[88vh] overflow-y-auto p-8 sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-2xl font-bold">{{ title }}</DialogTitle>
        <DialogDescription class="text-[15px]">Cetak struk untuk pesanan ini.</DialogDescription>
      </DialogHeader>

      <p v-if="loading" class="text-sm text-muted-foreground">Memuat struk...</p>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

      <template v-else-if="bill">
        <div class="grid gap-1 text-[15px]">
          <p class="font-semibold">Pesanan {{ orderNo(bill.billId) }}</p>
          <p class="text-muted-foreground">
            {{ orderTypeLabel(bill.order_type) }}<template v-if="bill.table_code"> · No. {{ bill.table_code }}</template>
            <template v-if="bill.customer_name"> · {{ bill.customer_name }}</template>
          </p>
          <p class="text-muted-foreground">{{ dateTime(bill.paid_at ?? bill.created_at) }}</p>
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

        <div class="grid grid-cols-2 gap-3">
          <Button variant="secondary" class="h-12 rounded-xl text-base" @click="emit('update:open', false)">Tutup</Button>
          <Button class="h-12 rounded-xl text-base" @click="emit('printBill')"><Printer /> Cetak struk</Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
