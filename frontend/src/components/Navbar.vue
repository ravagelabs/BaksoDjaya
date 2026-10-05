<script setup>
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

defineProps({
  username: { type: String, required: true },
  role: { type: String, default: "user" },
});

async function logout() {
  // useSession() in App.vue updates, which renders Login again
  await authClient.signOut();
}
</script>

<template>
  <header class="grid h-14 grid-cols-3 items-center border-b px-4">
    <!-- 1/3: brand -->
    <div class="text-lg font-bold tracking-tight">BAKSO DJAYA</div>

    <!-- 1/3: menu (items always visible) -->
    <nav class="flex items-center justify-center gap-1">
      <Button variant="ghost" size="sm" @click="logout">Logout</Button>
    </nav>

    <!-- 1/3: user -->
    <div class="text-right leading-tight">
      <p class="text-sm font-medium">{{ username }}</p>
      <p class="text-xs capitalize text-muted-foreground">{{ role }}</p>
    </div>
  </header>
</template>