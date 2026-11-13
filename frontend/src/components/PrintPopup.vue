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
  description: { type: String, default: "Struk dicetak 2 rangkap: untuk pelanggan dan untuk dapur." },
  reprintLabel: { type: String, default: "Cetak struk" },
  printed: { type: Number, default: -1 }, // jumlah struk yang sudah dicetak (-1 = tidak ditampilkan)
});

const emit = defineEmits(["update:open", "printBill"]);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
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
          <!-- Sebelum 2 struk tercetak, tombol cetak jadi aksi utama -->
          <Button
            :variant="printed >= 0 && printed < 2 ? 'default' : 'secondary'"
            class="h-12 rounded-xl text-base"
            @click="emit('printBill')"
          >
            <Printer /> {{ reprintLabel }}
            <span v-if="printed >= 0 && printed < 2" class="tabular ml-1 opacity-80">({{ printed + 1 }}/2)</span>
          </Button>
          <Button :variant="printed >= 0 && printed < 2 ? 'secondary' : 'default'" class="h-12 rounded-xl text-base" @click="emit('update:open', false)">Selesai</Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
