# ===========================================================================
# wist-ingest-web — 前端构建 + 静态托管（nginx，HTTPS + 上游 mTLS）
#
# 1. node 构建阶段：npm ci + npm run build → dist/
# 2. nginx 运行阶段：静态托管
#
# 与 `wist-center-web` 的差异只有一处：这里把 `nginx.conf` 打进镜像（栈只挂 TLS 证书，
# 不挂站点配置）。镜像地址与构建契约（context: . + APP_VERSION）保持同构。
# ===========================================================================

# ── 构建阶段 ──
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build

# ── 运行阶段 ──
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
