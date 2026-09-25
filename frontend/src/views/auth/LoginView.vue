<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''

  loading.value = true
  const { error: signInError } = await authClient.signIn.email({
    email: email.value,
    password: password.value,
  })
  loading.value = false

  if (signInError) {
    error.value = signInError.message ?? 'Invalid email or password.'
    return
  }

  // Redirect directly to the cashier system upon successful login
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-xl">Log in</CardTitle>
        <CardDescription>Enter your email and password to continue.</CardDescription>
      </CardHeader>

      <form @submit.prevent="handleSubmit">
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" required />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="password">Password</Label>
              <RouterLink
                to="/forgot-password"
                class="text-sm text-muted-foreground underline underline-offset-4"
              >
                Forgot password?
              </RouterLink>
            </div>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </CardContent>

        <CardFooter class="flex flex-col gap-4">
          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Logging in…' : 'Log in' }}
          </Button>
          <p class="text-center text-sm text-muted-foreground">
            Don't have an account?
            <RouterLink to="/signup" class="underline underline-offset-4">Sign up</RouterLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>