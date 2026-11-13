<script setup>
import { Printer } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRp, number, orderNo, orderTypeLabel, optionsText, timeOnly, OUTLET_NAME } from "@/lib/format";

// Pratinjau nota pesanan / nota dapur
defineProps({
  open: { type: Boolean, default: false },
  bill: { type: Object, default: null },
  title: { type: String, default: "Nota pesanan" },
  description: { type: String, default: "Simpan nota sampai pelanggan membayar." },
  updated: { type: Boolean, default: false },
});
const emit = defineEmits(["update:open", "print"]);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90vh] overflow-y-auto p-8 sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-2xl font-bold">{{ title }}</DialogTitle>
        <DialogDescription class="text-[15px]">{{ description }}</DialogDescription>
      </DialogHeader>

      <div v-if="bill" class="rounded-xl border border-dashed bg-[#fbfaf8] px-5 py-5 font-mono text-[13px] leading-relaxed">
        <div class="text-center">
          <p class="font-semibold">{{ OUTLET_NAME.toUpperCase() }}</p>
          <p>{{ updated ? "NOTA PESANAN (DIPERBARUI)" : "NOTA PESANAN" }}</p>
          <p class="my-1 text-2xl font-bold tracking-wide">
            {{ bill.table_code ? `NO. ${bill.table_code}` : orderTypeLabel(bill.order_type).toUpperCase() }}
          </p>
          <p>Pesanan {{ orderNo(bill.billId) }} · {{ timeOnly(bill.sent_to_kitchen_at ?? bill.created_at) }}</p>
        </div>
        <p v-if="bill.guests || bill.customer_name" class="mt-2 border-t border-dashed pt-2">
          <span v-if="bill.guests">Tamu: {{ bill.guests }} orang</span>
          <span v-if="bill.guests && bill.customer_name"> · </span>
          <span v-if="bill.customer_name">{{ bill.customer_name }}</span>
        </p>
        <ul class="mt-2 border-t border-dashed pt-2">
          <li v-for="i in bill.billItems" :key="i.id" class="py-1">
            <div class="flex justify-between gap-3">
              <span class="font-semibold">{{ i.qty }}x {{ i.name }}</span>
              <span class="tabular shrink-0">{{ number.format(i.price * i.qty) }}</span>
            </div>
            <p v-if="i.options?.length" class="pl-6 text-muted-foreground">{{ optionsText(i.options) }}</p>
            <p v-if="i.note" class="pl-6 text-muted-foreground">Catatan: {{ i.note }}</p>
          </li>
        </ul>
        <p v-if="bill.note" class="border-t border-dashed pt-2">Catatan pesanan: {{ bill.note }}</p>
        <div class="mt-2 flex justify-between border-t border-dashed pt-2 font-bold">
          <span>{{ bill.status === "paid" ? "TOTAL" : "TOTAL SEMENTARA" }}</span>
          <span class="tabular">{{ formatRp(bill.grand_total) }}</span>
        </div>
        <p class="mt-2 text-center">{{ bill.status === "paid" ? "LUNAS" : "BELUM DIBAYAR" }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <Button variant="secondary" class="h-12 rounded-xl text-base" @click="emit('update:open', false)">Tutup</Button>
        <Button class="h-12 rounded-xl text-base" @click="emit('print')"><Printer /> Cetak nota</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
