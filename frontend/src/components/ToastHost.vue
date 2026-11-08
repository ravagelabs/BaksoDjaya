<script setup>
import { CircleCheck, CircleAlert } from "@lucide/vue";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
</script>

<template>
  <div class="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
    <TransitionGroup
      enter-active-class="transition duration-200"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-200"
      leave-to-class="opacity-0"
    >
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="flex items-center gap-2 rounded-xl bg-nav px-4 py-3 text-sm font-medium text-nav-foreground shadow-float"
        role="status"
      >
        <CircleAlert v-if="t.tone === 'error'" class="size-4 text-red-300" />
        <CircleCheck v-else class="size-4 text-emerald-300" />
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>
