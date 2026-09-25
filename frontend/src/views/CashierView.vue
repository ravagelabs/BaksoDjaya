<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const router = useRouter()

// --- State ---
const products = ref([])
const categories = ref([])
const selectedCategory = ref('ALL')
const cart = ref([])
const searchQuery = ref('')
const loadingProducts = ref(true)
const submittingBill = ref(false)

// Payment & Customer
const customerId = ref('')
const paymentMethod = ref('CASH') // 'CASH' | 'QRIS' | 'DEBIT'
const cashPaid = ref(0)
const errorMessage = ref('')
const successMessage = ref('')

// Category Management State
const showCategoryDialog = ref(false)
const newCategoryName = ref('')
const editingCategory = ref(null)

// Session
const session = authClient.useSession()

// --- Sign Out Action ---
async function handleSignOut() {
  await authClient.signOut()
  router.push('/login')
}

// --- API Calls ---
async function fetchProducts() {
  loadingProducts.value = true
  try {
    const res = await fetch('https://posdev.ravagelabs.id/products', { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch products')
    products.value = await res.json()
  } catch (err) {
    errorMessage.value = err.message || 'Could not load products'
  } finally {
    loadingProducts.value = false
  }
}

async function fetchCategories() {
  try {
    const res = await fetch('https://posdev.ravagelabs.id/categories', { credentials: 'include' })
    if (res.ok) {
      categories.value = await res.json()
    }
  } catch (err) {
    console.error('Category fetch error:', err)
  }
}

// --- Category CRUD ---
async function createCategory() {
  if (!newCategoryName.value.trim()) return
  try {
    const res = await fetch('https://posdev.ravagelabs.id/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newCategoryName.value }),
    })
    if (!res.ok) throw new Error('Failed to create category')
    newCategoryName.value = ''
    await fetchCategories()
  } catch (err) {
    errorMessage.value = err.message
  }
}

async function updateCategory(cat) {
  try {
    const res = await fetch(`https://posdev.ravagelabs.id/categories/${cat.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: cat.name }),
    })
    if (!res.ok) throw new Error('Failed to update category')
    editingCategory.value = null
    await fetchCategories()
  } catch (err) {
    errorMessage.value = err.message
  }
}

async function deleteCategory(id) {
  try {
    const res = await fetch(`https://posdev.ravagelabs.id/categories/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to delete category')
    await fetchCategories()
  } catch (err) {
    errorMessage.value = err.message
  }
}

// --- Checkout ---
async function handleCheckout() {
  errorMessage.value = ''
  successMessage.value = ''

  if (cart.value.length === 0) {
    errorMessage.value = 'Cart is empty.'
    return
  }

  if (paymentMethod.value === 'CASH' && cashPaid.value < grandTotal.value) {
    errorMessage.value = 'Cash paid is less than the total amount.'
    return
  }

  submittingBill.value = true

  const formattedItems = cart.value.map((item) => ({
    productId: item.id,
    quantity: item.quantity,
    price: item.price,
  }))

  const billPayload = {
    customerId: customerId.value ? Number(customerId.value) : null,
    employeeId: session.value?.data?.user?.id || null,
    totalPrice: grandTotal.value,
    status: true, // boolean status matching DB schema
    paymentMethod: paymentMethod.value,
    items: formattedItems,
  }

  try {
    const res = await fetch('https://posdev.ravagelabs.id/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(billPayload),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Failed to process transaction')

    successMessage.value = `Bill #${data.id} created successfully!`
    clearCart()
  } catch (err) {
    errorMessage.value = err.message || 'Error processing bill'
  } finally {
    submittingBill.value = false
  }
}

// --- Cart Helpers ---
function addToCart(product) {
  const existing = cart.value.find((item) => item.id === product.id)
  if (existing) {
    existing.quantity += 1
  } else {
    cart.value.push({
      id: item.id,          
      qty: item.quantity,   
      price: item.price,
    })
  }
}

function updateQuantity(productId, delta) {
  const item = cart.value.find((i) => i.id === productId)
  if (!item) return
  item.quantity += delta
  if (item.quantity <= 0) removeFromCart(productId)
}

function removeFromCart(productId) {
  cart.value = cart.value.filter((i) => i.id !== productId)
}

function clearCart() {
  cart.value = []
  customerId.value = ''
  cashPaid.value = 0
  paymentMethod.value = 'CASH'
}

// --- Computed ---
const filteredProducts = computed(() => {
  return products.value.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory =
      selectedCategory.value === 'ALL' || p.categoryId === selectedCategory.value
    return matchesSearch && matchesCategory
  })
})

