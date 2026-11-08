import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/kasir' },
    { path: '/kasir', name: 'kasir', component: () => import('@/views/KasirView.vue') },
    { path: '/meja', name: 'meja', component: () => import('@/views/MejaView.vue') },
    { path: '/dapur', name: 'dapur', component: () => import('@/views/DapurView.vue') },
    { path: '/transaksi', name: 'transaksi', component: () => import('@/views/TransaksiView.vue') },
    { path: '/transaksi/bayar', name: 'bayar', component: () => import('@/views/PembayaranView.vue') },
    { path: '/laporan', name: 'laporan', component: () => import('@/views/LaporanView.vue') },
    { path: '/pengaturan', name: 'pengaturan', component: () => import('@/views/PengaturanView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/kasir' },
  ],
})

export default router
