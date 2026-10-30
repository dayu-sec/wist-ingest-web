const TOKEN_KEY = 'wist-ingest-ctrl-token'

export function loadToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) ?? ''
}

export function saveToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export interface LintFinding {
  level: 'error' | 'warn'
  code: string
  message: string
}

export interface ApplyState {
  revision: string
  applied_at: string
  checked: boolean
  restarted: boolean
  files: string[]
}

export interface Status {
  container: string
  work_root: string
  listen: string
  port: number
  framing: string
  scope: 'viewer' | 'admin'
  tls: { cert_file: string; mtls: boolean; allow_unauthenticated: boolean } | null
  gateways: { name: string; tenant: string | null }[]
  lint: LintFinding[]
  state: ApplyState | null
}

export interface CertFile {
  role: string
  container_path: string
  host_path: string | null
  exists: boolean
  mode: string | null
  bytes: number | null
  sha256: string | null
  not_after: string | null
  subject: string | null
  error: string | null
}

export interface PeerIdentity {
  id: string
  cn: string | null
  uri: string | null
  fingerprint_sha256: string
  not_before: string
  not_after: string
}

export interface WhoAmI {
  authenticated: boolean
  scope: 'viewer' | 'admin'
  can_apply: boolean
  identity: PeerIdentity | null
}

/** 数据面入口（交付给网关的那一份）。 */
export interface DataEndpoint {
  host: string
  port: number
  framing: string
  tls: 'mtls'
  /** 入口来自 `[ctrl.link] advertise`（false = 由 ingest.bind:port 推导）。 */
  configured: boolean
  /** 推导出来是 0.0.0.0 之类的通配地址：对端连不上。 */
  wildcard: boolean
}

export type GrantState = 'none' | 'pending' | 'expired' | 'linked' | 'revoked'

export interface GrantView {
  gateway: string
  enabled: boolean
  tenant: string | null
  state: GrantState
  issued_at: string | null
  expires_at: string | null
  redeemed_at: string | null
  fingerprint_sha256: string | null
  token_pending: boolean
  /** 已登记过客户端证书指纹（已接入）。与 token_pending 不互斥。 */
  linked: boolean
}

export interface LinksView {
  ttl_seconds: number
  endpoint: DataEndpoint
  grants: GrantView[]
}

/** 签发响应：带一次性明文券（只在内存里展示，刷新即丢）。 */
export interface IssuedLink {
  gateway: string
  tenant: string | null
  link_token: string
  issued_at: string
  expires_at: string
  endpoint: DataEndpoint
  link: string
  trust_bundle_pem: string | null
  trust_bundle_error: string | null
}

export interface DataPlaneEntry {
  path: string
  kind: 'dir' | 'file'
  size: number
  modified: string | null
}

export interface DataPlaneTree {
  work_dir: string
  entries: DataPlaneEntry[]
  truncated: boolean
}

export interface DataPlaneFile {
  path: string
  size: number
  modified: string | null
  truncated: boolean
  binary: boolean
  content?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: number

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = loadToken()
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!res.ok) {
    const retryAfter = Number(res.headers.get('retry-after') ?? '') || undefined
    const envelope = (body as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(
      res.status,
      envelope?.code ?? 'unknown',
      envelope?.message ?? `${res.status} ${res.statusText}`,
      retryAfter,
    )
  }
  return body as T
}

export const getStatus = () => request<Status>('/api/v1/status')
export const getCerts = () => request<CertFile[]>('/api/v1/certs')
export const getWhoAmI = () => request<WhoAmI>('/api/v1/whoami')
export const getLinks = () => request<LinksView>('/api/v1/links')

export const applyConfig = (restart: boolean) =>
  request<ApplyState>(`/api/v1/apply?restart=${restart}`, { method: 'POST' })

/** 签发/轮换一次性接入券：明文只随本次响应交付（响应头 `no-store`）。 */
export const issueLink = (gateway: string) =>
  request<IssuedLink>(`/api/v1/gateways/${encodeURIComponent(gateway)}/link-token`, {
    method: 'POST',
  })

/** 撤销授权（清券 + 清指纹绑定）。 */
export const revokeLink = (gateway: string) =>
  request<GrantView>(`/api/v1/gateways/${encodeURIComponent(gateway)}/link`, {
    method: 'DELETE',
  })

export const getDataPlaneTree = () => request<DataPlaneTree>('/api/v1/data-plane/tree')

export const getDataPlaneFile = (path: string) =>
  request<DataPlaneFile>(`/api/v1/data-plane/file?path=${encodeURIComponent(path)}`)

/** 把后端错误翻译成页面上能看懂的一句话。 */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return '令牌无效或缺失（401）—— 点右上角「令牌」重新填入'
    if (error.status === 403) return '当前令牌没有该权限（403 insufficient_scope）：需要 admin'
    if (error.status === 429)
      return `鉴权失败次数过多，请 ${error.retryAfter ?? 60}s 后重试（429）`
    return `${error.code}: ${error.message}`
  }
  if (error instanceof TypeError) {
    return '无法访问 ctrl（网络 / 反代不可达）'
  }
  return (error as Error).message
}
