<script setup>
import { ref, computed, watch } from "vue";
import { Check, Minus, Plus } from "@lucide/vue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCatalogStore } from "@/stores/catalog";
import { formatRp, number, titleCase } from "@/lib/format";
import MenuImage from "@/components/MenuImage.vue";

// "Sesuaikan menu": pilihan wajib, tambahan, catatan dapur, dan jumlah untuk satu item
const props = defineProps({
  open: { type: Boolean, default: false },
  product: { type: Object, default: null }, // item dari catalog.gridProducts
  // Mode ubah: baris keranjang yang sedang diedit ({ qty, note, options, paket: { bakso, mie } })
  editing: { type: Object, default: null },
});
const emit = defineEmits(["update:open", "add"]);

const catalog = useCatalogStore();

const qty = ref(1);
const note = ref("");
const choices = ref({}); // { [groupName]: optionName }
const extras = ref([]); // nama tambahan yang dipilih
const paketBakso = ref("");
const paketMie = ref("");

const isPaket = computed(() => Boolean(props.product?.isPaket));
const paket = computed(() => (isPaket.value ? catalog.paketOptions(props.product.name) : { bakso: [], mie: [] }));
const groups = computed(() => (props.product && !isPaket.value ? catalog.modifierGroups(props.product.category) : []));
const choiceGroups = computed(() => groups.value.filter((g) => g.kind === "choice"));
const extraGroups = computed(() => groups.value.filter((g) => g.kind === "extra"));

// Reset setiap kali dialog dibuka untuk produk baru
watch(
  () => [props.open, props.product?.id, props.editing],
  ([isOpen]) => {
    if (!isOpen || !props.product) return;
    const e = props.editing;
    qty.value = e?.qty ?? 1;
    note.value = e?.note ?? "";
    const picked = e?.options ?? [];
    extras.value = picked.filter((o) => extraGroups.value.some((g) => g.name === o.group)).map((o) => o.name);
    choices.value = Object.fromEntries(
      choiceGroups.value.map((g) => [
        g.name,
        picked.find((o) => o.group === g.name && g.options.some((x) => x.name === o.name))?.name ?? g.options[0].name,
      ])
    );
    paketBakso.value = e?.paket?.bakso ?? paket.value.bakso[0] ?? "";
    paketMie.value = e?.paket?.mie ?? paket.value.mie[0] ?? "";
  },
  { immediate: true }
);

// Produk yang benar-benar ditambahkan: untuk paket, baris kombinasi yang cocok
const targetProduct = computed(() => {
  if (!props.product) return null;
  if (!isPaket.value) return props.product;
  return catalog.findPaket(props.product.name, paketBakso.value, paketMie.value) ?? null;
});

const selectedOptions = computed(() => {
  const out = [];
  for (const g of choiceGroups.value) {
    const opt = g.options.find((o) => o.name === choices.value[g.name]);
    if (opt) out.push({ group: g.name, name: opt.name, price: opt.price });
  }
  for (const g of extraGroups.value) {
    for (const opt of g.options) {
      if (extras.value.includes(opt.name)) out.push({ group: g.name, name: opt.name, price: opt.price });
    }
  }
  return out;
});

const unitPrice = computed(
  () => (targetProduct.value?.price ?? 0) + selectedOptions.value.reduce((s, o) => s + o.price, 0)
);
const available = computed(() => Boolean(targetProduct.value?.is_available));

function toggleExtra(name) {
  extras.value = extras.value.includes(name) ? extras.value.filter((n) => n !== name) : [...extras.value, name];
}

function submit() {
  if (!targetProduct.value || !available.value) return;
  emit("add", { product: targetProduct.value, qty: qty.value, options: selectedOptions.value, note: note.value });
}

