import { useEffect, useState } from 'react'
import {
  ApiError,
  applyConfig,
  clearToken,
  getCerts,
  getStatus,
  getWhoAmI,
  loadToken,
  saveToken,
  type CertFile,
  type Status,
  type WhoAmI,
} from './api'

export default function App() {
  const [token, setToken] = useState(loadToken())
  const [status, setStatus] = useState<Status | null>(null)
  const [certs, setCerts] = useState<CertFile[]>([])
  const [me, setMe] = useState<WhoAmI | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function describe(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 401) return 'token 无效或缺失（401）'
      if (e.status === 403) return '当前 token 没有该权限（403 insufficient_scope）'
      if (e.status === 429) return `鉴权失败次数过多，请 ${e.retryAfter ?? 60}s 后重试（429）`
      return `${e.code}: ${e.message}`
    }
    return (e as Error).message
  }

  async function refresh() {
    setBusy(true)
    setError('')
    try {
      const [s, c, w] = await Promise.all([getStatus(), getCerts(), getWhoAmI()])
      setStatus(s)
      setCerts(c)
      setMe(w)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clearToken()
      setError(describe(e))
    } finally {
      setBusy(false)
    }
  }

  async function onApply() {
    setBusy(true)
    setError('')
    try {
      await applyConfig(true)
      await refresh()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clearToken()
      setError(describe(e))
      setBusy(false)
    }
  }

  useEffect(() => {
    if (token) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canApply = me?.can_apply === true

  return (
    <main>
      <h1>wist-ingest</h1>
      <p className="muted">数据面：warp-parse（TCP + mTLS）；控制面：wist-ingest-ctrl</p>

      <section className="card">
        <label htmlFor="token">管理面 token</label>
        <div className="row">
          <input
            id="token"
            type="password"
            value={token}
            placeholder="admin 或 viewer token"
            onChange={(e) => setToken(e.target.value)}
          />
          <button
            onClick={() => {
              saveToken(token)
              void refresh()
            }}
            disabled={busy || !token}
          >
            加载
          </button>
        </div>
        {me && (
          <p className="muted">
            作用域 <strong className={canApply ? 'ok' : ''}>{me.scope}</strong>
            {me.identity && (
              <>
                {' '}· 传输身份 <span className="mono">{me.identity.id}</span>
                {' '}· 指纹 <span className="mono">{me.identity.fingerprint_sha256.slice(0, 16)}…</span>
              </>
            )}
          </p>
        )}
      </section>

      {error && <pre className="error">{error}</pre>}

      {me && !canApply && (
        <p className="hint">
          当前是只读 token：可以查看状态与证书，但不能下发配置或重启数据面。
        </p>
      )}

      {status && (
        <section className="card">
          <h2>状态</h2>
          <dl className="kv">
            <dt>容器</dt>
            <dd>{status.container}</dd>
            <dt>监听</dt>
            <dd>
              {status.listen}:{status.port}（framing={status.framing}）
            </dd>
            <dt>工作根</dt>
            <dd>{status.work_root}</dd>
            <dt>管理面 TLS</dt>
            <dd>
              {status.tls
                ? `${status.tls.cert_file}${status.tls.mtls ? ' · mTLS' : ' · 单向'}`
                : '未启用'}
            </dd>
            <dt>上次生效</dt>
            <dd>
              {status.state
                ? `${status.state.applied_at} · revision ${status.state.revision.slice(0, 12)} · restart=${status.state.restarted}`
                : '（未生效过）'}
            </dd>
          </dl>

          {status.lint.length > 0 && (
            <ul className="findings">
              {status.lint.map((f) => (
                <li key={f.code} className={f.level}>
                  [{f.level}] {f.code} {f.message}
                </li>
              ))}
            </ul>
          )}

          <div className="row">
            <button onClick={() => void refresh()} disabled={busy}>
              刷新
            </button>
            <button
              onClick={() => void onApply()}
              disabled={busy || !canApply}
              title={canApply ? '' : '需要 admin token'}
            >
              应用配置并重启
            </button>
          </div>
        </section>
      )}

      {certs.length > 0 && (
        <section className="card">
          <h2>身份文件</h2>
          <table>
            <thead>
              <tr>
                <th>角色</th>
                <th>状态</th>
                <th>mode</th>
                <th>SHA-256</th>
                <th>notAfter</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.role}>
                  <td>{c.role}</td>
                  <td className={c.exists && !c.error ? 'ok' : 'bad'}>
                    {c.exists && !c.error ? 'present' : (c.error ?? 'missing')}
                  </td>
                  <td>{c.mode ?? '-'}</td>
                  <td className="mono">{c.sha256 ? c.sha256.slice(0, 24) + '…' : '—'}</td>
                  <td>{c.not_after ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {status && status.gateways.length > 0 && (
        <section className="card">
          <h2>网关台账</h2>
          <table>
            <thead>
              <tr>
                <th>网关</th>
                <th>租户</th>
              </tr>
            </thead>
            <tbody>
              {status.gateways.map((g) => (
                <tr key={g.name}>
                  <td>{g.name}</td>
                  <td>{g.tenant ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            证书身份尚未透出（上游 tcp source 不写 peer cert 到 tags），此处仅作台账，不能作为授权依据。
          </p>
        </section>
      )}
    </main>
  )
}
