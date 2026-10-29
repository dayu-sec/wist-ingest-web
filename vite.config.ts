import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发态直连本机 ctrl；容器里由 nginx 反代到 host.docker.internal。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:19091',
    },
  },
})
