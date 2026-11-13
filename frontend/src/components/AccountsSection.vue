<script setup>
import { ref, computed, onMounted } from "vue";
import { KeyRound, Plus, Trash2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { api } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/format";
import { useUiStore } from "@/stores/ui";

// Kelola akun POS (hanya akun utama). Akun utama: semua akses. Admin: kasir, nomor, dapur, transaksi.
const ui = useUiStore();

const ROLE_OPTIONS = [
  { value: "user", label: ROLE_LABELS.user, hint: "Kasir, nomor, dapur, transaksi" },
  { value: "owner", label: ROLE_LABELS.owner, hint: "Semua akses, termasuk laporan, pengaturan, hapus pesanan, kelola akun" },
];

const users = ref([]);
const loading = ref(true);
const error = ref("");

async function load() {
  try {
    users.value = (await api("/users")).data;
    error.value = "";
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const isMe = (u) => u.id === ui.user?.id;
const ownerCount = computed(() => users.value.filter((u) => u.role === "owner").length);
// Akun utama terakhir tidak bisa diturunkan / dihapus
const locked = (u) => isMe(u) || (u.role === "owner" && ownerCount.value <= 1);

// ---- Tambah akun ----
const showAdd = ref(false);
const form = ref({ name: "", email: "", password: "", role: "user" });
const formError = ref("");
const saving = ref(false);

function openAdd() {
  form.value = { name: "", email: "", password: "", role: "user" };
  formError.value = "";
  showAdd.value = true;
}

async function createAccount() {
  if (saving.value) return;
  formError.value = "";
  saving.value = true;
  try {
    await api("/users", { method: "POST", body: form.value });
    ui.toast(`Akun ${form.value.name} dibuat`);
    showAdd.value = false;
    await load();
  } catch (e) {
    formError.value = e.message;
  } finally {
    saving.value = false;
  }
}

// ---- Ubah peran ----
async function setRole(u, role) {
  if (u.role === role) return;
  try {
    await api(`/users/${u.id}`, { method: "PATCH", body: { role } });
    ui.toast(`${u.name} sekarang ${ROLE_LABELS[role]}`);
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  }
}

// ---- Ganti password ----
const pwUser = ref(null);
const newPassword = ref("");
const pwError = ref("");

function openPassword(u) {
  pwUser.value = u;
  newPassword.value = "";
  pwError.value = "";
}

async function savePassword() {
  if (saving.value) return;
  pwError.value = "";
  saving.value = true;
  try {
    await api(`/users/${pwUser.value.id}`, { method: "PATCH", body: { password: newPassword.value } });
    ui.toast(`Password ${pwUser.value.name} diganti`);
    pwUser.value = null;
  } catch (e) {
    pwError.value = e.message;
  } finally {
    saving.value = false;
  }
}

// ---- Hapus akun ----
const delUser = ref(null);

async function removeAccount() {
  const u = delUser.value;
  delUser.value = null;
  try {
    await api(`/users/${u.id}`, { method: "DELETE" });
    ui.toast(`Akun ${u.name} dihapus`);
    await load();
  } catch (e) {
    ui.toast(e.message, "error");
  }
}
</script>

<template>
  <section class="mt-10 rounded-[20px] bg-muted/50 p-5 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">Akun</h2>
        <p class="text-sm text-muted-foreground">Akun utama mengelola semuanya. Admin untuk kasir dan staf.</p>
      </div>
      <Button class="h-11 rounded-xl px-4 text-[15px]" @click="openAdd"><Plus /> Tambah akun</Button>
    </div>

    <p v-if="loading" class="mt-4 text-[15px] text-muted-foreground">Memuat akun...</p>
    <p v-else-if="error" class="mt-4 text-[15px] text-destructive">{{ error }}</p>
    <ul v-else class="mt-4 flex flex-col divide-y rounded-xl bg-card">
      <li v-for="u in users" :key="u.id" class="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 md:px-5">
        <div class="min-w-48 flex-1">
          <p class="text-[16px] font-semibold">
            {{ u.name }} <span v-if="isMe(u)" class="text-sm font-normal text-muted-foreground">(Anda)</span>
          </p>
          <p class="truncate text-sm text-muted-foreground">{{ u.email }}</p>
        </div>

        <!-- Peran: 2 pilihan, langsung tersimpan -->
        <div class="flex rounded-xl bg-muted p-1" role="radiogroup" :aria-label="`Peran ${u.name}`">
          <button
            v-for="r in ROLE_OPTIONS"
            :key="r.value"
            type="button"
            role="radio"
            :aria-checked="u.role === r.value"
            class="h-9 rounded-lg px-3 text-sm transition-colors disabled:cursor-not-allowed"
            :class="u.role === r.value ? 'bg-card font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            :disabled="locked(u) && u.role !== r.value"
            @click="setRole(u, r.value)"
          >
            {{ r.label }}
          </button>
        </div>

        <div class="flex gap-1.5">
          <Button variant="secondary" class="h-10 rounded-xl px-3 text-sm" @click="openPassword(u)">
            <KeyRound class="size-4" /> Password
          </Button>
          <Button
            variant="secondary"
            class="h-10 rounded-xl px-3 text-sm text-destructive hover:bg-destructive/10"
            :disabled="locked(u)"
            :aria-label="`Hapus akun ${u.name}`"
            @click="delUser = u"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>
      </li>
    </ul>

    <!-- Tambah akun -->
    <Dialog v-model:open="showAdd">
      <DialogContent class="p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">Tambah akun</DialogTitle>
          <DialogDescription class="text-[15px]">Akun bisa langsung dipakai login dengan email dan password ini.</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4" @submit.prevent="createAccount">
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold">Nama</span>
            <input v-model="form.name" required autocomplete="off" class="h-11 rounded-xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20" placeholder="Contoh: Budi" />
          </label>
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold">Email</span>
            <input v-model="form.email" type="email" required autocomplete="off" class="h-11 rounded-xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20" placeholder="nama@email.com" />
          </label>
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold">Password</span>
            <input v-model="form.password" type="password" required minlength="8" autocomplete="new-password" class="h-11 rounded-xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20" placeholder="Minimal 8 karakter" />
          </label>
          <fieldset class="grid gap-2">
            <legend class="mb-1.5 text-sm font-semibold">Peran</legend>
            <label
              v-for="r in ROLE_OPTIONS"
              :key="r.value"
              class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors"
              :class="form.role === r.value ? 'border-primary bg-secondary' : 'bg-card hover:bg-muted/50'"
            >
              <input v-model="form.role" type="radio" :value="r.value" class="mt-1 accent-[var(--primary)]" />
              <span>
                <span class="block font-semibold">{{ r.label }}</span>
                <span class="block text-sm text-muted-foreground">{{ r.hint }}</span>
              </span>
            </label>
          </fieldset>
          <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
          <Button type="submit" class="h-12 rounded-xl text-base" :disabled="saving">{{ saving ? "Menyimpan..." : "Buat akun" }}</Button>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Ganti password -->
    <Dialog :open="Boolean(pwUser)" @update:open="!$event && (pwUser = null)">
      <DialogContent v-if="pwUser" class="p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle class="text-2xl font-bold">Ganti password</DialogTitle>
          <DialogDescription class="text-[15px]">
            {{ pwUser.name }} ({{ pwUser.email }}){{ isMe(pwUser) ? "" : " akan diminta login ulang." }}
          </DialogDescription>
        </DialogHeader>
        <form class="grid gap-4" @submit.prevent="savePassword">
          <input v-model="newPassword" type="password" required minlength="8" autocomplete="new-password" class="h-11 rounded-xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20" placeholder="Password baru, minimal 8 karakter" />
          <p v-if="pwError" class="text-sm text-destructive">{{ pwError }}</p>
          <Button type="submit" class="h-12 rounded-xl text-base" :disabled="saving">{{ saving ? "Menyimpan..." : "Simpan password" }}</Button>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      :open="Boolean(delUser)"
      :title="`Hapus akun ${delUser?.name ?? ''}?`"
      description="Akun tidak bisa login lagi. Riwayat transaksi yang dibuat akun ini tetap tersimpan."
      confirm-label="Hapus akun"
      @update:open="!$event && (delUser = null)"
      @confirm="removeAccount"
    />
  </section>
</template>
