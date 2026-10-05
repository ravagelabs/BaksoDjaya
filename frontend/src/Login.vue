<script setup>
import { ref } from 'vue'
import { authClient } from './lib/auth-client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const session = authClient.useSession()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true

  const { error: authError } = await authClient.signIn.email({
    email: email.value,
    password: password.value,
  })

  loading.value = false
  if (authError) error.value = authError.message ?? 'Login failed'
  // on success, useSession() updates automatically and the dialog closes
}
</script>

<template>
  <!-- Open only once the session check finished and there is no user -->
  <Dialog :open="!session.isPending && !session.data">
    <DialogContent
      class="sm:max-w-sm"
      @escape-key-down.prevent
      @interact-outside.prevent
      @pointer-down-outside.prevent
    >
      <DialogHeader>
        <DialogTitle>Sign in</DialogTitle>
        <DialogDescription>Please log in to continue.</DialogDescription>
      </DialogHeader>

      <form class="grid gap-4" @submit.prevent="handleLogin">
        <div class="grid gap-2">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" required autocomplete="email" />
        </div>

        <div class="grid gap-2">
          <Label for="password">Password</Label>
          <Input id="password" v-model="password" type="password" required autocomplete="current-password" />
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" :disabled="loading">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>

  <!-- Your app content, only rendered when logged in -->
  <RouterView v-if="session.data" />
</template>