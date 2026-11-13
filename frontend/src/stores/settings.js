import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/format";
import { prepareReceiptLogo } from "@/lib/receipt";

// Pengaturan toko (logo outlet). Logo dipakai di header aplikasi, ikon tab, struk, dan PDF laporan.
export const useSettingsStore = defineStore("settings", () => {
  const logo = ref(null); // path /uploads/...
  const loaded = ref(false);

  // Logo juga jadi ikon tab browser
  function applyFavicon(url) {
    let link = document.querySelector('link[rel="icon"][data-outlet]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.dataset.outlet = "1";
      document.head.appendChild(link);
    }
    link.href = url;
  }

  async function apply() {
    const url = logo.value ? assetUrl(logo.value) : "";
    applyFavicon(url);
    try {
      await prepareReceiptLogo(url);
    } catch {
      // logo gagal diproses untuk printer: struk tetap tercetak dengan nama outlet
    }
  }

  async function load() {
    try {
      logo.value = (await api("/settings")).data.outlet_logo;
    } catch {
      logo.value = null;
    }
    loaded.value = true;
    await apply();
  }

  async function saveLogo(path) {
    await api("/settings", { method: "PUT", body: { outlet_logo: path } });
    logo.value = path;
    await apply();
  }

  return { logo, loaded, load, saveLogo };
});
