<script setup>
import { computed } from 'vue';
import { authClient } from './lib/auth-client.js';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const props = defineProps({
  name: { type: String, required: true },
  role: { type: String, default: 'user' },
});

const initial = computed(() => props.name.trim().charAt(0).toUpperCase());

async function signOut() {
  await authClient.signOut();
}
</script>

<template>
  <header class="flex items-center justify-between border-b bg-background px-4 py-3">
    <a href="/" class="text-lg font-bold">MyApp</a>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" class="h-auto gap-3 px-2 py-1.5">
          <Avatar class="size-8">
            <AvatarFallback>{{ initial }}</AvatarFallback>
          </Avatar>
          <span class="hidden text-sm font-medium sm:inline">{{ name }}</span>
          <Badge variant="secondary" class="capitalize">{{ role }}</Badge>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" class="w-48">
        <DropdownMenuLabel>{{ name }}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="signOut">Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </header>
</template>