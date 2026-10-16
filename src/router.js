import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/phrases', component: () => import('./views/PhrasebookView.vue') },
    { path: '/favorites', component: () => import('./views/FavoritesView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') }
  ]
})
