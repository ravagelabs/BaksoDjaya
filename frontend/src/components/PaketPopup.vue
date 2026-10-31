<script setup>
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";

const props = defineProps({
  open: { type: Boolean, default: false },
  base: { type: String, default: "" }, // e.g. "PAKET SIJI"
});
const emit = defineEmits(["update:open", "select"]);

const BAKSO_OPTIONS = ["BULAT", "URAT", "CAMPUR"];
const MIE_OPTIONS = ["MIE", "BIHUN"];

const bakso = ref(BAKSO_OPTIONS[0]);
const mie = ref(MIE_OPTIONS[0]);

// reset selection each time the popup opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      bakso.value = BAKSO_OPTIONS[0];
      mie.value = MIE_OPTIONS[0];
    }
  }
);

function close() {
  emit("update:open", false);
}

function confirm() {
  emit("select", { base: props.base, bakso: bakso.value, mie: mie.value });
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="close"
  >
    <div class="w-full max-w-sm rounded-lg bg-background p-5 shadow-lg">
      <h3 class="mb-4 text-lg font-semibold">{{ base }}</h3>

      <p class="mb-2 text-sm font-medium">Bakso</p>
      <div class="mb-4 grid grid-cols-3 gap-2">
        <button
          v-for="opt in BAKSO_OPTIONS"
          :key="opt"
          type="button"
          class="rounded-md border px-2 py-2 text-sm"
          :class="bakso === opt ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
          @click="bakso = opt"
        >
          {{ opt }}
        </button>
      </div>

      <p class="mb-2 text-sm font-medium">Mie</p>
      <div class="mb-5 grid grid-cols-2 gap-2">
        <button
          v-for="opt in MIE_OPTIONS"
          :key="opt"
          type="button"
          class="rounded-md border px-2 py-2 text-sm"
          :class="mie === opt ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
          @click="mie = opt"
        >
          {{ opt }}
        </button>
      </div>

      <div class="flex gap-2">
        <Button class="flex-1" variant="outline" @click="close">Cancel</Button>
        <Button class="flex-1" @click="confirm">Add to order</Button>
      </div>
    </div>
  </div>
</template>