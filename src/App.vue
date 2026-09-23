<script setup>
import { Splitter, SplitterPanel, Card } from 'primevue';
import { ref, onMounted } from 'vue';

const products = ref([])

const invoiceItems = ref([])

async function fetchProducts () {
  let response = await fetch('https://dummyjson.com/products');
  if(response.ok){
    let data = await response.json()
    products.value = data.products
  } else {
    console.log(response.status);
  }
}

function addItem(id, title, price) {
  const existingItem = invoiceItems.value.find(product => product.id === id)

  if(existingItem){
    existingItem.quantity += 1
  } else { 
    invoiceItems.value.push({
      id: id,
      title: title, 
      price: price,
      quantity: 1
    })
  }
}

onMounted(() => {
  fetchProducts();
})
</script>

<template>
    <div class="w-full">
        <Splitter :sizes="[30, 70]" class="min-h-[500px] w-full">
            <SplitterPanel :minSize="10" class="p-4 flex flex-col gap-4 overflow-y-auto">
              <div v-for="item in invoiceItems" :key="item.id">
                  <Card class="w-full">
                      <template #title>{{ item.title }}</template>
                      <template #subtitle>${{ item.price }}</template>
                      <template #content>
                          <p class="m-0"></p>
                      </template>
                      <template #footer>
                          <span class="text-sm text-surface-500 dark:text-surface-400">Qty: {{ item.quantity }}</span>
                      </template>
                  </Card>
              </div>
            </SplitterPanel>

            <SplitterPanel class="p-4 overflow-y-auto">
                <div class="grid grid-cols-4 gap-4 w-full">
                    <div 
                      v-for="product in products" 
                      :key="product.id" 
                      @click="addItem(product.id, product.title, product.price)"
                      class="cursor-pointer transition-transform duration-150 hover:-translate-y-1"
                    >
                      <Card class="h-full flex flex-col justify-between">
                          <template #title>
                            <span class="text-base font-semibold line-clamp-1">{{ product.title }}</span>
                          </template>
                          <template #subtitle>
                            <span class="text-xs"></span>
                          </template>
                          <template #content>
                              <p class="text-sm text-surface-600 dark:text-surface-300 line-clamp-2">
                                {{ product.description }}
                              </p>
                          </template>
                          <template #footer>
                              <div class="flex items-center justify-between mt-auto pt-2">
                                  <p class="text-lg font-bold">${{ product.price }}</p>
                              </div>
                          </template>
                      </Card>
                    </div>
                </div>
            </SplitterPanel>
        </Splitter>
    </div>
</template>

<style scoped>
</style>