const subtotal = computed(() =>
  cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
)
const grandTotal = computed(() => subtotal.value)
const changeDue = computed(() => {
  if (paymentMethod.value !== 'CASH') return 0
  const change = cashPaid.value - grandTotal.value
  return change > 0 ? change : 0
})

onMounted(() => {
  fetchProducts()
  fetchCategories()
})
</script>

<template>
  <div class="flex h-screen w-full flex-col bg-muted/40 lg:flex-row">
    <!-- Left Panel: Product Catalog & Category Filter -->
    <div class="flex flex-1 flex-col p-4 md:p-6 lg:w-2/3">
      <!-- Header Bar -->
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Bakso Djaya POS</h1>
          <p class="text-sm text-muted-foreground">Select products to build bill</p>
        </div>

        <div class="flex items-center gap-3">
          <Input
            v-model="searchQuery"
            type="search"
            placeholder="Search products..."
            class="max-w-xs bg-background"
          />

          <!-- Manage Categories Dialog -->
          <Dialog v-model:open="showCategoryDialog">
            <DialogTrigger as-child>
              <Button variant="outline" size="sm">Categories</Button>
            </DialogTrigger>
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Category Management</DialogTitle>
                <DialogDescription>Add, update, or remove menu categories.</DialogDescription>
              </DialogHeader>

              <!-- Add Category Input -->
              <div class="flex gap-2 my-2">
                <Input
                  v-model="newCategoryName"
                  placeholder="New category name"
                  @keyup.enter="createCategory"
                />
                <Button @click="createCategory">Add</Button>
              </div>

              <!-- Categories List -->
              <div class="max-h-60 overflow-y-auto space-y-2">
                <div
                  v-for="cat in categories"
                  :key="cat.id"
                  class="flex items-center justify-between border rounded p-2 text-sm"
                >
                  <Input
                    v-if="editingCategory?.id === cat.id"
                    v-model="editingCategory.name"
                    class="h-8"
                  />
                  <span v-else>{{ cat.name }}</span>

                  <div class="flex gap-1">
                    <Button
                      v-if="editingCategory?.id === cat.id"
                      size="xs"
                      variant="outline"
                      @click="updateCategory(editingCategory)"
                    >
                      Save
                    </Button>
                    <Button
                      v-else
                      size="xs"
                      variant="ghost"
                      @click="editingCategory = { ...cat }"
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="text-destructive"
                      @click="deleteCategory(cat.id)"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" @click="handleSignOut">
            Sign Out
          </Button>
        </div>
      </div>

      <!-- Category Filter Pills -->
      <div class="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Button
          :variant="selectedCategory === 'ALL' ? 'default' : 'outline'"
          size="sm"
          @click="selectedCategory = 'ALL'"
        >
          All
        </Button>
        <Button
          v-for="cat in categories"
          :key="cat.id"
          :variant="selectedCategory === cat.id ? 'default' : 'outline'"
          size="sm"
          @click="selectedCategory = cat.id"
        >
          {{ cat.name }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="loadingProducts" class="flex flex-1 items-center justify-center">
        <p class="text-muted-foreground">Loading products...</p>
      </div>

      <!-- Product Grid -->
      <div
        v-else-if="filteredProducts.length > 0"
        class="grid flex-1 grid-cols-2 gap-4 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4"
      >
        <Card
          v-for="product in filteredProducts"
          :key="product.id"
          class="cursor-pointer transition-all hover:border-primary hover:shadow-md"
          @click="addToCart(product)"
        >
          <CardHeader class="p-4 pb-2">
            <CardTitle class="text-base font-semibold">{{ product.name }}</CardTitle>
          </CardHeader>
          <CardContent class="p-4 pt-0">
            <p class="text-lg font-bold text-primary">
              Rp{{ Number(product.price).toLocaleString('id-ID') }}
            </p>
          </CardContent>
        </Card>
      </div>

      <div v-else class="flex flex-1 items-center justify-center rounded-lg border border-dashed">
        <p class="text-muted-foreground">No products found.</p>
      </div>
    </div>

    <!-- Right Panel: Current Bill & Payment -->
    <div class="flex w-full flex-col border-l bg-background p-4 md:p-6 lg:w-1/3">
      <Card class="flex flex-1 flex-col border-none shadow-none">
        <CardHeader class="px-0 pt-0">
          <div class="flex items-center justify-between">
            <CardTitle class="text-xl">Current Bill</CardTitle>
            <Button
              v-if="cart.length > 0"
              variant="ghost"
              size="sm"
              class="text-destructive"
              @click="clearCart"
            >
              Clear
            </Button>
          </div>
          <CardDescription>
            Logged in as: {{ session?.data?.user?.name || 'Cashier' }}
          </CardDescription>
        </CardHeader>

        <!-- Cart Items List -->
        <CardContent class="flex-1 overflow-y-auto px-0 space-y-3">
          <div v-if="cart.length === 0" class="py-12 text-center text-sm text-muted-foreground">
            No items added yet. Click on products to add them.
          </div>

          <div
            v-for="item in cart"
            :key="item.id"
            class="flex items-center justify-between rounded-lg border p-3"
          >
            <div class="flex-1">
              <p class="font-medium text-sm">{{ item.name }}</p>
              <p class="text-xs text-muted-foreground">
                Rp{{ item.price.toLocaleString('id-ID') }} x {{ item.quantity }} = Rp{{
                  (item.price * item.quantity).toLocaleString('id-ID')
                }}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                @click="updateQuantity(item.id, -1)"
              >
                -
              </Button>
              <span class="w-6 text-center text-sm font-medium">{{ item.quantity }}</span>
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                @click="updateQuantity(item.id, 1)"
              >
                +
              </Button>
            </div>
          </div>
        </CardContent>

        <!-- Checkout & Payment Details -->
        <CardFooter class="flex flex-col gap-4 border-t px-0 pt-4">
          <div class="w-full space-y-1">
            <Label for="customer-id" class="text-xs">Customer ID</Label>
            <Input
              id="customer-id"
              v-model="customerId"
              type="number"
              placeholder="Enter customer ID"
              required
            />
          </div>

          <!-- Payment Method Selection -->
          <div class="w-full space-y-1.5">
            <Label class="text-xs">Payment Method</Label>
            <div class="grid grid-cols-3 gap-2">
              <Button
                type="button"
                :variant="paymentMethod === 'CASH' ? 'default' : 'outline'"
                size="sm"
                @click="paymentMethod = 'CASH'"
              >
                Cash
              </Button>
              <Button
                type="button"
                :variant="paymentMethod === 'QRIS' ? 'default' : 'outline'"
                size="sm"
                @click="paymentMethod = 'QRIS'"
              >
                QRIS
              </Button>
              <Button
                type="button"
                :variant="paymentMethod === 'DEBIT' ? 'default' : 'outline'"
                size="sm"
                @click="paymentMethod = 'DEBIT'"
              >
                Debit
              </Button>
            </div>
          </div>

          <!-- Cash Received Input (Only visible when CASH is selected) -->
          <div v-if="paymentMethod === 'CASH'" class="w-full space-y-1">
            <Label for="cash" class="text-xs">Cash Received (Rp)</Label>
            <Input
              id="cash"
              v-model.number="cashPaid"
              type="number"
              step="500"
              min="0"
            />
          </div>

          <!-- Summary Calculations -->
          <div class="w-full space-y-1.5 text-sm">
            <div class="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>Rp{{ subtotal.toLocaleString('id-ID') }}</span>
            </div>
            <div class="flex justify-between font-bold text-base">
              <span>Total Amount</span>
              <span>Rp{{ grandTotal.toLocaleString('id-ID') }}</span>
            </div>
            <div
              v-if="paymentMethod === 'CASH'"
              class="flex justify-between text-sm font-medium text-emerald-600"
            >
              <span>Change Due</span>
              <span>Rp{{ changeDue.toLocaleString('id-ID') }}</span>
            </div>
          </div>

          <p v-if="errorMessage" class="text-xs text-destructive">{{ errorMessage }}</p>
          <p v-if="successMessage" class="text-xs text-emerald-600 font-medium">
            {{ successMessage }}
          </p>

          <Button
            class="w-full"
            size="lg"
            :disabled="cart.length === 0 || submittingBill || !customerId"
            @click="handleCheckout"
          >
            {{ submittingBill ? 'Processing...' : 'Complete & Print Bill' }}
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>