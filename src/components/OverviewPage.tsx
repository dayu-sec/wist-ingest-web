import type { CertFile, LinksView, Status, WhoAmI } from '../api'
import { formatDateTime } from '../format'
import { Badge, Block, Card, Empty, Field, InfoBanner, Mono, PageShell } from './ui'
import type { Tab } from './Shell'

function certSummary(certs: CertFile[]) {
  const present = certs.filter((cert) => cert.exists && !cert.error).length
  return { present, total: certs.length }
}

function grantSummary(links: LinksView | null) {
  const grants = links?.grants ?? []
  // 以 `linked` 为准：重新签发后状态是 pending（新券待消费），但这台网关仍然是已接入的。
  const linked = grants.filter((grant) => grant.linked).length
  const pending = grants.filter((grant) => grant.token_pending).length
  return { linked, pending, total: grants.length }
}

export function OverviewPage({
  status,
  certs,
  me,
  links,
  busy,
  error,
  onApply,
  onRefresh,
  onTab,
}: {
  status: Status
  certs: CertFile[]
  me: WhoAmI | null
  links: LinksView | null
  busy: boolean
  error: string
  onApply: () => void
  onRefresh: () => void
  onTab: (tab: Tab) => void
}) {
  const canApply = me?.can_apply === true
  const certsState = certSummary(certs)
  const grants = grantSummary(links)
  const blockers = status.lint.filter((finding) => finding.level === 'error')
  const warns = status.lint.filter((finding) => finding.level === 'warn')

  return (
    <PageShell
      title="总览"
      summary="数据面是上游 warp-parse（TCP + mTLS），控制面是本机 ctrl。这里回答三件事：数据面在不在跑、网关有没有被授权接入、配置有没有通过安全 lint。"
      actions={
        <>
          <button type="button" className="button" onClick={onRefresh} disabled={busy}>
            刷新
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onApply}
            disabled={busy || !canApply}
            title={canApply ? '渲染 → wproj check → 原子替换 → 重启数据面' : '需要 admin 令牌'}
          >
            应用配置并重启
          </button>
        </>
      }
    >
      <Block wide>
        <div className="metrics">
          <div className="metric">
            <span className="metric__label">数据面容器</span>
            <span className="metric__value metric__value--mono">{status.container}</span>
            <span className="metric__hint">
              {status.listen}:{status.port} · framing={status.framing}
            </span>
          </div>
          <div className="metric">
            <span className="metric__label">网关授权</span>
            <span className="metric__value">
              {grants.linked}
              <span className="metric__unit">/ {grants.total}</span>
            </span>
            <span className="metric__hint">
              {grants.pending > 0 ? `${grants.pending} 张券待消费` : '已接入数 / 台账总数'}
            </span>
          </div>
          <div className="metric">
            <span className="metric__label">身份文件</span>
            <span className={`metric__value${certsState.present !== certsState.total ? ' metric__value--warn' : ''}`}>
              {certsState.present}
              <span className="metric__unit">/ {certsState.total}</span>
            </span>
            <span className="metric__hint">{certsState.present === certsState.total ? '证书与私钥齐全' : '有缺失或不可读'}</span>
          </div>
          <div className="metric">
            <span className="metric__label">上次生效</span>
            <span className="metric__value metric__value--small">
              {status.state ? formatDateTime(status.state.applied_at) : '未生效过'}
            </span>
            <span className="metric__hint">
              {status.state
                ? `revision ${status.state.revision.slice(0, 12)} · restart=${String(status.state.restarted)}`
                : '点「应用配置并重启」生成第一版'}
            </span>
          </div>
        </div>
      </Block>

      {error ? (
        <Block wide>
          <div className="banner banner--crit" role="alert">
            {error}
          </div>
        </Block>
      ) : null}

      <Block wide>
        <div className="grid grid--2">
          <Card
            title="运行状态"
            subtitle="配置里的字段原样回显；不在这里做推断。"
            aside={<Badge tone="blue">{status.scope}</Badge>}
          >
            <div className="kv">
              <Field label="监听">
                <Mono>
                  {status.listen}:{status.port}
                </Mono>
              </Field>
              <Field label="分帧">
                <Mono>{status.framing}</Mono>
              </Field>
              <Field label="工作根">
                <Mono title={status.work_root}>{status.work_root}</Mono>
              </Field>
              <Field label="管理面 TLS">
                {status.tls ? (
                  <span>
                    <Mono>{status.tls.cert_file}</Mono>
                    <span className="muted"> · {status.tls.mtls ? 'mTLS' : '单向 TLS'}</span>
                  </span>
                ) : (
                  <span className="text-warn">未启用（仅允许回环监听）</span>
                )}
              </Field>
              <Field label="上次生效">
                {status.state ? (
                  <span>
                    {formatDateTime(status.state.applied_at)} · 已校验={String(status.state.checked)} · 已重启=
                    {String(status.state.restarted)}
                  </span>
                ) : (
                  <span className="muted">（未生效过）</span>
                )}
              </Field>
              <Field label="数据面入口">
                {links ? (
                  <span>
                    <Mono>
                      {links.endpoint.host}:{links.endpoint.port}
                    </Mono>
                    <span className="muted"> · mTLS · {links.endpoint.framing}</span>
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </Field>
            </div>

            {!status.tls ? (
              <InfoBanner tone="warn">
                管理面没有 TLS：Bearer 令牌会明文传输，只应绑回环。站点配置里补 <Mono>[ctrl.tls]</Mono>。
              </InfoBanner>
            ) : null}
            {!canApply ? (
              <InfoBanner>
                当前是只读令牌（viewer）：可以查看状态、授权台账与配置，但不能下发配置或重启数据面。
              </InfoBanner>
            ) : null}
          </Card>

          <Card
            title="安全 lint"
            subtitle="error 会阻止 apply；warn 只是提醒。"
            aside={
              blockers.length > 0 ? (
                <Badge tone="red">{blockers.length} 个阻塞项</Badge>
              ) : (
                <Badge tone="green">无阻塞项</Badge>
              )
            }
          >
            {status.lint.length === 0 ? (
              <Empty title="没有发现任何问题" hint="配置通过了全部静态检查（证书映射、framing、鉴权、授权 TTL 等）。" />
            ) : (
              <ul className="findings">
                {status.lint.map((finding) => (
                  <li key={`${finding.level}-${finding.code}`} className={`finding finding--${finding.level}`}>
                    <span className={`finding__level finding__level--${finding.level}`}>
                      {finding.level === 'error' ? 'ERROR' : 'WARN'}
                    </span>
                    <span className="finding__code">{finding.code}</span>
                    <span className="finding__message">{finding.message}</span>
                  </li>
                ))}
              </ul>
            )}
            {warns.length > 0 && blockers.length === 0 ? (
              <p className="muted small">共 {warns.length} 条提醒，不阻止 apply。</p>
            ) : null}
          </Card>
        </div>
      </Block>

      <Block wide>
        <Card
          title="网关台账"
          subtitle="配置 [[gateways]] 里的网关；数据面授权按网关逐个签发，见「网关接入」。"
          aside={
            <button type="button" className="button button--ghost button--sm" onClick={() => onTab('access')}>
              去签发 →
            </button>
          }
        >
          {status.gateways.length === 0 ? (
            <Empty
              title="台账是空的"
              hint="先在站点配置里加 [[gateways]]（name / tenant），重启 ctrl 后再签发数据面接入券。"
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>网关</th>
                    <th>租户</th>
                    <th>数据面授权</th>
                  </tr>
                </thead>
                <tbody>
                  {status.gateways.map((gateway) => {
                    const grant = links?.grants.find((item) => item.gateway === gateway.name)
                    const tone =
                      grant?.state === 'linked'
                        ? 'green'
                        : grant?.state === 'pending'
                          ? 'amber'
                          : grant?.state === 'expired'
                            ? 'red'
                            : 'gray'
                    return (
                      <tr key={gateway.name}>
                        <td>
                          <Mono>{gateway.name}</Mono>
                        </td>
                        <td>{gateway.tenant ?? '—'}</td>
                        <td>
                          <Badge tone={tone}>{grantLabel(grant?.state)}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Block>
    </PageShell>
  )
}

export function grantLabel(state: string | undefined): string {
  switch (state) {
    case 'linked':
      return '已接入'
    case 'pending':
      return '待接入'
    case 'expired':
      return '券已过期'
    case 'revoked':
      return '已撤销'
    default:
      return '未签发'
  }
}
