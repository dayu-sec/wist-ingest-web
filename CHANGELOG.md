# Changelog

## [0.2.0] - 2026-10-30

### 变更（界面风格对齐 wist-center）

- 设计令牌、侧边栏 + 顶部状态条、卡片 / 指标 / 徽标 / 代码块 / 令牌面板全部对齐
  `wist-center-web`（同一套 `--bg/--surface/--text/--accent/--ok/--warn/--crit` 与尺度）；
- IBM Plex Sans / Mono 随包本地加载（不依赖外网），明暗主题跟随系统并可切换
  （`<html data-theme>` + localStorage，首帧前定主题）；
- 四个页面用 hash 路由（`#overview` / `#access` / `#config` / `#identity`）：
  刷新、分享、浏览器后退都能回到同一页；顶部状态条显示同步状态 / 新鲜度 / 刷新 / 主题 / 令牌。

### 新增（数据面接入授权）

- 「网关接入」页：逐网关展示授权状态（未签发 / 待接入 / 已接入 / 券过期 / 已撤销，
  并区分「已接入 + 新券待消费」）；admin 可签发/轮换/撤销；
- 签发后在页面上交付接入物：一次性接入券（含 CA 的 `wist-ingest://` 串）、入口、到期倒计时、
  网关消费命令（curl）与 client CA PEM（可下载）；明文只留在内存，刷新即丢；
- 已接入：展示登记的客户端证书指纹与接入时间；券被消费后不再展示失效明文。

### 新增（wparse 配置与规则）

- 「配置与规则」页：左侧目录树（conf / connectors / topology / models + `wparse.local.toml`），
  右侧只读查看文本、复制/下载；标出截断与非文本；口径与 gateway 的「数据面配置」页一致。

### 新增（身份与状态）

- 本次连接（Bearer 作用域 + mTLS 传输身份）、管理面姿态、站点身份文件
  （存在性 / mode / SHA-256 / notAfter）、全量安全 lint。

## [0.1.2] - 2026-10-29

### 变更

- `/api` 的上游从 `host.docker.internal:19091` 改为 **`ctrl:19091`**：
  `wist-ingest-ctrl` 现在是 compose 里的 `ctrl` 服务（与 wist-center 同构），
  同网络直连，不再绕宿主回环。

## [0.1.1] - 2026-10-29

### 修复（发版链路，无功能变更）

- `Dockerfile` / `release.yml` 与 `wist-center-web` 同构：node 构建阶段 → nginx 运行阶段，
  单个 docker job 同推 ghcr 与腾讯云 TCR；预发布 tag 不覆盖 `:latest`。
- 修正镜像 tag 拼接：`printf` 参数多于占位符时会把最后两个 tag 粘成一行，
  docker 报 `invalid reference format`。

## [0.1.0] - 2026-10-29

### Added

- 初版管理台：ctrl token 输入（sessionStorage）、数据面状态、lint 结果、上次 apply 状态。
- 身份文件清单：存在性 / `mode` / 证书 SHA-256 指纹 / `notAfter`。
- 「应用配置并重启」按钮（`POST /api/v1/apply`）。
- 权限感知：登录后调 `GET /api/v1/whoami`，`viewer` 作用域下隐藏/禁用变更操作并显示只读提示；
  401 清 token（sessionStorage）、403 提示权限不足、429 显示 `Retry-After`。
- 网关台账（明确标注：证书身份尚未透出，不能作为授权依据）。
