import { useEffect, useState, type ReactNode } from 'react'
import { formatRelativeTime } from '../format'
import { toggleAppTheme, useAppTheme } from '../theme'
import { TokenControl } from './TokenControl'

export type Tab = 'overview' | 'access' | 'config' | 'identity'

const TAB_LABELS: Record<Tab, string> = {
  overview: '总览',
  access: '网关接入',
  config: '配置与规则',
  identity: '身份与状态',
}

const TAB_GROUPS: { label: string; items: { tab: Tab; icon: ReactNode }[] }[] = [
  {
    label: '监控',
    items: [{ tab: 'overview', icon: <IconOverview /> }],
  },
  {
    label: '数据面',
    items: [
      { tab: 'access', icon: <IconLink /> },
      { tab: 'config', icon: <IconCode /> },
    ],
  },
  {
    label: '站点',
    items: [{ tab: 'identity', icon: <IconShield /> }],
  },
]

function IconOverview() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <rect x="1.6" y="1.6" width="5.2" height="5.2" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.2" y="1.6" width="5.2" height="5.2" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.6" y="9.2" width="5.2" height="5.2" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.2" y="9.2" width="5.2" height="5.2" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="M6.6 9.4 9.4 6.6M7.4 4.4l1-1a2.6 2.6 0 0 1 3.7 3.7l-1 1M8.6 11.6l-1 1a2.6 2.6 0 0 1-3.7-3.7l1-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCode() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="M5.6 4.2 2 8l3.6 3.8M10.4 4.2 14 8l-3.6 3.8M9.2 2.6 6.8 13.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="M8 1.8 13.2 3.8v4.1c0 3.2-2.2 5.5-5.2 6.3-3-.8-5.2-3.1-5.2-6.3V3.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m5.8 8 1.6 1.6 3-3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      {/* 三格“漏斗/汇入”几何：与 center 的蜂巢同一套观感，但方向朝下（数据汇入数据面）。 */}
      <svg viewBox="0 0 20 20" width="17" height="17">
        <g fill="none" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
          <path d="M3.2 3.4h13.6L11.6 9.2v6.1L8.4 13.4V9.2Z" />
        </g>
      </svg>
    </span>
  )
}

interface ShellProps {
  tab: Tab
  onTab: (tab: Tab) => void
  token: string
  invalidToken: boolean
  onApplyToken: (token: string) => void
  onClearToken: () => void
  syncing: boolean
  lastSyncedAt: number | null
  onRefresh: () => void
  children: ReactNode
}

/** 应用外壳：左侧导航 + 顶部常驻状态条 + 内容区。 */
export function Shell({
  tab,
  onTab,
  token,
  invalidToken,
  onApplyToken,
  onClearToken,
  syncing,
  lastSyncedAt,
  onRefresh,
  children,
}: ShellProps) {
  const theme = useAppTheme()
  const [now, setNow] = useState(() => Date.now())

  // 相对时间每 5 秒重算一次（与轮询同频，不需要每秒）。
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000)
    return () => window.clearInterval(timer)
  }, [])

  const age = lastSyncedAt === null ? null : now - lastSyncedAt
  const stale = Boolean(token) && !syncing && age !== null && age > 30_000
  const statusText = !token
    ? '未设置令牌'
    : invalidToken
      ? '令牌无效'
      : syncing
        ? '同步中'
        : '自动刷新 5s'

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <span className="brand-copy">
            <span className="brand-text">WistIngest</span>
            <span className="brand-sub">数据面接收侧</span>
          </span>
        </div>

        <nav className="nav" aria-label="主导航">
          {TAB_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  className={`nav-link${tab === item.tab ? ' nav-link--active' : ''}`}
                  onClick={() => onTab(item.tab)}
                  aria-current={tab === item.tab ? 'page' : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {TAB_LABELS[item.tab]}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <footer className="sidebar-footer">
          <span className="sidebar-version">v{__APP_VERSION__}</span>
          <span className="sidebar-note">wist-ingest-ctrl · warp-parse</span>
        </footer>
      </aside>

      <div className="body">
        <div className="statusbar">
          <nav className="crumbs" aria-label="面包屑">
            <span className="crumb-root">数据面</span>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="crumb-current">{TAB_LABELS[tab]}</span>
          </nav>

          <div className="statusbar-right">
            <span
              className={`pill ${
                !token || invalidToken ? 'pill--idle' : stale ? 'pill--stale' : 'pill--live'
              }`}
              title={
                !token
                  ? '尚未填入管理令牌：右上角「设置令牌」'
                  : invalidToken
                    ? 'ctrl 拒绝了当前令牌（401）：请重新填入'
                    : `数据来自 ctrl：每 5 秒自动拉取；最近同步 ${lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '—'}`
              }
            >
              <span className={syncing && token && !invalidToken ? 'dot dot--syncing' : 'dot'} aria-hidden="true" />
              {statusText}
              {token && !invalidToken && age !== null ? (
                <>
                  <span className="pill-divider" aria-hidden="true" />
                  <span className="pill-fresh">{formatRelativeTime(lastSyncedAt, now)}</span>
                </>
              ) : null}
            </span>

            <button
              type="button"
              className="icon-button"
              onClick={() => toggleAppTheme()}
              title={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
              aria-label={theme === 'light' ? '当前浅色主题，点击切换到深色' : '当前深色主题，点击切换到浅色'}
            >
              {theme === 'light' ? (
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6" />
                    <path d="M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1" />
                  </g>
                </svg>
              )}
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={() => onRefresh()}
              disabled={!token}
              title="刷新"
              aria-label="刷新"
            >
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5V5H10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <TokenControl
              hasToken={Boolean(token)}
              invalid={invalidToken}
              onApply={onApplyToken}
              onClear={onClearToken}
            />
          </div>
        </div>

        <main className="main">{children}</main>
      </div>
    </div>
  )
}
