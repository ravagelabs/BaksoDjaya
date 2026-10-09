<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar.vue";
import BillPopup from "@/components/BillPopup.vue";
import CustomerPopup from "@/components/CustomerPopup.vue";
import PaymentPopup from "@/components/PaymentPopup.vue";
import PrintPopup from "@/components/PrintPopup.vue";
import ProductCard from "@/components/ProductCard.vue";
import ProductSlot from "@/components/ProductSlot.vue";

const props = defineProps({
  user: { type: Object, required: true }, // { id, name, role }
});

const products = ref([]); // from API: { id, name, picture, price }
const productsList = ref([]); // cart: { product_id, name, price, qty }
const billId = ref(null); // set once the bill exists on the server
const loading = ref(true);
const error = ref("");
const saving = ref(false);
const saveMessage = ref("");
const saveFailed = ref(false);
const bills = ref([]); // ongoing bills from GET /bills
const showBills = ref(false);
const billsLoading = ref(false);
const billsError = ref("");
const customers = ref([]); // from GET /customers
const customer = ref(null); // currently selected customer
const showCustomer = ref(false);
const customersLoading = ref(false);
const customerSaving = ref(false);
const customerError = ref("");
const showPayment = ref(false);
const showPrint = ref(false);
const printLoading = ref(false);
const printError = ref("");
const printData = ref(null); // bill shown in the print popup (GET /bills/:billId)

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

async function getProducts() {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/products`, {
      credentials: "include", // sends the better-auth session cookie
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    products.value = await res.json();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(getProducts);

async function getBills() {
  billsLoading.value = true;
  billsError.value = "";
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/bills`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const json = await res.json();
    bills.value = json.data;
  } catch (e) {
    billsError.value = e.message;
  } finally {
    billsLoading.value = false;
  }
}

function openOrders() {
  showBills.value = true;
  getBills(); // fetch fresh data every time the popup opens
}

async function getCustomers() {
  customersLoading.value = true;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/customers`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const json = await res.json();
    customers.value = json.data; // { message, data: [...] }
  } catch (e) {
    customerError.value = e.message;
  } finally {
    customersLoading.value = false;
  }
}

function openCustomer() {
  customerError.value = "";
  showCustomer.value = true;
  getCustomers(); // populate the popup first
}

async function saveCustomer({ name, telp, type }) {
  customerSaving.value = true;
  customerError.value = "";
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/customers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, telp, type }),
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const json = await res.json();
    customer.value = json.data ?? { name, telp, type }; // assumes { data: { id, ... } }
    showCustomer.value = false;
  } catch (e) {
    customerError.value = e.message;
  } finally {
    customerSaving.value = false;
  }
}

function selectCustomer(c) {
  customer.value = c;
  showCustomer.value = false;
}

async function logout() {
  // useSession() in App.vue updates, which renders Login again
  await authClient.signOut();
}

function replaceBill(bill) {
  // billItems only has product_id, price, qty, so look up names from the loaded products.
  // Merge duplicate product_ids: productsList keys must be unique (used as :key in v-for).
  const merged = new Map();
  for (const { product_id, price, qty } of bill.billItems) {
    const existing = merged.get(product_id);
    if (existing) existing.qty += qty;
    else
      merged.set(product_id, {
        product_id,
        name: products.value.find((p) => p.id === product_id)?.name ?? `Product #${product_id}`,
        price,
        qty,
      });
  }
  productsList.value = [...merged.values()];
  billId.value = bill.billId; // next save updates this bill
  showBills.value = false;
}

function addProduct({ id, name, price }) {
  const existing = productsList.value.find((p) => p.product_id === id);
  if (existing) existing.qty += 1;
  else productsList.value.push({ product_id: id, name, price, qty: 1 });
}

function removeProduct(id) {
  productsList.value = productsList.value.filter((p) => p.product_id !== id);
}

// Recomputes whenever productsList changes (items added or qty changed)
const grandTotal = computed(() =>
  productsList.value.reduce((sum, p) => sum + p.price * p.qty, 0)
);

// Fetch the saved bill and open the print popup
async function showReceipt(id) {
  printData.value = null;
  printError.value = "";
  printLoading.value = true;
  showPrint.value = true;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/bills/${id}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const json = await res.json();
    printData.value = json.data; // single bill object
  } catch (e) {
    printError.value = e.message;
  } finally {
    printLoading.value = false;
  }
}

