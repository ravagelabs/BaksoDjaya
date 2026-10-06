<script setup>
import { authClient } from "@/lib/auth-client";
import Login from "@/components/Login.vue";
import Home from "@/views/Home.vue";

const session = authClient.useSession();
</script>

<template>
  <p v-if="session.isPending" class="p-4 text-sm text-muted-foreground">Loading...</p>
  <Home v-else-if="session.data" :user="session.data.user" />
  <Login v-else />
</template>