<script setup>
import { Share, FileText, Sheet } from "@lucide/vue";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Tombol bagikan kecil ala iOS di pojok judul halaman: Unduh PDF / Excel.
// items: [{ label, icon: "pdf" | "excel", action, disabled }]
const props = defineProps({
  items: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
});
const icons = { pdf: FileText, excel: Sheet };
const btn =
  "flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-muted/70 active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40";
</script>

<template>
  <button
    v-if="props.items.length === 1"
    type="button"
    :class="btn"
    :disabled="disabled || props.items[0].disabled"
    :aria-label="props.items[0].label"
    :title="props.items[0].label"
    @click="props.items[0].action()"
  >
    <Share class="size-5" />
  </button>
  <DropdownMenu v-else>
    <DropdownMenuTrigger :class="btn" :disabled="disabled" aria-label="Unduh laporan" title="Unduh laporan">
      <Share class="size-5" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuItem
        v-for="it in props.items"
        :key="it.label"
        class="h-11 gap-3 text-[15px]"
        :disabled="it.disabled"
        @select="it.action()"
      >
        <component :is="icons[it.icon] ?? FileText" class="size-4" /> {{ it.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