// Emitted by PrintPopup: build the receipt PDF with pdfmake and print it
async function printBill() {
  const bill = printData.value;
  if (!bill) return;

  // Load pdfmake only when printing (it is large)
  const [{ default: pdfMake }, pdfFonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  // vfs_fonts exports differ between pdfmake versions, so find the object that holds the font files
  const vfs = [
    pdfFonts.default?.pdfMake?.vfs, // 0.2.x
    pdfFonts.pdfMake?.vfs,
    pdfFonts.default?.vfs,
    pdfFonts.vfs,
    pdfFonts.default, // 0.3.x: the module itself is the vfs
    pdfFonts,
  ].find((v) => v && v["Roboto-Medium.ttf"]);
  if (!vfs) throw new Error("pdfmake fonts not found");

  if (typeof pdfMake.addVirtualFileSystem === "function") pdfMake.addVirtualFileSystem(vfs); // 0.3.x
  else pdfMake.vfs = vfs; // 0.2.x

  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(bill.created_at));

  const docDefinition = {
    pageSize: { width: 226, height: "auto" }, // ~80mm receipt paper
    pageMargins: [12, 12, 12, 12],
    defaultStyle: { fontSize: 9 },
    content: [
      { text: "BAKSO DJAYA", style: "title", alignment: "center" },
      { text: `Bill #${bill.billId}`, alignment: "center", margin: [0, 0, 0, 6] },
      { text: `Date: ${date}` },
      { text: `Customer: ${bill.customer_name ?? "-"}` },
      { text: `Customer ID: ${bill.customer_id ?? "-"}`, margin: [0, 0, 0, 6] },
      {
        table: {
          widths: ["*", "auto", "auto"],
          body: [
            [{ text: "Item", bold: true }, { text: "Qty", bold: true, alignment: "right" }, { text: "Subtotal", bold: true, alignment: "right" }],
            ...bill.billItems.map((i) => [
              i.name,
              { text: String(i.qty), alignment: "right" },
              { text: rupiah.format(i.price * i.qty), alignment: "right" },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: `Total: ${rupiah.format(bill.grand_total)}`, bold: true, alignment: "right", margin: [0, 8, 0, 0] },
      { text: "Thank you!", alignment: "center", margin: [0, 10, 0, 0] },
    ],
    styles: { title: { fontSize: 14, bold: true, margin: [0, 0, 0, 4] } },
  };

  await pdfMake.createPdf(docDefinition).print(); // opens the print dialog (use .open() to preview instead)
}

async function saveBill(paymentMethod = null) {
  saving.value = true;
  saveMessage.value = "";
  saveFailed.value = false;

  const payload = {
    ...(billId.value ? { billId: billId.value } : {}), // only if existing
    customerId: customer.value?.id ?? null,
    employeeId: props.user.id,
    grandTotal: grandTotal.value,
    paymentMethod, // null when saved as pending, otherwise "qris" | "card" | "cash"
    billItems: productsList.value.map(({ product_id, price, qty }) => ({ product_id, price, qty })),
  };

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/bills`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const json = await res.json();

    // existing bill keeps its id; for a new one it comes from the response
    const savedBillId = billId.value ?? json.data?.id ?? json.data?.billId;

    // Success: reset state so the next order starts fresh
    productsList.value = [];
    billId.value = null;
    customer.value = null;
    showPayment.value = false;
    saveMessage.value = "Bill saved";

    // Only paid bills (with a payment method) get a printable receipt
    if (paymentMethod && savedBillId) showReceipt(savedBillId);
  } catch (e) {
    saveFailed.value = true;
    saveMessage.value = e.message;
  } finally {
    saving.value = false;
  }
}

// Watcher alternative / side effects (deep so qty changes are caught)
watch(productsList, (list) => console.log("productsList changed", list), { deep: true });
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <Navbar :username="user.name" :role="user.role" @orders="openOrders" @logout="logout" />

    <div class="flex flex-1">
      <!-- Left: 2/5 productSlot container -->
      <aside class="flex w-2/5 flex-col gap-2 border-r p-4">
        <h2 class="text-lg font-semibold">Order</h2>
        <Button variant="outline" size="sm" @click="openCustomer">
          {{ customer ? `Customer: ${customer.name}` : "Add customer" }}
        </Button>
        <p v-if="!productsList.length" class="text-sm text-muted-foreground">
          No items yet. Add a product from the list.
        </p>
        <ProductSlot
          v-for="item in productsList"
          :key="item.product_id"
          :id="item.product_id"
          :name="item.name"
          :price="item.price"
          :quantity="item.qty"
          @remove-product="removeProduct"
        />
        <p v-if="productsList.length" class="mt-2 text-right font-semibold">
          Total: {{ rupiah.format(grandTotal) }}
        </p>
        <div class="flex gap-2">
          <Button class="flex-1" variant="outline" :disabled="saving || !productsList.length" @click="saveBill()">
            {{ saving ? "Saving..." : "Save bill" }}
          </Button>
          <Button class="flex-1" :disabled="saving || !productsList.length" @click="showPayment = true">
            Pay
          </Button>
        </div>
        <p v-if="saveMessage" class="text-sm" :class="saveFailed ? 'text-destructive' : 'text-muted-foreground'">
          {{ saveMessage }}
        </p>
      </aside>

      <!-- Right: 3/5 products container -->
      <main class="w-3/5 p-4">
        <p v-if="loading" class="text-sm text-muted-foreground">Loading products...</p>
        <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
        <div v-else class="products-grid">
          <ProductCard
            v-for="p in products"
            :key="p.id"
            :id="p.id"
            :name="p.name"
            :picture="p.picture"
            :price="p.price"
            @add-product="addProduct"
          />
        </div>
      </main>
    </div>

    <PaymentPopup
      v-model:open="showPayment"
      :total-bill="grandTotal"
      :saving="saving"
      :error="saveFailed ? saveMessage : ''"
      @save-bill="saveBill"
    />

    <PrintPopup
      v-model:open="showPrint"
      :bill="printData"
      :loading="printLoading"
      :error="printError"
      @print-bill="printBill"
    />

    <CustomerPopup
      v-model:open="showCustomer"
      :customers="customers"
      :loading="customersLoading"
      :saving="customerSaving"
      :error="customerError"
      @save-customer="saveCustomer"
      @select-customer="selectCustomer"
    />

    <BillPopup v-model:open="showBills" :bills="bills" :loading="billsLoading" :error="billsError" @replace-bill="replaceBill" />
  </div>
</template>

<style scoped>
/* flex row + wrap, max 4 per row */
.products-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.products-grid > * {
  flex: 0 0 calc((100% - 3 * 0.75rem) / 4);
  max-width: calc((100% - 3 * 0.75rem) / 4);
}
</style>