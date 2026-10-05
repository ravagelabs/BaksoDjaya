<script setup>
import Login from './Login.vue';
import Navbar from './Navbar.vue';
import { authClient } from './lib/auth-client.js';
import { Skeleton } from '@/components/ui/skeleton';
 
const session = authClient.useSession();
</script>
 
<template>
  <!-- Wait for the session check so Login doesn't flash for signed-in users -->
  <div v-if="session.isPending" class="flex items-center justify-between border-b px-4 py-3">
    <Skeleton class="h-6 w-24" />
    <Skeleton class="h-8 w-32" />
  </div>
 
  <Navbar
    v-else-if="session.data"
    :name="session.data.user.name"
    :role="session.data.user.role"
  />
 
  <Login v-else />
</template>