<script setup>
import { authClient } from "@/lib/auth-client";
import Login from "@/components/Login.vue";
import LoadingScreen from "@/components/LoadingScreen.vue";
import AppShell from "@/components/AppShell.vue";

const session = authClient.useSession();

function retry() {
  window.location.reload();
}
</script>

<template>
  <LoadingScreen v-if="session.isPending" />
  <LoadingScreen v-else-if="session.error" failed @retry="retry" />
  <AppShell v-else-if="session.data" :user="session.data.user" />
  <Login v-else />
</template>
