# wist-ingest-web

`wist-ingest-ctrl` 的管理台（React + Vite + TypeScript）。只做展示和触发，不持有 CA 私钥。

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

开发态不使用容器里的 nginx 配置；要联调 mTLS 直接用 stack：`bash sys/scripts/gen-mtls-dev.sh` 生成证书后 `docker compose up`。

## 构建

```bash
npm install
npm run build      # dist/
```

> 首次 `npm install` 后请提交 `package-lock.json`，之后 Dockerfile 可切回 `npm ci`。

## 页面

| 区块 | 数据来源 |
|---|---|
| 状态 / lint / 上次生效 | `GET /api/v1/status` |
| 身份文件（指纹、mode、notAfter） | `GET /api/v1/certs` |
| 当前作用域 / 传输身份 | `GET /api/v1/whoami` |
| 应用配置并重启 | `POST /api/v1/apply?restart=true`（仅 `admin`） |

token 存在 `sessionStorage`（关标签页即失效），不写 localStorage。mTLS 之外仍保留 Bearer token 作为第二因子。

### 权限控（对齐 center）

前端只做**展示层适配**，真正的强制在 ctrl：

- 登录后先调 `/api/v1/whoami`：`scope=admin` 才能看到可用的“应用配置并重启”；`viewer` 显示只读提示；
- `401` → 清掉 token 并提示重新输入；`403 insufficient_scope` → 提示权限不足；`429` → 显示 `Retry-After`；
- 传输身份（mTLS 证书的 `CN`/URI SAN/指纹）与授权作用域在页面上分开显示——它们是两件事。
