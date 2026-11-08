import { ref } from "vue";
import { useOrderStore } from "@/stores/order";

// Membungkus aksi yang mengganti isi kasir. Kalau masih ada pesanan belum disimpan, minta konfirmasi dulu.
export function useSafeLoad() {
  const order = useOrderStore();
  const confirmOpen = ref(false);
  let pending = null;

  function guard(action) {
    if (order.dirty && !order.isEmpty) {
      pending = action;
      confirmOpen.value = true;
    } else {
      action();
    }
  }

  function proceed() {
    confirmOpen.value = false;
    const action = pending;
    pending = null;
    action?.();
  }

  return { confirmOpen, guard, proceed };
}
