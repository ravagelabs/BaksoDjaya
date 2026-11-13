<script setup>
import { ref, computed, watch, watchEffect, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronDown, History, LogOut } from "@lucide/vue";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { OUTLET_NAME } from "@/lib/format";
import { useUiStore } from "@/stores/ui";
import { useOrderStore } from "@/stores/order";
import BrandLogo from "@/components/BrandLogo.vue";
import ShiftPopup from "@/components/ShiftPopup.vue";
import ToastHost from "@/components/ToastHost.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const props = defineProps({
  user: { type: Object, required: true }, // { id, name, role }
});

const ui = useUiStore();
const order = useOrderStore();
const router = useRouter();
const route = useRoute();

watchEffect(() => {
  ui.user = props.user;
});

// Kunci scroll halaman selama app terbuka (lihat .app-locked di style.css)
onMounted(() => document.documentElement.classList.add("app-locked"));
onUnmounted(() => document.documentElement.classList.remove("app-locked"));

// manager: hanya untuk role pengelola (sama dengan MANAGER_ROLES di backend/lib/http.js)
const MANAGER_ROLES = ["owner"];
const isManager = computed(() => MANAGER_ROLES.includes(props.user.role));

const NAV_ALL = [
  { to: "/kasir", label: "Kasir" },
  { to: "/meja", label: "Nomor" },
  { to: "/dapur", label: "Dapur" },
  { to: "/transaksi", label: "Transaksi" },
  { to: "/laporan", label: "Laporan", manager: true },
  { to: "/pengaturan", label: "Pengaturan", manager: true },
];
const NAV = computed(() => NAV_ALL.filter((item) => !item.manager || isManager.value));

// Kasir yang membuka halaman pengelola lewat URL langsung diarahkan ke Kasir
watch(
  () => route.path,
  (path) => {
    const item = NAV_ALL.find((n) => path.startsWith(n.to));
    if (item?.manager && !isManager.value) router.replace("/kasir");
  },
  { immediate: true },
);

const ROLE_LABELS = { owner: "Owner", employee: "Karyawan", user: "Kasir", customer: "Pelanggan" };

const firstName = computed(() => props.user.name?.split(" ")[0] ?? "");

// ---- Akhiri shift & keluar: ringkasan shift berjalan, lalu simpan shift dan sign out ----
const showShift = ref(false);
const shiftLoading = ref(false);
const shiftError = ref("");
const shift = ref({ createdAt: null, endedAt: null });
const salesSummary = ref({ cash: 0, qris: 0, transfer: 0, gofood: 0, grabfood: 0, total: 0 });

async function logout() {
  shiftError.value = "";
  shiftLoading.value = true;
  showShift.value = true;
  try {
    const { data, error: err } = await authClient.getSession();
    if (err || !data?.session) throw new Error(err?.message ?? "Sesi tidak ditemukan");

    const createdAt = new Date(data.session.createdAt);
    const endedAt = new Date();
    shift.value = { createdAt, endedAt };

    const params = new URLSearchParams({ from: createdAt.toISOString(), to: endedAt.toISOString() });
    const json = await api(`/bills/summary?${params}`);
    salesSummary.value = json.data; // { qris, transfer, cash, gofood, grabfood, card, total }
  } catch (e) {
    shiftError.value = e.message;
  } finally {
    shiftLoading.value = false;
  }
}

async function confirmLogout() {
  shiftError.value = "";
  shiftLoading.value = true;
  try {
    await api("/shifts", {
      method: "POST",
      body: {
        created_at: shift.value.createdAt.toISOString(),
        ended_at: shift.value.endedAt.toISOString(),
      },
    });
    showShift.value = false;
    order.reset();
    // useSession() in App.vue updates, which renders Login again
    await authClient.signOut();
  } catch (e) {
    shiftError.value = e.message; // popup stays open so they can retry
  } finally {
    shiftLoading.value = false;
  }
}
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-card pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
    <header class="flex shrink-0 flex-wrap items-center gap-x-6 bg-nav px-4 text-nav-foreground md:h-14 md:flex-nowrap md:px-6">
      <RouterLink to="/kasir" class="flex h-14 shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/50">
        <BrandLogo variant="dark" />
      </RouterLink>

      <nav class="order-last -mx-4 flex h-12 w-[calc(100%+2rem)] items-stretch gap-1 overflow-x-auto border-t border-white/10 px-2 [scrollbar-width:none] md:order-none md:mx-0 md:h-auto md:w-auto md:flex-1 md:justify-center-safe md:self-stretch md:border-t-0 md:px-0" aria-label="Menu utama">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          v-slot="{ href, navigate, isActive }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            class="relative flex shrink-0 items-center px-3 text-[15px] whitespace-nowrap transition-colors lg:px-4 outline-none focus-visible:bg-white/10"
            :class="isActive ? 'font-semibold text-white' : 'text-white/70 hover:text-white'"
            :aria-current="isActive ? 'page' : undefined"
            @click="navigate"
          >
            {{ item.label }}
            <span
              v-if="isActive"
              class="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-white lg:inset-x-4 lg:bottom-2"
            />
          </a>
        </RouterLink>
      </nav>

      <div class="ml-auto flex shrink-0 items-center gap-4 md:ml-0">
        <span class="hidden text-[15px] font-medium text-white lg:inline">{{ OUTLET_NAME }}</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            class="flex h-10 items-center gap-2 rounded-lg px-2 text-[15px] text-white/80 outline-none hover:bg-white/10 hover:text-white focus-visible:bg-white/10"
          >
            {{ firstName }}
            <ChevronDown class="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel>
              <p class="text-sm font-semibold">{{ user.name }}</p>
              <p class="text-xs font-normal text-muted-foreground">{{ ROLE_LABELS[user.role] ?? "Kasir" }}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem v-if="isManager" @select="router.push('/pengaturan')">
              <History /> Riwayat shift
            </DropdownMenuItem>
            <DropdownMenuItem @select="logout">
              <LogOut /> Akhiri shift & keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-hidden">
      <RouterView />
    </main>

    <ShiftPopup
      v-model:open="showShift"
      :created-at="shift.createdAt"
      :ended-at="shift.endedAt"
      :summary="salesSummary"
      :loading="shiftLoading"
      :error="shiftError"
      :unsaved-items="order.dirty ? order.lines.length : 0"
      @confirm-logout="confirmLogout"
    />

    <ToastHost />
  </div>
</template>
