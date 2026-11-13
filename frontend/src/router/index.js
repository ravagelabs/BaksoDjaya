import { createRouter, createWebHistory } from 'vue-router'
// Kasir & Pembayaran dimuat langsung supaya tombol "Bayar" terasa instan (tanpa menunggu download halaman)
import KasirView from '@/views/KasirView.vue'
import PembayaranView from '@/views/PembayaranView.vue'

// Halaman lain dimuat saat dibuka, dan disiapkan di belakang layar setelah aplikasi tampil
const views = {
  meja: () => import('@/views/MejaView.vue'),
  dapur: () => import('@/views/DapurView.vue'),
  transaksi: () => import('@/views/TransaksiView.vue'),
  shift: () => import('@/views/ShiftView.vue'),
  laporan: () => import('@/views/LaporanView.vue'),
  pengaturan: () => import('@/views/PengaturanView.vue'),
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/kasir' },
    { path: '/kasir', name: 'kasir', component: KasirView },
    { path: '/meja', name: 'meja', component: views.meja },
    { path: '/dapur', name: 'dapur', component: views.dapur },
    { path: '/transaksi', name: 'transaksi', component: views.transaksi },
    { path: '/transaksi/bayar', name: 'bayar', component: PembayaranView },
    { path: '/shift', name: 'shift', component: views.shift },
    { path: '/laporan', name: 'laporan', component: views.laporan },
    { path: '/pengaturan', name: 'pengaturan', component: views.pengaturan },
    { path: '/:pathMatch(.*)*', redirect: '/kasir' },
  ],
})

// Prefetch semua halaman saat browser sedang santai, jadi pindah menu tidak terasa lag
const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500))
router.isReady().then(() => idle(() => Object.values(views).forEach((load) => load().catch(() => {}))))

export default router
