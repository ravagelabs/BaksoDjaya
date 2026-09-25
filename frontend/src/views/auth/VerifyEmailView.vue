<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
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

const route = useRoute()

const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const linkFailed = route.query.error != null

const status = ref('idle') // idle | sending | sent | error
const message = ref('')
const cooldown = ref(0)
let timer = null

function startCooldown() {
  cooldown.value = 30
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function resend() {
  if (!email.value || cooldown.value > 0) return

  status.value = 'sending'
  message.value = ''

  const { error } = await authClient.sendVerificationEmail({
    email: email.value,
    callbackURL: '/login',
  })

  if (error) {
    status.value = 'error'
    message.value = error.message ?? 'Could not resend the email. Please try again.'
    return
  }

  status.value = 'sent'
  startCooldown()
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-xl">Check your inbox</CardTitle>
        <CardDescription>
          We sent a verification link to <strong>{{ email || 'your email address' }}</strong
          >. Click it to activate your account.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-4">
        <p v-if="linkFailed" class="text-sm text-destructive">
          That verification link was invalid or has expired. Request a new one below.
        </p>

        <div v-if="!email" class="space-y-2">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" autocomplete="email" />
        </div>

        <p v-if="status === 'sent'" class="text-sm text-muted-foreground">
          Verification email sent. Check your inbox and spam folder.
        </p>
        <p v-if="status === 'error'" class="text-sm text-destructive">{{ message }}</p>
      </CardContent>

      <CardFooter class="flex flex-col gap-4">
        <Button
          class="w-full"
          variant="outline"
          :disabled="status === 'sending' || cooldown > 0 || !email"
          @click="resend"
        >
          {{
            cooldown > 0
              ? `Resend in ${cooldown}s`
              : status === 'sending'
                ? 'Sending…'
                : 'Resend verification email'
          }}
        </Button>
        <p class="text-center text-sm text-muted-foreground">
          Already verified? <RouterLink to="/login" class="underline underline-offset-4">Log in</RouterLink>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>