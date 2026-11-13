<script setup>
import { ref, watch } from "vue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useOrderStore } from "@/stores/order";

// Nomor pager untuk pesanan dine-in: pelanggan pegang nomornya, nomor berbunyi saat pesanan siap
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

// Nomor yang dipakai pesanan lain tidak bisa dipilih
const taken = (t) => t.bill_id && t.bill_id !== order.billId;

// Ketuk nomor = langsung dipakai, dialog ditutup
function pick(t) {
  tableId.value = t.id;
  save();
}

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
        <DialogTitle class="text-2xl font-bold">Pilih nomor</DialogTitle>
        <DialogDescription class="text-[15px]">Berikan nomor ini ke pelanggan. Nomor yang sedang dipakai tidak bisa dipilih.</DialogDescription>
      </DialogHeader>

      <div>
        <p v-if="loading" class="text-sm text-muted-foreground">Memuat nomor...</p>
        <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
        <div v-else class="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
          <button
            v-for="t in tables"
            :key="t.id"
            type="button"
            class="flex h-20 flex-col items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            :class="tableId === t.id ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted/50'"
            :disabled="taken(t)"
            @click="pick(t)"
          >
            <span class="tabular text-2xl font-bold">{{ t.code }}</span>
            <span class="text-[11px] text-muted-foreground">{{ taken(t) ? "Dipakai" : "Tersedia" }}</span>
          </button>
        </div>
      </div>

    </DialogContent>
  </Dialog>
</template>
