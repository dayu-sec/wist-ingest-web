# Changelog

## [0.1.0] - 2026-10-29

### Added

- 初版管理台：ctrl token 输入（sessionStorage）、数据面状态、lint 结果、上次 apply 状态。
- 身份文件清单：存在性 / `mode` / 证书 SHA-256 指纹 / `notAfter`。
- 「应用配置并重启」按钮（`POST /api/v1/apply`）。
- 权限感知：登录后调 `GET /api/v1/whoami`，`viewer` 作用域下隐藏/禁用变更操作并显示只读提示；
  401 清 token（sessionStorage）、403 提示权限不足、429 显示 `Retry-After`。
- 网关台账（明确标注：证书身份尚未透出，不能作为授权依据）。
