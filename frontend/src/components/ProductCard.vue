<script setup>
import { computed } from "vue";
import { Plus } from "@lucide/vue";
import { formatRp, titleCase } from "@/lib/format";
import MenuImage from "@/components/MenuImage.vue";

const props = defineProps({
  product: { type: Object, required: true }, // item dari catalog.gridProducts
});

const emit = defineEmits(["open", "quickAdd"]);

const disabled = computed(() => !props.product.is_available);
</script>

<template>
  <div
    class="group relative flex flex-col overflow-hidden rounded-[18px] border bg-card p-2.5 transition"
    :class="disabled ? 'opacity-60' : 'hover:border-primary/30 hover:shadow-card'"
  >
    <button
      type="button"
      class="flex flex-1 flex-col text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 rounded-xl"
      :disabled="disabled"
      :aria-label="`Sesuaikan ${titleCase(product.name)}`"
      @click="emit('open', product)"
    >
      <div class="relative overflow-hidden rounded-xl bg-[#f6efe7]">
        <MenuImage :src="product.picture" :name="titleCase(product.name)" />
        <span
          v-if="disabled"
          class="absolute top-2 left-2 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs"
        >
          Stok habis
        </span>
      </div>
      <p class="mt-3 line-clamp-2 pr-12 pl-1.5 text-[17px] font-semibold leading-snug">{{ titleCase(product.name) }}</p>
      <p class="tabular mt-1 pr-12 pl-1.5 pb-1 text-[15px] text-muted-foreground">
        <span v-if="product.isPaket">mulai </span>{{ formatRp(product.price) }}
      </p>
    </button>
    <button
      type="button"
      class="absolute right-3.5 bottom-3.5 flex size-11 items-center justify-center rounded-full bg-secondary text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none"
      :disabled="disabled"
      :aria-label="`Tambah ${titleCase(product.name)}`"
      @click="emit('quickAdd', product)"
    >
      <Plus class="size-5" />
    </button>
  </div>
</template>
