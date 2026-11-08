<script setup>
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { OUTLET_NAME } from "@/lib/format";

defineProps({
  failed: { type: Boolean, default: false },
});
const emit = defineEmits(["retry"]);

const iconFailed = ref(false);
// Dibaca saat runtime dari public/brand, bukan di-bundle
const ICON_SRC = "/brand/ravage-icon-silver.png";
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center gap-8 bg-card p-6" role="status" aria-live="polite">
    <img
      v-if="!iconFailed"
      :src="ICON_SRC"
      alt=""
      class="h-24 w-auto select-none"
      :class="failed ? 'opacity-40' : 'animate-r-pulse'"
      draggable="false"
      @error="iconFailed = true"
    />
    <span
      v-else
      class="text-7xl font-black text-muted-foreground/60"
      :class="failed ? 'opacity-40' : 'animate-r-pulse'"
    >R</span>

    <div class="flex w-64 flex-col items-center gap-4">
      <p class="text-xl font-semibold">{{ failed ? "Kasir gagal dimuat" : "Menyiapkan kasir" }}</p>
      <div v-if="!failed" class="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div class="animate-bar-slide h-full w-2/5 rounded-full bg-primary" />
      </div>
      <Button v-else class="h-12 w-full rounded-xl" @click="emit('retry')">Coba lagi</Button>
      <p class="text-sm text-muted-foreground">{{ OUTLET_NAME }}</p>
    </div>
  </div>
</template>
