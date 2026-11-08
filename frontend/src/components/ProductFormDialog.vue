<script setup>
import { ref, computed, watch } from "vue";
import { ImagePlus, Link2, Trash2 } from "@lucide/vue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { resizeImage } from "@/lib/image";
import { number, titleCase, assetUrl } from "@/lib/format";
import { useCatalogStore } from "@/stores/catalog";
import { useUiStore } from "@/stores/ui";

// Form tambah / ubah menu. product = null berarti menu baru.
const props = defineProps({
  open: { type: Boolean, default: false },
  product: { type: Object, default: null },
});
const emit = defineEmits(["update:open"]);

const catalog = useCatalogStore();
const ui = useUiStore();

const isEdit = computed(() => Boolean(props.product));

const name = ref("");
const category = ref("");
const price = ref("");
const hpp = ref("");
const description = ref("");
const picture = ref("");
const available = ref(true);
const showUrl = ref(false);
const uploading = ref(false);
const saving = ref(false);
const error = ref("");
const fileInput = ref(null);

// Angka ditampilkan dengan pemisah ribuan, disimpan sebagai integer
const toInt = (v) => Number(String(v).replace(/\D/g, "")) || 0;
const fmt = (v) => (v === "" || v === null || v === undefined ? "" : number.format(toInt(v)));

watch(
  () => [props.open, props.product?.id],
  ([isOpen]) => {
    if (!isOpen) return;
    const p = props.product;
    name.value = p ? titleCase(p.name) : "";
    category.value = p?.category ?? "";
    price.value = p ? fmt(p.price) : "";
    hpp.value = p ? fmt(p.hpp ?? 0) : "";
    description.value = p?.description ?? "";
    picture.value = p?.picture ?? "";
    available.value = p ? p.is_available : true;
    showUrl.value = false;
    error.value = "";
  },
  { immediate: true }
);

function moneyValue(e) {
  const v = e.target.value.replace(/\D/g, "") ? fmt(e.target.value) : "";
  e.target.value = v;
  return v;
}
const onPrice = (e) => (price.value = moneyValue(e));
const onHpp = (e) => (hpp.value = moneyValue(e));

const margin = computed(() => {
  const p = toInt(price.value);
  const h = toInt(hpp.value);
  if (!p) return null;
  return Math.round(((p - h) / p) * 100);
});

async function onFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  uploading.value = true;
  error.value = "";
  try {
    const data = await resizeImage(file);
    const json = await api("/uploads", { method: "POST", body: { data } });
    picture.value = json.data.url;
  } catch (err) {
    error.value = err.message;
  } finally {
    uploading.value = false;
  }
}

