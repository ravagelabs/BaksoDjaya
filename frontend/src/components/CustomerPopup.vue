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
  { value: "dine_in", label: "Makan di tempat" },
  { value: "pickup", label: "Bungkus" },
  { value: "delivery", label: "Delivery" },
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
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="text-xl">Pelanggan</DialogTitle>
        <DialogDescription>Pilih pelanggan yang sudah ada atau tambahkan yang baru.</DialogDescription>
      </DialogHeader>

      <div class="grid gap-2">
        <p class="text-sm font-semibold">Pelanggan tersimpan</p>
        <p v-if="loading" class="text-sm text-muted-foreground">Memuat pelanggan...</p>
        <p v-else-if="!customers.length" class="text-sm text-muted-foreground">Belum ada pelanggan.</p>
        <div v-else class="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
          <button
            v-for="c in customers"
            :key="c.id"
            type="button"
            class="flex min-h-12 items-center justify-between rounded-xl bg-muted/60 px-4 text-left text-[15px] transition-colors hover:bg-secondary"
            @click="emit('selectCustomer', c)"
          >
            <span class="font-medium">{{ c.name }}</span>
            <span class="text-xs text-muted-foreground">{{ [c.telp, TYPES.find((t) => t.value === c.type)?.label].filter(Boolean).join(" · ") }}</span>
          </button>
        </div>
      </div>

      <form class="grid gap-4 border-t pt-4" @submit.prevent="submit">
        <p class="text-sm font-semibold">Pelanggan baru</p>
        <div class="grid gap-2">
          <Label for="customer-name">Nama</Label>
          <Input id="customer-name" v-model="name" class="h-12 rounded-xl text-base" required />
        </div>
        <div class="grid gap-2">
          <Label for="customer-telp">No. telepon</Label>
          <Input id="customer-telp" v-model="telp" type="tel" class="h-12 rounded-xl text-base" required />
        </div>
        <div class="grid gap-2">
          <Label>Tipe</Label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="t in TYPES"
              :key="t.value"
              type="button"
              class="h-12 rounded-xl border text-[15px] font-medium transition-colors"
              :class="type === t.value ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted'"
              @click="type = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" class="h-12 rounded-xl text-base" :disabled="saving">{{ saving ? "Menyimpan..." : "Simpan pelanggan" }}</Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
