import { defineStore } from "pinia";
import { ref } from "vue";

// Toast singkat di pojok bawah, dan user yang sedang login
export const useUiStore = defineStore("ui", () => {
  const toasts = ref([]);
  const user = ref(null);
  // Naik 1 setiap ada permintaan "Akhiri shift" dari halaman lain (AppShell membuka popup shift)
  const endShiftRequest = ref(0);
  // Aksi cepat dari tombol + (biaya, transfer, aset, kasbank, jurnal); null = tertutup
  const quickAction = ref(null);
  // Naik 1 setiap ada data keuangan baru, supaya Beranda & Keuangan memuat ulang
  const financeVersion = ref(0);
  let seq = 0;

  function toast(message, tone = "default") {
    const id = ++seq;
    toasts.value.push({ id, message, tone });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3500);
  }

  return {
    endShiftRequest, quickAction, financeVersion, toasts, toast, user };
});