const choiceClass = (selected) =>
  selected
    ? "border-primary bg-secondary text-primary font-semibold"
    : "bg-card hover:border-primary/40 hover:bg-muted/50";
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent v-if="product" class="max-h-[88dvh] overflow-y-auto overscroll-contain p-6 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle class="text-xl font-bold">{{ editing ? "Ubah pesanan" : "Sesuaikan menu" }}</DialogTitle>
        <DialogDescription class="text-sm">Pilihan tersimpan per item, bukan untuk seluruh pesanan.</DialogDescription>
      </DialogHeader>

      <div class="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <!-- Kiri: foto dan info menu -->
        <section class="flex flex-col self-start rounded-2xl bg-[#f7f5f1] p-3">
          <div class="overflow-hidden rounded-xl bg-[#f6efe7]">
            <MenuImage :src="product.picture" :name="titleCase(product.name)" :lazy="false" />
          </div>
          <div class="flex flex-col px-2 pt-3 pb-1">
            <h2 class="text-xl font-bold leading-tight">{{ titleCase(product.name) }}</h2>
            <p v-if="product.description" class="mt-1.5 text-sm text-muted-foreground">{{ product.description }}</p>
            <span class="tabular mt-3 inline-flex w-fit rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-primary">
              {{ formatRp(targetProduct?.price ?? product.price) }}
            </span>
          </div>
        </section>

        <!-- Kanan: pilihan -->
        <section class="flex flex-col gap-5">
          <!-- Paket: jenis bakso dan mie dari kombinasi yang ada -->
          <template v-if="isPaket">
            <div>
              <h3 class="text-base font-semibold">Pilihan bakso</h3>
              <p class="mb-2 text-xs text-muted-foreground">Pilih satu</p>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="opt in paket.bakso"
                  :key="opt"
                  type="button"
                  class="h-12 rounded-xl border px-3 text-left text-[15px] transition-colors"
                  :class="choiceClass(paketBakso === opt)"
                  @click="paketBakso = opt"
                >
                  {{ titleCase(opt) }}
                </button>
              </div>
            </div>
            <div>
              <h3 class="text-base font-semibold">Pilihan mie</h3>
              <p class="mb-2 text-xs text-muted-foreground">Pilih satu</p>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="opt in paket.mie"
                  :key="opt"
                  type="button"
                  class="h-12 rounded-xl border px-3 text-left text-[15px] transition-colors"
                  :class="choiceClass(paketMie === opt)"
                  @click="paketMie = opt"
                >
                  {{ titleCase(opt) }}
                </button>
              </div>
            </div>
          </template>

          <!-- Produk biasa: grup pilihan dari tabel modifier -->
          <div v-for="g in choiceGroups" :key="g.name">
            <h3 class="text-base font-semibold">{{ g.name }}</h3>
            <p class="mb-2 text-xs text-muted-foreground">Pilih satu</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="opt in g.options"
                :key="opt.id"
                type="button"
                class="h-12 rounded-xl border px-3 text-left text-[15px] transition-colors"
                :class="choiceClass(choices[g.name] === opt.name)"
                @click="choices[g.name] = opt.name"
              >
                {{ opt.name }}
                <span v-if="opt.price" class="text-sm opacity-70">+{{ number.format(opt.price) }}</span>
              </button>
            </div>
          </div>

          <div v-for="g in extraGroups" :key="g.name">
            <h3 class="mb-2 text-base font-semibold">{{ g.name }}</h3>
            <div class="flex flex-col gap-2">
              <button
                v-for="opt in g.options"
                :key="opt.id"
                type="button"
                class="flex h-12 items-center justify-between rounded-xl border px-4 text-[15px] transition-colors"
                :class="extras.includes(opt.name) ? 'border-primary bg-secondary text-primary' : 'border-transparent bg-muted/60 hover:bg-muted'"
                :aria-pressed="extras.includes(opt.name)"
                @click="toggleExtra(opt.name)"
              >
                <span class="flex items-center gap-2">
                  <Check v-if="extras.includes(opt.name)" class="size-4" />
                  {{ opt.name }}
                </span>
                <span class="tabular text-muted-foreground" :class="extras.includes(opt.name) ? 'text-primary' : ''">
                  + {{ formatRp(opt.price) }}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label for="item-note" class="mb-2 block text-base font-semibold">Catatan untuk dapur</label>
            <input
              id="item-note"
              v-model="note"
              type="text"
              maxlength="140"
              placeholder="Contoh: tanpa seledri"
              class="h-12 w-full rounded-xl border bg-muted/30 px-4 text-base outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-ring/20"
              @keydown.enter.prevent="submit"
            />
          </div>

          <div class="mt-1 flex gap-3">
            <div class="flex h-12 w-32 shrink-0 items-center justify-between rounded-xl bg-muted px-1 sm:w-36">
              <button
                type="button"
                class="flex size-10 items-center justify-center rounded-lg hover:bg-card disabled:opacity-40"
                :disabled="qty <= 1"
                aria-label="Kurangi"
                @click="qty--"
              >
                <Minus class="size-5" />
              </button>
              <span class="tabular text-lg font-semibold">{{ qty }}</span>
              <button
                type="button"
                class="flex size-10 items-center justify-center rounded-lg hover:bg-card"
                aria-label="Tambah"
                @click="qty++"
              >
                <Plus class="size-5" />
              </button>
            </div>
            <Button class="h-12 min-w-0 flex-1 justify-between gap-2 rounded-xl px-4 text-base sm:px-5" :disabled="!available" @click="submit">
              <template v-if="available">
                <span class="truncate">{{ editing ? "Simpan" : "Tambah pesanan" }}</span>
                <span class="tabular shrink-0">{{ formatRp(unitPrice * qty) }}</span>
              </template>
              <template v-else>Stok habis</template>
            </Button>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