async function submit() {
  error.value = "";
  if (!name.value.trim()) return (error.value = "Nama menu wajib diisi.");
  if (!toInt(price.value)) return (error.value = "Harga wajib diisi.");

  const body = {
    name: name.value,
    category: category.value,
    price: toInt(price.value),
    hpp: toInt(hpp.value),
    description: description.value,
    picture: picture.value,
    is_available: available.value,
  };

  saving.value = true;
  try {
    const json = isEdit.value
      ? await api(`/products/${props.product.id}`, { method: "PATCH", body })
      : await api("/products", { method: "POST", body });
    catalog.upsert(json.data);
    ui.toast(isEdit.value ? `${titleCase(json.data.name)} diperbarui` : `${titleCase(json.data.name)} ditambahkan`);
    emit("update:open", false);
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[88dvh] overflow-y-auto overscroll-contain p-6 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle class="text-xl font-bold">{{ isEdit ? "Ubah menu" : "Tambah menu" }}</DialogTitle>
        <DialogDescription class="text-[15px]">
          {{ isEdit ? "Perubahan langsung dipakai di kasir." : "Menu baru langsung muncul di kasir setelah disimpan." }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" @submit.prevent="submit">
        <!-- Foto -->
        <div class="flex flex-col gap-3">
          <div class="relative overflow-hidden rounded-2xl bg-[#f6efe7]">
            <img
              v-if="picture"
              :src="assetUrl(picture)"
              alt="Foto menu"
              class="aspect-[4/3] w-full object-cover"
            />
            <button
              v-else
              type="button"
              class="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
              @click="fileInput?.click()"
            >
              <ImagePlus class="size-8" />
              <span class="text-sm font-medium">Tambah foto</span>
            </button>
            <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-card/80 text-sm font-medium">
              Mengunggah...
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile" />
          <div class="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" class="h-11 rounded-xl" :disabled="uploading" @click="fileInput?.click()">
              <ImagePlus /> {{ picture ? "Ganti foto" : "Upload foto" }}
            </Button>
            <Button v-if="picture" type="button" variant="secondary" class="h-11 rounded-xl" @click="picture = ''">
              <Trash2 /> Hapus foto
            </Button>
            <Button v-else type="button" variant="secondary" class="h-11 rounded-xl" @click="showUrl = !showUrl">
              <Link2 /> Pakai URL
            </Button>
          </div>
          <input
            v-if="showUrl && !picture"
            v-model.lazy="picture"
            type="url"
            placeholder="https://..."
            class="h-11 rounded-xl border bg-card px-3 text-[15px] outline-none focus:border-primary"
          />
          <p class="text-xs text-muted-foreground">JPG, PNG, atau WebP. Foto otomatis diperkecil sebelum diunggah.</p>
        </div>

        <!-- Data menu -->
        <div class="flex flex-col gap-4">
          <div class="grid gap-2">
            <label for="pf-name" class="text-sm font-semibold">Nama menu</label>
            <input
              id="pf-name"
              v-model="name"
              required
              maxlength="80"
              placeholder="Contoh: Bakso Telur"
              class="h-11 rounded-xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20"
            />
            <p class="text-xs text-muted-foreground">
              Untuk paket, pakai format "Paket Siji - Bakso Urat + Mie" supaya pilihan bakso dan mie muncul di kasir.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <label for="pf-category" class="text-sm font-semibold">Kategori</label>
              <input
                id="pf-category"
                v-model="category"
                list="pf-categories"
                placeholder="Bakso, Mie, Minuman..."
                class="h-11 rounded-xl border bg-card px-4 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20"
              />
              <datalist id="pf-categories">
                <option v-for="c in catalog.categories" :key="c" :value="c" />
              </datalist>
            </div>
            <div class="grid gap-2">
              <span class="text-sm font-semibold">Status</span>
              <button
                type="button"
                role="switch"
                :aria-checked="available"
                class="flex h-11 items-center justify-between rounded-xl border bg-card px-4 text-base"
                @click="available = !available"
              >
                {{ available ? "Tersedia" : "Stok habis" }}
                <span class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors" :class="available ? 'bg-primary' : 'bg-[#d8d8dc]'">
                  <span class="inline-block size-5 rounded-full bg-white shadow transition-transform" :class="available ? 'translate-x-6' : 'translate-x-1'" />
                </span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <label for="pf-price" class="text-sm font-semibold">Harga jual</label>
              <div class="relative">
                <span class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">Rp</span>
                <input
                  id="pf-price"
                  :value="price"
                  inputmode="numeric"
                  required
                  placeholder="0"
                  class="tabular h-11 w-full rounded-xl border bg-card pr-4 pl-11 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20"
                  @input="onPrice"
                />
              </div>
            </div>
            <div class="grid gap-2">
              <label for="pf-hpp" class="text-sm font-semibold">HPP</label>
              <div class="relative">
                <span class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">Rp</span>
                <input
                  id="pf-hpp"
                  :value="hpp"
                  inputmode="numeric"
                  placeholder="0"
                  class="tabular h-11 w-full rounded-xl border bg-card pr-4 pl-11 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20"
                  @input="onHpp"
                />
              </div>
            </div>
          </div>
          <p v-if="margin !== null" class="-mt-3 text-xs text-muted-foreground">
            Margin {{ margin }}% dari harga jual.
          </p>

          <div class="grid gap-2">
            <label for="pf-desc" class="text-sm font-semibold">Deskripsi</label>
            <textarea
              id="pf-desc"
              v-model="description"
              rows="2"
              maxlength="200"
              placeholder="Tampil di layar Sesuaikan menu"
              class="resize-none rounded-xl border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-3 focus:ring-ring/20"
            />
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

          <div class="mt-auto grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" class="h-12 rounded-xl text-base" @click="emit('update:open', false)">Batal</Button>
            <Button type="submit" class="h-12 rounded-xl text-base" :disabled="saving || uploading">
              {{ saving ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Tambah menu" }}
            </Button>
          </div>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
