# wist-ingest-web

`wist-ingest-ctrl` 的管理台（React + Vite + TypeScript）。只做展示和触发，不持有 CA 私钥。

界面风格与 **wist-center-web / wist-gateway-web 同一套设计令牌**（表面分层、语义状态色、IBM Plex
本地字体、明暗主题）；页面用 hash 路由，刷新 / 分享 / 后退都能回到同一页。

## 与 ctrl 的连接方式（mTLS）

与 `wist-gwlinkd ↔ Center` 同构：**本容器作为客户端出示证书**，ctrl 作为服务端校验。

| 文件（挂到 `/etc/nginx/tls/`） | 用途 |
|---|---|
| `web.pem` / `web.key` | 浏览器访问本页面用的服务端证书 |
| `web-client.pem` / `web-client.key` | 本容器访问 ctrl 的客户端证书 |
| `ctrl-ca.pem` | 校验 ctrl 服务端证书的信任锚 |

约束：

- 客户端证书 `EKU=clientAuth`；身份用 URI SAN `wist://gateway/web`（ctrl 的 `/api/v1/whoami` 会回显）；
- ctrl 服务端证书的 SAN 必须是 `ingest-ctrl`（与 `proxy_ssl_name` 一致）；
- 私钥 `0640`、属组=容器 gid（999），只读挂载。

## 开发

```bash
# 本机起 ctrl（不配 [ctrl.tls] 时走明文，仅供开发）
INGEST_CTRL_TOKEN=dev-token wist-ingest-ctrl --config ./examples/ingest.toml serve

npm install
npm run dev        # http://127.0.0.1:5174，/api 代理到 19091（http）
```

本机另起一份 ctrl 联调时，用 `INGEST_CTRL_DEV_URL` 覆盖代理目标（默认 `http://127.0.0.1:19091`）：

```bash
INGEST_CTRL_DEV_URL=http://127.0.0.1:19092 npm run dev
```

开发态不使用容器里的 nginx 配置；要联调 mTLS 直接用 stack：`bash sys/scripts/gen-mtls-dev.sh` 生成证书后 `docker compose up`。

## 构建

```bash
npm install
npm run build      # dist/
```

> 首次 `npm install` 后请提交 `package-lock.json`，之后 Dockerfile 可切回 `npm ci`。

## 页面

| 页面 / 区块 | 数据来源 |
|---|---|
| 总览：状态 / lint / 上次生效 / 网关台账 | `GET /api/v1/status`、`GET /api/v1/links` |
| 网关接入：签发 / 轮换 / 撤销接入券 | `GET /api/v1/links`、`POST /api/v1/gateways/{gateway}/link-token`、`DELETE /api/v1/gateways/{gateway}/link` |
| 配置与规则：wparse 当前配置 / WPL / OML | `GET /api/v1/data-plane/tree`、`GET /api/v1/data-plane/file?path=…` |
| 身份与状态：作用域 / 传输身份 / 身份证件 / lint | `GET /api/v1/whoami`、`GET /api/v1/certs`、`GET /api/v1/status` |
| 应用配置并重启 | `POST /api/v1/apply?restart=true`（仅 `admin`） |

「网关接入」页的接入券**只在内存里展示一次**（刷新 / 切页即丢）；页面不会把它写进
`localStorage` / `sessionStorage`，也不回显已消费的券。

token 存在 `sessionStorage`（关标签页即失效），不写 localStorage。mTLS 之外仍保留 Bearer token 作为第二因子。

### 权限控（对齐 center）

前端只做**展示层适配**，真正的强制在 ctrl：

- 登录后先调 `/api/v1/whoami`：`scope=admin` 才能看到可用的“应用配置并重启”；`viewer` 显示只读提示；
- `401` → 清掉 token 并提示重新输入；`403 insufficient_scope` → 提示权限不足；`429` → 显示 `Retry-After`；
- 传输身份（mTLS 证书的 `CN`/URI SAN/指纹）与授权作用域在页面上分开显示——它们是两件事。
