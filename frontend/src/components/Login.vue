<script setup>
import { ref } from "vue";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandLogo from "@/components/BrandLogo.vue";

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

async function submit() {
  loading.value = true;
  error.value = "";
  const { error: err } = await authClient.signIn.email({
    email: email.value,
    password: password.value,
  });
  loading.value = false;
  // On success, useSession() in App.vue updates and the app shell is rendered
  if (err) error.value = err.message ?? "Gagal masuk";
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center p-6">
    <div class="w-full max-w-md rounded-[20px] border bg-card p-8 shadow-card">
      <div class="mb-8">
        <BrandLogo variant="light" class="!h-9" />
      </div>
      <h1 class="text-[28px] font-bold leading-tight">Login</h1>
      <p class="mt-1 text-[15px] text-muted-foreground">Masuk dengan akun karyawan atau owner.</p>

      <form class="mt-8 grid gap-5" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="email" class="text-sm">Email</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="nama@email.com"
            class="h-12 rounded-xl bg-muted/60 text-base"
            required
          />
        </div>
        <div class="grid gap-2">
          <Label for="password" class="text-sm">Password</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Password"
            class="h-12 rounded-xl bg-muted/60 text-base"
            required
          />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" class="h-12 rounded-xl text-base" :disabled="loading">
          {{ loading ? "Memeriksa..." : "Masuk" }}
        </Button>
      </form>
    </div>
  </div>
</template>
