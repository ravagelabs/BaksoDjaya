<script setup>
import { ref, onMounted, watch } from "vue";
import { ImageUp, Trash2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { assetUrl, OUTLET_NAME } from "@/lib/format";
import { prepareReceiptLogo } from "@/lib/receipt";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";

// Pengaturan toko: logo outlet untuk header aplikasi, ikon tab, struk printer, dan PDF laporan
const settings = useSettingsStore();
const ui = useUiStore();
const saving = ref(false);
const printPreview = ref("");
const fileInput = ref(null);

async function refreshPreview() {
  printPreview.value = settings.logo ? await prepareReceiptLogo(assetUrl(settings.logo)).catch(() => "") : "";
}
onMounted(async () => {
  if (!settings.loaded) await settings.load();
  refreshPreview();
});
watch(() => settings.logo, refreshPreview);

// Kecilkan gambar (maks 800px) dan pertahankan transparansi (PNG)
function toPngDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 800 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("File bukan gambar yang bisa dibaca."));
    img.src = URL.createObjectURL(file);
  });
}

async function onFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  saving.value = true;
  try {
    const data = await toPngDataUrl(file);
    const up = await api("/uploads", { method: "POST", body: { data } });
    await settings.saveLogo(up.data.url);
    ui.toast("Logo disimpan");
  } catch (err) {
    ui.toast(err.message, "error");
  } finally {
    saving.value = false;
  }
}

async function removeLogo() {
  saving.value = true;
  try {
    await settings.saveLogo(null);
    ui.toast("Logo dihapus");
  } catch (err) {
    ui.toast(err.message, "error");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="mt-6 rounded-[20px] bg-muted/50 p-5 md:p-6">
    <h2 class="text-xl font-semibold">Logo {{ OUTLET_NAME }}</h2>
    <p class="text-sm text-muted-foreground">
      Tampil di aplikasi, ikon tab, struk pelanggan, laporan shift, dan PDF laporan. Paling bagus PNG dengan latar transparan.
    </p>

    <div class="mt-5 grid gap-4 md:grid-cols-3">
      <div class="rounded-xl bg-nav p-4">
        <p class="text-xs text-white/60">Di aplikasi</p>
        <div class="mt-2 flex h-28 items-center justify-center">
          <img v-if="settings.logo" :src="assetUrl(settings.logo)" :alt="OUTLET_NAME" class="max-h-full max-w-full object-contain" />
          <span v-else class="text-sm text-white/60">Belum ada logo</span>
        </div>
      </div>
      <div class="rounded-xl border bg-white p-4">
        <p class="text-xs text-muted-foreground">Di PDF laporan</p>
        <div class="mt-2 flex h-28 items-center justify-center">
          <img v-if="settings.logo" :src="assetUrl(settings.logo)" :alt="OUTLET_NAME" class="max-h-full max-w-full object-contain" />
          <span v-else class="text-sm text-muted-foreground">Belum ada logo</span>
        </div>
      </div>
      <div class="rounded-xl border bg-white p-4">
        <p class="text-xs text-muted-foreground">Di struk printer (hitam-putih)</p>
        <div class="mt-2 flex h-28 items-center justify-center">
          <img v-if="printPreview" :src="printPreview" alt="Pratinjau logo di struk" class="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
          <span v-else class="text-sm text-muted-foreground">Belum ada logo</span>
        </div>
      </div>
    </div>

    <div class="mt-5 flex flex-wrap gap-2">
      <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onFile" />
      <Button class="h-11 rounded-xl px-5" :disabled="saving" @click="fileInput.click()">
        <ImageUp class="size-4" /> {{ saving ? "Menyimpan..." : settings.logo ? "Ganti logo" : "Upload logo" }}
      </Button>
      <Button v-if="settings.logo" variant="secondary" class="h-11 rounded-xl px-4 text-destructive" :disabled="saving" @click="removeLogo">
        <Trash2 class="size-4" /> Hapus logo
      </Button>
    </div>
  </section>
</template>
