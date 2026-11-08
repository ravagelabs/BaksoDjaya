<script setup>
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  confirmLabel: { type: String, default: "Lanjutkan" },
});
const emit = defineEmits(["update:open", "confirm"]);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="p-8 sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-xl font-bold">{{ title }}</DialogTitle>
        <DialogDescription v-if="description" class="text-[15px]">{{ description }}</DialogDescription>
      </DialogHeader>
      <div class="grid grid-cols-2 gap-3">
        <Button variant="secondary" class="h-12 rounded-xl text-base" @click="emit('update:open', false)">Batal</Button>
        <Button class="h-12 rounded-xl text-base" @click="emit('confirm')">{{ confirmLabel }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
