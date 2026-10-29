# Changelog

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
