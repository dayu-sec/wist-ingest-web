# wist-ingest-web — 静态前端 + nginx（HTTPS + 上游 mTLS）
#
# dist/ 由 CI 预先构建（`npm ci && npm run build`），这里只做托管：
# buildx 多架构构建时 arm64 会走 QEMU，在镜像里跑 node 构建要十几分钟。
#
# 本地手工构建：
#   npm ci && npm run build
#   docker build -t wist-ingest-web:dev .
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html

EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
