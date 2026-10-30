import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  describeError,
  getDataPlaneFile,
  getDataPlaneTree,
  type DataPlaneEntry,
  type DataPlaneFile,
  type DataPlaneTree,
} from '../api'
import { formatBytes, formatDateTime } from '../format'
import { Badge, Block, Card, Empty, ErrorBanner, Mono, PageShell } from './ui'

interface TreeNode {
  path: string
  name: string
  kind: 'dir' | 'file'
  size: number
  modified: string | null
  children: TreeNode[]
  fileCount: number
}

/** 把后端的扁平路径表还原成树：按路径按需补父节点，缺一层也不丢子树。 */
function buildTree(entries: DataPlaneEntry[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  const makeDir = (path: string): TreeNode => {
    const existing = nodes.get(path)
    if (existing) return existing
    const parts = path.split('/')
    const node: TreeNode = {
      path,
      name: parts[parts.length - 1] ?? path,
      kind: 'dir',
      size: 0,
      modified: null,
      children: [],
      fileCount: 0,
    }
    nodes.set(path, node)
    const parent = parts.slice(0, -1).join('/')
    if (parent === '') roots.push(node)
    else makeDir(parent).children.push(node)
    return node
  }

  for (const entry of entries) {
    if (entry.kind === 'dir') {
      makeDir(entry.path).modified = entry.modified
      continue
    }
    const parts = entry.path.split('/')
    const node: TreeNode = {
      path: entry.path,
      name: parts[parts.length - 1] ?? entry.path,
      kind: 'file',
      size: entry.size,
      modified: entry.modified,
      children: [],
      fileCount: 1,
    }
    nodes.set(entry.path, node)
    const parent = parts.slice(0, -1).join('/')
    if (parent === '') roots.push(node)
    else makeDir(parent).children.push(node)
  }

  const count = (node: TreeNode): number => {
    if (node.kind === 'file') return 1
    node.fileCount = node.children.reduce((sum, child) => sum + count(child), 0)
    return node.fileCount
  }
  const sort = (list: TreeNode[]) => {
    list.sort((left, right) =>
      left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === 'dir' ? -1 : 1,
    )
    for (const node of list) sort(node.children)
  }
  for (const root of roots) count(root)
  sort(roots)
  return roots
}

const ROOT_LABELS: Record<string, string> = {
  conf: '配置',
  connectors: '连接器',
  topology: '编排',
  models: '规则（WPL / OML）',
}

function TreeRow({
  node,
  depth,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  selected: string | null
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}) {
  const isOpen = expanded.has(node.path)
  const isSelected = selected === node.path
  if (node.kind === 'dir') {
    return (
      <div className="tree__branch">
        <button
          type="button"
          className={`tree__row tree__row--dir${isOpen ? ' tree__row--open' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => onToggle(node.path)}
          title={node.path}
        >
          <span className={`tree__caret${isOpen ? ' tree__caret--open' : ''}`} aria-hidden="true">
            ▸
          </span>
          <span className="tree__name">{node.name}</span>
          {depth === 0 && ROOT_LABELS[node.name] ? (
            <span className="tree__hint">{ROOT_LABELS[node.name]}</span>
          ) : null}
          <span className="tree__count">{node.fileCount}</span>
        </button>
        {isOpen
          ? node.children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                selected={selected}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))
          : null}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`tree__row tree__row--file${isSelected ? ' tree__row--selected' : ''}`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      onClick={() => onSelect(node.path)}
      title={node.path}
    >
      <span className="tree__file-dot" aria-hidden="true" />
      <span className="tree__name">{node.name}</span>
    </button>
  )
}

/**
 * 数据面（wparse）当前**已落盘、正在生效**的配置与规则。
 *
 * 数据来自 ctrl 的工作根（容器里与数据面的 `/data` 是同一份）；后端只开放
 * conf / connectors / topology / models 与 `wparse.local.toml`。与 gateway 的
 * 「数据面配置」页同一套只读口径：不编辑、不解释规则语义。
 */
export function ConfigPage({ token }: { token: string }) {
  const [tree, setTree] = useState<DataPlaneTree | null>(null)
  const [treeError, setTreeError] = useState('')
  const [loadingTree, setLoadingTree] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [file, setFile] = useState<DataPlaneFile | null>(null)
  const [fileError, setFileError] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['conf', 'connectors', 'topology', 'models']))

  const loadTree = useCallback(async () => {
    setLoadingTree(true)
    setTreeError('')
    try {
      const next = await getDataPlaneTree()
      setTree(next)
      setSelected((current) => {
        const files = next.entries.filter((entry) => entry.kind === 'file')
        if (current && files.some((entry) => entry.path === current)) return current
        // 默认落在数据面主配置上；没有就退到第一个文件。
        if (files.some((entry) => entry.path === 'conf/wparse.toml')) return 'conf/wparse.toml'
        return files[0]?.path ?? null
      })
    } catch (cause) {
      setTreeError(describeError(cause))
    } finally {
      setLoadingTree(false)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    void loadTree()
  }, [token, loadTree])

  useEffect(() => {
    if (!selected) {
      setFile(null)
      return
    }
    let cancelled = false
    setLoadingFile(true)
    setFileError('')
    getDataPlaneFile(selected)
      .then((next) => {
        if (!cancelled) setFile(next)
      })
      .catch((cause) => {
        if (!cancelled) {
          setFile(null)
          setFileError(describeError(cause))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFile(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected, token])

  const nodes = useMemo(() => buildTree(tree?.entries ?? []), [tree])

  function toggle(path: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function expandAll() {
    const dirs = new Set<string>()
    const walk = (list: TreeNode[]) => {
      for (const node of list) {
        if (node.kind !== 'dir') continue
        dirs.add(node.path)
        walk(node.children)
      }
    }
    walk(nodes)
    setExpanded(dirs)
  }

  const headerBadges = (
    <>
      {tree?.truncated ? <Badge tone="amber">目录触顶</Badge> : null}
      {file?.binary ? <Badge tone="amber">非文本</Badge> : null}
      {file?.truncated ? <Badge tone="amber">已截断</Badge> : null}
    </>
  )

  return (
    <PageShell
      title="配置与规则"
      summary={
        <>
          数据面（wparse）<strong>当前已落盘、正在生效</strong>的配置与规则。ctrl 只读同一份工作根，
          与 gateway 的「数据面配置」页同一套口径：不编辑，也不解释规则语义（规则含义见 wp-rules 仓）。
        </>
      }
      actions={
        <button type="button" className="button" onClick={() => void loadTree()} disabled={loadingTree || !token}>
          刷新
        </button>
      }
    >
      {treeError ? (
        <Block wide>
          <ErrorBanner>{treeError}</ErrorBanner>
        </Block>
      ) : null}

      <Block wide>
        <div className="browse">
          <aside className="browse__tree">
            <header className="browse__tree-head">
              <div>
                <span className="browse__title">数据面工作根</span>
                <code className="browse__path" title={tree?.work_dir}>
                  {tree?.work_dir ?? '—'}
                </code>
              </div>
              <button type="button" className="button button--ghost button--sm" onClick={expandAll}>
                全展开
              </button>
            </header>
            {!token ? (
              <Empty title="需要管理令牌" hint="填入令牌后即可浏览数据面配置。" />
            ) : loadingTree && !tree ? (
              <p className="muted">加载中…</p>
            ) : nodes.length === 0 ? (
              <Empty title="工作根下没有可浏览的配置" hint="确认 compose 把 work/ 挂到了 ctrl 的 /work。" />
            ) : (
              <div className="tree" role="tree">
                {nodes.map((node) => (
                  <TreeRow
                    key={node.path}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    selected={selected}
                    onToggle={toggle}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            )}
          </aside>

          <section className="browse__viewer">
            {selected ? (
              <header className="viewer__head">
                <div className="viewer__title">
                  <code className="viewer__path" title={selected}>
                    {selected}
                  </code>
                  <span className="viewer__meta">
                    {file ? `${formatBytes(file.size)} · ${formatDateTime(file.modified)}` : '读取中…'}
                  </span>
                  {headerBadges}
                </div>
                {file?.content !== undefined ? (
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => {
                      const blob = new Blob([file.content ?? ''], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const anchor = document.createElement('a')
                      anchor.href = url
                      anchor.download = selected.split('/').pop() ?? 'file.txt'
                      anchor.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    下载
                  </button>
                ) : null}
              </header>
            ) : null}

            {fileError ? <ErrorBanner>{fileError}</ErrorBanner> : null}
            {loadingFile ? <p className="muted">读取中…</p> : null}

            {file && !loadingFile ? (
              file.binary ? (
                <Empty
                  title="不是可读文本"
                  hint="配置与规则应当是文本；二进制多半是挂错了目录（或文件被截断在半个字符上）。"
                />
              ) : (
                <>
                  {file.truncated ? (
                    <p className="muted small">文件超过 1 MiB：这里只显示前缀。</p>
                  ) : null}
                  <pre className="viewer__code">{file.content}</pre>
                </>
              )
            ) : null}

            {!selected && !loadingTree ? (
              <Empty title="选一个文件" hint="左侧树里点开目录，选中文件即可查看内容。" />
            ) : null}
          </section>
        </div>
      </Block>

      <Block wide>
        <Card title="这里看到的是什么" subtitle="不是另一份副本，是数据面正在读的那一棵树。">
          <ul className="bullets">
            <li>
              <Mono>conf/wparse.toml</Mono>：数据面主配置（启动参数、日志、admin API）。
            </li>
            <li>
              <Mono>connectors/</Mono>：tcp source（端口 / 分帧 / mTLS 证书）与各类 sink。
            </li>
            <li>
              <Mono>topology/</Mono>：source / sink 的编排与 tag。
            </li>
            <li>
              <Mono>models/</Mono>：WPL 解析规则与 OML 富化模型。
            </li>
            <li>
              <Mono>wparse.local.toml</Mono>：管理面覆盖层（如确实存在）。
            </li>
          </ul>
          <p className="muted small">
            ctrl 自己渲染的只有 <Mono>connectors/source.d/90-ingest-tcp.toml</Mono> 与{' '}
            <Mono>topology/sources/wpsrc.toml</Mono>；其余文件由部署种子提供，ctrl 不覆盖。
          </p>
        </Card>
      </Block>
    </PageShell>
  )
}
