import { useEffect, useRef, useState, type FormEvent } from 'react'

/**
 * 管理令牌入口（状态条右上角）—— 与 wist-center 的门径一致：
 * 收起时只是一个胶囊按钮，点开才出现输入框；关闭即丢弃草稿。
 *
 * 输入框**不预填**已存 token（粘新 token 容易拼成「旧+新」→ 401 → 限流）。
 */
export function TokenControl({
  hasToken,
  invalid,
  onApply,
  onClear,
}: {
  hasToken: boolean
  invalid: boolean
  onApply: (token: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [applied, setApplied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    setToken('')
    window.setTimeout(() => inputRef.current?.select(), 0)

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function close() {
    window.clearTimeout(timer.current)
    setToken('')
    setApplied(false)
    setOpen(false)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onApply(token.trim())
    setToken('')
    setApplied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setApplied(false)
      setOpen(false)
    }, 1600)
  }

  const tone = invalid ? 'token--invalid' : hasToken ? 'token--on' : 'token--off'

  return (
    <div className="token" ref={rootRef}>
      <button
        type="button"
        className={`token__trigger ${tone}`}
        aria-expanded={open}
        aria-controls="token-panel"
        onClick={() => (open ? close() : setOpen(true))}
        title={
          hasToken
            ? '管理令牌已设置：点击可更换或清除（仅存于本会话标签页）'
            : '管理令牌未设置：点击粘贴 ctrl 的 admin / viewer token'
        }
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path
            d="M9.6 2.6a3.6 3.6 0 1 0-3.1 5.4c.3 0 .5 0 .8-.1l.5.5v1.2h1.2v1.2h1.2l1-1V8.4l-.9-.9c.1-.3.1-.6.1-.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10.7" cy="5.3" r="0.9" fill="currentColor" />
        </svg>
        <span className="token__label">
          {invalid ? '令牌无效' : hasToken ? '令牌' : '设置令牌'}
        </span>
      </button>

      {open ? (
        <form id="token-panel" className="token__panel" onSubmit={handleSubmit}>
          <div className="token__panel-head">
            <strong>管理令牌</strong>
            <span className={hasToken ? 'token__state token__state--on' : 'token__state'}>
              {hasToken ? '已设置' : '未设置'}
            </span>
          </div>
          <input
            ref={inputRef}
            className="token__input"
            type="password"
            autoComplete="off"
            placeholder="粘贴 admin / viewer token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className="token__hint">
            仅存于本会话标签页，用于调用 wist-ingest-ctrl 的管理面（Bearer）。
          </p>
          <div className="token__actions">
            <button type="submit" className="button button--primary button--sm" disabled={!token.trim()}>
              {applied ? '已应用' : '应用'}
            </button>
            <button
              type="button"
              className="button button--sm"
              onClick={() => {
                onClear()
                setToken('')
              }}
              disabled={!hasToken}
            >
              清除
            </button>
            <button type="button" className="button button--ghost button--sm" onClick={close}>
              收起
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
