import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '平潭话翻译器',
        short_name: '平潭话',
        description: '平潭话与普通话双向语音翻译',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d3557',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: { proxy: { '/api': 'http://localhost:8787' } }
})
