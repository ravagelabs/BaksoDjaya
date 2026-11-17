<script setup>
import { computed } from "vue";
import { groupSold } from "@/lib/format";

// Rekap menu terjual (per paket + isinya) untuk laporan shift
const props = defineProps({ items: { type: Array, default: () => [] } });
const groups = computed(() => groupSold(props.items));
const totalQty = computed(() => groups.value.reduce((t, g) => t + g.qty, 0));
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-[16px] font-semibold">Menu terjual</h3>
      <span class="tabular text-sm text-muted-foreground">{{ totalQty }} porsi</span>
    </div>
    <p v-if="!groups.length" class="mt-2 text-[15px] text-muted-foreground">Belum ada.</p>
    <ul v-else class="mt-2 flex flex-col divide-y">
      <li v-for="g in groups" :key="g.title" class="py-2.5">
        <p class="tabular flex items-baseline justify-between gap-3 text-[16px] font-semibold">
          <span>{{ g.title }}</span><span>{{ g.qty }}</span>
        </p>
        <p v-for="v in g.variants" :key="v.detail" class="tabular flex justify-between gap-3 pl-3 text-sm text-muted-foreground">
          <span>{{ v.detail }}</span><span>{{ v.qty }}</span>
        </p>
      </li>
    </ul>
  </div>
</template>
