<script setup>
import { ref, watch } from "vue";
import { Minus, Plus } from "@lucide/vue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useOrderStore } from "@/stores/order";

// Meja dan jumlah tamu untuk pesanan dine-in
const props = defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(["update:open"]);

const order = useOrderStore();
const tables = ref([]);
const loading = ref(false);
const error = ref("");

const tableId = ref(null);
const guests = ref(null);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    tableId.value = order.table?.id ?? null;
    guests.value = order.guests;
    loading.value = true;
    error.value = "";
    try {
      tables.value = (await api("/tables")).data;
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }
);

// Meja yang dipakai pesanan lain tidak bisa dipilih
const taken = (t) => t.bill_id && t.bill_id !== order.billId;

function save() {
  const t = tables.value.find((x) => x.id === tableId.value);
  order.setTable(t ?? null);
  order.setGuests(guests.value);
  emit("update:open", false);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[90vh] overflow-y-auto p-8 sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="text-2xl font-bold">Pilih meja</DialogTitle>
        <DialogDescription class="text-[15px]">Meja yang sedang dipakai pesanan lain tidak bisa dipilih.</DialogDescription>
      </DialogHeader>

      <div>
        <p v-if="loading" class="text-sm text-muted-foreground">Memuat meja...</p>
        <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
        <div v-else class="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
          <button
            v-for="t in tables"
            :key="t.id"
            type="button"
            class="flex h-16 flex-col items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            :class="tableId === t.id ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted/50'"
            :disabled="taken(t)"
            @click="tableId = tableId === t.id ? null : t.id"
          >
            <span class="text-xl font-bold">{{ t.code }}</span>
            <span class="text-[11px] text-muted-foreground">{{ taken(t) ? "Terisi" : `${t.seats} kursi` }}</span>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Jumlah tamu</h3>
          <p class="text-sm text-muted-foreground">Opsional</p>
        </div>
        <div class="flex h-14 w-40 items-center justify-between rounded-xl bg-muted px-2">
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-lg hover:bg-card disabled:opacity-40"
            :disabled="!guests"
            aria-label="Kurangi tamu"
            @click="guests = guests > 1 ? guests - 1 : null"
          >
            <Minus class="size-5" />
          </button>
          <span class="tabular text-xl font-semibold">{{ guests ?? "-" }}</span>
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-lg hover:bg-card"
            aria-label="Tambah tamu"
            @click="guests = (guests ?? 0) + 1"
          >
            <Plus class="size-5" />
          </button>
        </div>
      </div>

      <Button class="h-14 rounded-xl text-lg" :disabled="!tableId" @click="save">Simpan meja</Button>
    </DialogContent>
  </Dialog>
</template>
