<script setup>
import { ref, computed, watchEffect, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
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

watchEffect(() => {
  ui.user = props.user;
});

// Kunci scroll halaman selama app terbuka (lihat .app-locked di style.css)
onMounted(() => document.documentElement.classList.add("app-locked"));
onUnmounted(() => document.documentElement.classList.remove("app-locked"));

const NAV = [
  { to: "/kasir", label: "Kasir" },
  { to: "/meja", label: "Meja" },
  { to: "/dapur", label: "Dapur" },
  { to: "/transaksi", label: "Transaksi" },
  { to: "/laporan", label: "Laporan" },
  { to: "/pengaturan", label: "Pengaturan" },
];

const firstName = computed(() => props.user.name?.split(" ")[0] ?? "");

// ---- Akhiri shift & keluar: ringkasan shift berjalan, lalu simpan shift dan sign out ----
const showShift = ref(false);
const shiftLoading = ref(false);
const shiftError = ref("");
const shift = ref({ createdAt: null, endedAt: null });
const salesSummary = ref({ cash: 0, card: 0, qris: 0, total: 0 });

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
    salesSummary.value = json.data; // { cash, card, qris, total }
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
    <header class="flex h-14 shrink-0 items-center gap-6 bg-nav px-6 text-nav-foreground">
      <RouterLink to="/kasir" class="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/50">
        <BrandLogo variant="dark" />
      </RouterLink>

      <nav class="flex flex-1 items-stretch justify-center gap-1 self-stretch overflow-x-auto" aria-label="Menu utama">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          v-slot="{ href, navigate, isActive }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            class="relative flex items-center px-4 text-[15px] transition-colors outline-none focus-visible:bg-white/10"
            :class="isActive ? 'font-semibold text-white' : 'text-white/70 hover:text-white'"
            :aria-current="isActive ? 'page' : undefined"
            @click="navigate"
          >
            {{ item.label }}
            <span
              v-if="isActive"
              class="absolute inset-x-4 bottom-2 h-0.5 rounded-full bg-white"
            />
          </a>
        </RouterLink>
      </nav>

      <div class="flex shrink-0 items-center gap-4">
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
              <p class="text-xs font-normal capitalize text-muted-foreground">{{ user.role }}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="router.push('/pengaturan')">
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
