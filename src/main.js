import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

const app = createApp(App)

app.use(PrimeVue, {
    theme: {
        preset: Aura
    },
    license: 'eyJpZCI6ImRjZGVmNjA2LTQ4ZGMtNDQzMy05MTJjLTI2OWI4YzIzMmI1YiIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODk2MjQ0MDMsImV4cCI6MTgyMTE2MDQwM30.0c8gzSHvtRJSTURQqJeVFS6ToS4hu30LgGqEbtwn5_m34tvN7XJn84T4BpAT12m8knVlGj_X7XjW1hPHpdxnAQ'
});

app.mount('#app')
