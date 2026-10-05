<script setup>
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const props = defineProps({
  id: { type: [Number, String], required: true },
  name: { type: String, required: true },
  picture: { type: String, required: true },
  price: { type: Number, required: true },
});

const emit = defineEmits(["addProduct"]);

function add() {
  emit("addProduct", { id: props.id, name: props.name, price: props.price });
}
</script>

<template>
  <Card class="overflow-hidden">
    <img :src="picture" :alt="name" class="aspect-square w-full object-cover" />
    <CardContent class="p-3">
      <h3 class="line-clamp-2 text-sm font-medium">{{ name }}</h3>
      <p class="text-sm text-muted-foreground">
        {{ new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price) }}
      </p>
    </CardContent>
    <CardFooter class="p-3 pt-0">
      <Button class="w-full" size="sm" @click="add">Add</Button>
    </CardFooter>
  </Card>
</template>