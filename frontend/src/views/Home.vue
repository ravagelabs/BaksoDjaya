<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar.vue";
import BillPopup from "@/components/BillPopup.vue";
import CustomerPopup from "@/components/CustomerPopup.vue";
import PaymentPopup from "@/components/PaymentPopup.vue";
import PrintPopup from "@/components/PrintPopup.vue";
import ShiftPopup from "@/components/ShiftPopup.vue";
import Shifts from "@/components/Shifts.vue";
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

// logout shift popup state
const showShift = ref(false);
const shiftLoading = ref(false);
const shiftError = ref("");
const shift = ref({ createdAt: null, endedAt: null });
const salesSummary = ref({ cash: 0, card: 0, qris: 0, total: 0 });

// shifts list popup state (like orders)
const shifts = ref([]); // from GET /shifts
const showShifts = ref(false);
const shiftsLoading = ref(false);
const shiftsError = ref("");

const API_URL = import.meta.env.VITE_API_URL || "";

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

async function getProducts() {
  try {
    const res = await fetch(`${API_URL}/products`, {
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
    const res = await fetch(`${API_URL}/bills?status=pending`, {
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

async function getShifts() {
  shiftsLoading.value = true;
  shiftsError.value = "";
  try {
    const res = await fetch(`${API_URL}/shifts`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const json = await res.json();
    shifts.value = json.data; // [{ id, created_at, ended_at, cash, card, qris, total }]
  } catch (e) {
    shiftsError.value = e.message;
  } finally {
    shiftsLoading.value = false;
  }
}

function openShifts() {
  showShifts.value = true;
  getShifts(); // fetch fresh data every time the popup opens
}

async function getCustomers() {
  customersLoading.value = true;
  try {
    const res = await fetch(`${API_URL}/customers`, {
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
    const res = await fetch(`${API_URL}/customers`, {
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

// Only the current shift's summary, no previous shifts here
async function logout() {
  shiftError.value = "";
  shiftLoading.value = true;
  showShift.value = true;
  try {
    const { data, error: err } = await authClient.getSession();
    if (err || !data?.session) throw new Error(err?.message ?? "Session not found");

    const createdAt = new Date(data.session.createdAt);
    const endedAt = new Date(); // current time
    shift.value = { createdAt, endedAt };

    const params = new URLSearchParams({
      from: createdAt.toISOString(),
      to: endedAt.toISOString(),
    });
    const res = await fetch(`${API_URL}/bills/summary?${params}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const json = await res.json();
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
    const res = await fetch(`${API_URL}/shifts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_at: shift.value.createdAt.toISOString(),
        ended_at: shift.value.endedAt.toISOString(),
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? `Request failed (${res.status})`);
    }

    showShift.value = false;
    // useSession() in App.vue updates, which renders Login again
    await authClient.signOut();
  } catch (e) {
    shiftError.value = e.message; // popup stays open so they can retry
  } finally {
    shiftLoading.value = false;
  }
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
    const res = await fetch(`${API_URL}/bills/${id}`, {
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

// ESC/POS builder: raw printer commands for an 80mm receipt (48 chars per line)
function buildEscposReceipt(bill) {
  const W = 48;
  const bytes = [];
  const enc = new TextEncoder();
  const write = (s) => bytes.push(...enc.encode(s));
  const cmd = (...b) => bytes.push(...b);
  const clean = (s) => String(s ?? "-").replace(/\u00a0/g, " "); // Intl adds NBSP before "Rp"
  const row = (left, right) => {
    const l = clean(left), r = clean(right);
    return l + " ".repeat(Math.max(1, W - l.length - r.length)) + r + "\n";
  };
  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(bill.created_at));

  cmd(0x1b, 0x40);             // ESC @  init printer
  cmd(0x1b, 0x61, 0x01);       // ESC a 1  center
  cmd(0x1b, 0x45, 0x01);       // ESC E 1  bold on
  write("BAKSO DJAYA\n");
  cmd(0x1b, 0x45, 0x00);       // bold off
  write(`Bill #${bill.billId}\n`);
  cmd(0x1b, 0x61, 0x00);       // ESC a 0  left
  write("-".repeat(W) + "\n");
  write(`Date: ${clean(date)}\n`);
  write(`Customer: ${clean(bill.customer_name)}\n`);
  write("-".repeat(W) + "\n");

  for (const i of bill.billItems) {
    write(`${clean(i.name)}\n`);
    write(row(`  ${i.qty} x ${rupiah.format(i.price)}`, rupiah.format(i.price * i.qty)));
  }

  write("-".repeat(W) + "\n");
  cmd(0x1b, 0x45, 0x01);
  write(row("TOTAL", rupiah.format(bill.grand_total)));
  cmd(0x1b, 0x45, 0x00);
  cmd(0x1b, 0x61, 0x01);
  write("\nThank you!\n");
  cmd(0x1b, 0x64, 0x04);       // ESC d 4  feed 4 lines
  cmd(0x1d, 0x56, 0x42, 0x00); // GS V B 0  partial cut (ignored by printers without a cutter)

  return new Uint8Array(bytes);
}

// Hands the ESC/POS bytes to RawBT, which sends them to the USB printer
function openInRawBT(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  window.location.href =
    `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`;
}

// Called from the PrintPopup button. Synchronous, so it runs inside the user's click.
function printBill() {
  if (!printData.value) return;
  openInRawBT(buildEscposReceipt(printData.value));
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
    const res = await fetch(`${API_URL}/bills`, {
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

watch(productsList, (list) => console.log("productsList changed", list), { deep: true });
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <Navbar :username="user.name" :role="user.role" @orders="openOrders" @shifts="openShifts" @logout="logout" />

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

    <Shifts v-model:open="showShifts" :shifts="shifts" :loading="shiftsLoading" :error="shiftsError" />

    <ShiftPopup
      v-model:open="showShift"
      :created-at="shift.createdAt"
      :ended-at="shift.endedAt"
      :summary="salesSummary"
      :loading="shiftLoading"
      :error="shiftError"
      :unsaved-items="productsList.length"
      @confirm-logout="confirmLogout"
    />
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