<script setup>
import { authClient } from "@/lib/auth-client";
import Login from "@/components/Login.vue";
import Navbar from "@/components/Navbar.vue";
import Home from "@/views/Home.vue";

const session = authClient.useSession();
</script>

<template>
  <p v-if="session.isPending" class="p-4 text-sm text-muted-foreground">Loading...</p>
  <div v-else-if="session.data" class="flex min-h-screen flex-col">
    <Navbar :username="session.data.user.name" :role="session.data.user.role" />
    <Home :employeeId="session.data.user.id" />
  </div>
  <Login v-else />
</template>