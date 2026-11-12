<script setup>
// Foto menu dengan cadangan rapi: kalau foto kosong atau gagal dimuat,
// tampilkan huruf awal nama menu (bukan ikon gambar rusak).
import { ref, watch, computed } from "vue";
import { assetUrl } from "@/lib/format";

const props = defineProps({
  src: { type: String, default: "" },
  name: { type: String, default: "" },
  lazy: { type: Boolean, default: true },
});

const failed = ref(false);
watch(() => props.src, () => (failed.value = false));

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || "?");
</script>

<template>
  <img
    v-if="src && !failed"
    :src="assetUrl(src)"
    :alt="name"
    class="aspect-[4/3] w-full object-cover"
    :loading="lazy ? 'lazy' : 'eager'"
    @error="failed = true"
  />
  <div
    v-else
    class="flex aspect-[4/3] w-full items-center justify-center bg-[#f6efe7] text-4xl font-bold text-[#c9b8a6] select-none"
    role="img"
    :aria-label="name"
  >
    {{ initial }}
  </div>
</template>
