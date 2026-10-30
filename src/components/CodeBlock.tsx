import { useState } from 'react'

/**
 * 代码块：展示 + 复制（可选下载）。
 *
 * 一次性接入券 / CA PEM 都从这里交付：**不自动选中、不进地址栏**，只让操作者显式复制。
 */
export function CodeBlock({
  label,
  code,
  hint,
  filename,
  wrap = false,
  compact = false,
}: {
  label: string
  code: string
  hint?: string
  filename?: string
  /** 长串（券 / URL）默认不换行，避免复制时掺入换行。 */
  wrap?: boolean
  /** 只露出一小截（长接入串 / CA PEM）：复制仍拿全文，页面不被它撑高。 */
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 剪贴板不可用时保留可手动选中的原始文本。
    }
  }

  function handleDownload() {
    if (!filename) return
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={compact ? 'codeblock codeblock--compact' : 'codeblock'}>
      <div className="codeblock__header">
        <div>
          <span className="codeblock__label">{label}</span>
          {hint ? <p className="codeblock__hint">{hint}</p> : null}
        </div>
        <div className="codeblock__actions">
          {filename ? (
            <button type="button" className="button button--ghost button--sm" onClick={handleDownload}>
              下载
            </button>
          ) : null}
          <button type="button" className="button button--ghost button--sm" onClick={() => void handleCopy()}>
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
      <pre className={wrap ? 'codeblock__code codeblock__code--wrap' : 'codeblock__code'}>{code}</pre>
    </div>
  )
}
