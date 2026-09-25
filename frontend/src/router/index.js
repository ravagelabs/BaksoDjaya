import { createRouter, createWebHistory } from 'vue-router'
import { authClient } from '@/lib/auth-client'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/auth/SignUpView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/CashierView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// Navigation Guard
router.beforeEach(async (to, from, next) => {
  const { data: session } = await authClient.getSession()

  // 1. Route requires authentication, but user is NOT logged in
  if (to.meta.requiresAuth && !session) {
    return next({ name: 'login' })
  }

  // 2. Route is for guests only (login/signup), but user IS logged in
  if (to.meta.guestOnly && session) {
    return next({ name: 'Home' })
  }

  // Allow navigation
  next()
})

export default router