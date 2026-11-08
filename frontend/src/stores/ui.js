import { defineStore } from "pinia";
import { ref } from "vue";

// Toast singkat di pojok bawah, dan user yang sedang login
export const useUiStore = defineStore("ui", () => {
  const toasts = ref([]);
  const user = ref(null);
  let seq = 0;

  function toast(message, tone = "default") {
    const id = ++seq;
    toasts.value.push({ id, message, tone });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3500);
  }

  return { toasts, toast, user };
});
