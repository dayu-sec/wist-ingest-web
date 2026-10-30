import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  applyConfig,
  clearToken,
  describeError,
  getCerts,
  getLinks,
  getStatus,
  getWhoAmI,
  loadToken,
  saveToken,
  type CertFile,
  type LinksView,
  type Status,
  type WhoAmI,
} from './api'
import { AccessPage } from './components/AccessPage'
import { ConfigPage } from './components/ConfigPage'
import { IdentityPage } from './components/IdentityPage'
import { OverviewPage } from './components/OverviewPage'
import { Shell, type Tab } from './components/Shell'
import { Block, Card, Empty, ErrorBanner, Mono, PageShell } from './components/ui'

const TABS: Tab[] = ['overview', 'access', 'config', 'identity']

function readTab(): Tab {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return (TABS as string[]).includes(hash) ? (hash as Tab) : 'overview'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readTab)
  const [token, setToken] = useState(loadToken)
  const [status, setStatus] = useState<Status | null>(null)
  const [certs, setCerts] = useState<CertFile[]>([])
  const [me, setMe] = useState<WhoAmI | null>(null)
  const [links, setLinks] = useState<LinksView | null>(null)
  const [linksError, setLinksError] = useState('')
  const [error, setError] = useState('')
  const [invalidToken, setInvalidToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  // hash 路由：刷新 / 分享 / 浏览器后退都能回到同一页（不引入 router 依赖）。
  useEffect(() => {
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((next: Tab) => {
    window.location.hash = next
    setTab(next)
  }, [])

  const refresh = useCallback(async () => {
    if (!token) return
    setSyncing(true)
    try {
      const [nextStatus, nextCerts, nextMe] = await Promise.all([getStatus(), getCerts(), getWhoAmI()])
      setStatus(nextStatus)
      setCerts(nextCerts)
      setMe(nextMe)
      setError('')
      setInvalidToken(false)
      setLastSyncedAt(Date.now())

      // 授权台账是后加的接口：单独失败不应把整页拖垮（「网关接入」页会给出解释）。
      try {
        setLinks(await getLinks())
        setLinksError('')
      } catch (cause) {
        setLinks(null)
        setLinksError(describeError(cause))
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        clearToken()
        setToken('')
        setInvalidToken(true)
        setStatus(null)
        setCerts([])
        setMe(null)
        setLinks(null)
      }
      setError(describeError(cause))
    } finally {
      setSyncing(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => window.clearInterval(timer)
  }, [token, refresh])

  async function handleApply() {
    setBusy(true)
    setError('')
    try {
      await applyConfig(true)
      await refresh()
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  function handleApplyToken(next: string) {
    saveToken(next)
    setToken(next)
    setInvalidToken(false)
    setError('')
  }

  function handleClearToken() {
    clearToken()
    setToken('')
    setStatus(null)
    setCerts([])
    setMe(null)
    setLinks(null)
    setInvalidToken(false)
    setError('')
    setLastSyncedAt(null)
  }

  const content = useMemo(() => {
    if (!token) {
      return (
        <PageShell
          title="需要管理令牌"
          summary="填写 wist-ingest-ctrl 的 admin 或 viewer token（右上角「设置令牌」）后，本页才开始拉取数据。"
        >
          <Block>
            <Card title="管理面鉴权">
              <p className="muted">
                令牌只存本会话标签页；<Mono>admin</Mono> 可下发配置 / 重启数据面 / 签发授权，
                <Mono>viewer</Mono> 只读。
              </p>
              <Empty
                title="还没有设置令牌"
                hint={
                  <>
                    点右上角「设置令牌」粘贴。部署栈里真值在 <Mono>.wist/sec-value.yml</Mono>：
                    <Mono> ingest_ctrl_admin_token </Mono>（<Mono>gops sec get ingest_ctrl_admin_token</Mono>）。
                  </>
                }
              />
            </Card>
          </Block>
        </PageShell>
      )
    }

    if (!status) {
      return (
        <PageShell title="正在连接 ctrl" summary="拉取状态、身份文件与授权台账…">
          <Block>{error ? <ErrorBanner>{error}</ErrorBanner> : <p className="muted">加载中…</p>}</Block>
        </PageShell>
      )
    }

    switch (tab) {
      case 'access':
        return <AccessPage links={links} linksError={linksError} me={me} certs={certs} onRefresh={refresh} />
      case 'config':
        return <ConfigPage token={token} />
      case 'identity':
        return <IdentityPage status={status} certs={certs} me={me} />
      default:
        return (
          <OverviewPage
            status={status}
            certs={certs}
            me={me}
            links={links}
            busy={busy}
            error={error}
            onApply={() => void handleApply()}
            onRefresh={() => void refresh()}
            onTab={go}
          />
        )
    }
  }, [token, status, tab, links, linksError, me, certs, busy, error, refresh, go])

  return (
    <Shell
      tab={tab}
      onTab={go}
      token={token}
      invalidToken={invalidToken}
      onApplyToken={handleApplyToken}
      onClearToken={handleClearToken}
      syncing={syncing}
      lastSyncedAt={lastSyncedAt}
      onRefresh={() => void refresh()}
    >
      {content}
    </Shell>
  )
}
