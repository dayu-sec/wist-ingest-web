# wist-ingest-web — 前端构建 + 静态托管（nginx，HTTPS + 上游 mTLS）
#
# 1. node 构建阶段：npm install + npm run build → dist/
# 2. nginx 运行阶段：443 服务前端；/api 以**客户端证书**反代到宿主上的 wist-ingest-ctrl
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
