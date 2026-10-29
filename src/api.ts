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
  const body = text ? JSON.parse(text) : null

  if (!res.ok) {
    const retryAfter = Number(res.headers.get('retry-after') ?? '') || undefined
    if (body?.error) {
      throw new ApiError(res.status, body.error.code ?? 'unknown', body.error.message ?? res.statusText, retryAfter)
    }
    throw new ApiError(res.status, 'unknown', `${res.status} ${res.statusText}`, retryAfter)
  }
  return body as T
}

export const getStatus = () => request<Status>('/api/v1/status')

export const getCerts = () => request<CertFile[]>('/api/v1/certs')

export const getWhoAmI = () => request<WhoAmI>('/api/v1/whoami')

export const applyConfig = (restart: boolean) =>
  request<ApplyState>(`/api/v1/apply?restart=${restart}`, { method: 'POST' })
