import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发态直连本机 ctrl（宿主上另起一份时改端口即可）；容器里由 nginx 反代到 ctrl:19091。
export default defineConfig({
  plugins: [react()],
  // 版本号来自 Dockerfile 的 `ARG APP_VERSION`（`VITE_APP_VERSION`）；本地构建回落 dev。
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? 'dev'),
  },
  server: {
    port: 5174,
    proxy: {
      // 本机另起一份 ctrl 联调时用 INGEST_CTRL_DEV_URL 覆盖（默认栈里的 19091）。
      '/api': process.env.INGEST_CTRL_DEV_URL ?? 'http://127.0.0.1:19091',
    },
  },
})
