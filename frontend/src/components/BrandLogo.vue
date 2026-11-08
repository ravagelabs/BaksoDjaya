<script setup>
import { ref } from "vue";

// Logo Ravage POS dari frontend/public/brand. Kalau file belum ada, tampil wordmark teks.
const props = defineProps({
  variant: { type: String, default: "dark" }, // "dark" = di atas latar gelap (logo dibuat putih)
});

const failed = ref(false);
// Dibaca saat runtime dari public/brand, bukan di-bundle
const LOGO_SRC = "/brand/ravage-pos-light.png";
</script>

<template>
  <img
    v-if="!failed"
    :src="LOGO_SRC"
    alt="Ravage POS"
    class="h-7 w-auto select-none"
    :class="props.variant === 'dark' ? 'brightness-0 invert' : ''"
    draggable="false"
    @error="failed = true"
  />
  <span
    v-else
    class="flex items-baseline gap-1 font-black tracking-[0.12em] select-none"
    :class="props.variant === 'dark' ? 'text-white' : 'text-foreground'"
  >
    <span class="text-lg leading-none">RAVAGE</span>
    <span class="text-[10px] leading-none tracking-wider opacity-80">POS</span>
  </span>
</template>
