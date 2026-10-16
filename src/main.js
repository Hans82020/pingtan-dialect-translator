import { createApp } from 'vue'
import Vant from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import { router } from './router.js'

createApp(App).use(router).use(Vant).mount('#app')
