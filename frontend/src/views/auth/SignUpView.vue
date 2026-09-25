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

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = "Passwords don't match."
    return
  }
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }

  loading.value = true
  const { error: signUpError } = await authClient.signUp.email({
    name: name.value,
    email: email.value,
    password: password.value,
  })
  loading.value = false

  if (signUpError) {
    error.value = signUpError.message ?? 'Something went wrong. Please try again.'
    return
  }

  // Redirect directly to login page after successful registration
  router.push('/login')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-xl">Create an account</CardTitle>
        <CardDescription>Enter your details below to get started.</CardDescription>
      </CardHeader>

      <form @submit.prevent="handleSubmit">
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" v-model="name" type="text" autocomplete="name" required />
          </div>

          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" required />
          </div>

          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </CardContent>

        <CardFooter class="flex flex-col gap-4">
          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Creating account…' : 'Create account' }}
          </Button>
          <p class="text-center text-sm text-muted-foreground">
            Already have an account?
            <RouterLink to="/login" class="underline underline-offset-4">Log in</RouterLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>