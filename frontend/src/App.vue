<script setup>
import { watch } from "vue";
import { authClient } from "@/lib/auth-client";
import Login from "@/components/Login.vue";
import LoadingScreen from "@/components/LoadingScreen.vue";
import AppShell from "@/components/AppShell.vue";

const session = authClient.useSession();

// Splash screen ada di index.html supaya tampil instan. Disembunyikan begitu sesi selesai dicek,
// dengan durasi tampil minimal supaya tidak berkedip.
const SPLASH_MIN_MS = 1000;
let splashDone = false;

function hideSplash() {
  if (splashDone) return;
  splashDone = true;
  const el = document.getElementById("splash");
  if (!el) return;
  const wait = Math.max(0, SPLASH_MIN_MS - performance.now());
  setTimeout(() => {
    el.classList.add("hide");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600); // cadangan kalau transisi dimatikan (reduced motion)
    document.documentElement.classList.remove("splashing");
  }, wait);
}

watch(
  () => session.value.isPending,
  (pending) => {
    if (!pending) hideSplash();
  },
  { immediate: true }
);

function retry() {
  window.location.reload();
}
</script>

<template>
  <template v-if="!session.isPending">
    <LoadingScreen v-if="session.error" failed @retry="retry" />
    <AppShell v-else-if="session.data" :user="session.data.user" />
    <Login v-else />
  </template>
</template>
