import { useEffect, useMemo, useState } from 'react'
import {
  describeError,
  issueLink,
  revokeLink,
  type CertFile,
  type GrantView,
  type IssuedLink,
  type LinksView,
  type WhoAmI,
} from '../api'
import { formatCountdown, formatDateTime } from '../format'
import { CodeBlock } from './CodeBlock'
import { Badge, Block, Card, Empty, ErrorBanner, Field, InfoBanner, Mono, PageShell } from './ui'
import { grantLabel } from './OverviewPage'

function stateTone(state: GrantView['state']): 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  switch (state) {
    case 'linked':
      return 'green'
    case 'pending':
      return 'amber'
    case 'expired':
      return 'red'
    default:
      return 'gray'
  }
}

function redeemCommand(origin: string, issued: IssuedLink): string {
  const body = JSON.stringify({
    gateway: issued.gateway,
    link_token: issued.link_token,
    fingerprint_sha256: '<网关客户端证书 SHA-256（64 位 hex）>',
    ...(issued.tenant ? { tenant: issued.tenant } : {}),
  })
  return `curl -sS -X POST '${origin}/api/v1/link/redeem' \\\n  -H 'content-type: application/json' \\\n  -d '${body}'`
}

export function AccessPage({
  links,
  linksError,
  me,
  certs,
  onRefresh,
}: {
  links: LinksView | null
  linksError: string
  me: WhoAmI | null
  certs: CertFile[]
  onRefresh: () => Promise<void>
}) {
  const [issued, setIssued] = useState<Record<string, IssuedLink>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  // 待消费券的有效期是秒级的：只有确实有 pending 券时才开一秒一跳的计时器。
  const hasPending = links?.grants.some((grant) => grant.state === 'pending') ?? false
  useEffect(() => {
    if (!hasPending) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [hasPending])

  const canAdmin = me?.can_apply === true
  const grants = links?.grants ?? []
  const clientCa = certs.find((cert) => cert.role === 'client_ca')
  const origin = useMemo(() => window.location.origin, [])

  async function handleIssue(gateway: string) {
    setPending(gateway)
    setError('')
    try {
      const result = await issueLink(gateway)
      // 明文只放内存：刷新 / 切页即丢（与 center 的接入券同一口径）。
      setIssued((current) => ({ ...current, [gateway]: result }))
      await onRefresh()
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setPending(null)
    }
  }

  async function handleRevoke(gateway: string) {
    if (!window.confirm(`撤销 ${gateway} 的数据面授权？会清掉已登记的证书指纹，除非重新签发并接入。`)) {
      return
    }
    setPending(gateway)
    setError('')
    try {
      await revokeLink(gateway)
      setIssued((current) => {
        const next = { ...current }
        delete next[gateway]
        return next
      })
      await onRefresh()
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setPending(null)
    }
  }

  return (
    <PageShell
      title="网关接入"
      summary={
        <>
          给网关签发<strong>数据面</strong>接入授权：入口 + 信任锚（client CA）+ 一次性接入券。
          逻辑与 wist-center 的<strong>控制面</strong> link 一致 —— 一次性、短 TTL、落盘只存 sha256、明文只交付一次；
          数据面的强制点仍是 mTLS。
        </>
      }
    >
      {error ? (
        <Block wide>
          <ErrorBanner>{error}</ErrorBanner>
        </Block>
      ) : null}

      {linksError ? (
        <Block wide>
          <ErrorBanner>
            读取授权台账失败：{linksError}（确认 ctrl ≥ 0.2.0 且 /api/v1/links 可用）
          </ErrorBanner>
        </Block>
      ) : null}

      <Block wide>
        <div className="grid grid--2">
          <Card
            title="数据面入口"
            subtitle="网关拿这一份去连 wparse 的 tcp source；对端连不上时先改站点配置里的 advertise。"
            aside={links?.endpoint.wildcard ? <Badge tone="amber">地址待确认</Badge> : <Badge tone="green">可交付</Badge>}
          >
            {links ? (
              <div className="kv">
                <Field label="入口">
                  <Mono>
                    {links.endpoint.host}:{links.endpoint.port}
                  </Mono>
                  {!links.endpoint.configured ? (
                    <span className="muted small"> · 由 ingest.bind:port 推导</span>
                  ) : null}
                </Field>
                <Field label="分帧 / TLS">
                  <Mono>{links.endpoint.framing}</Mono>
                  <span className="muted"> · </span>
                  <Mono>{links.endpoint.tls}</Mono>
                  <span className="muted">（必须出示客户端证书）</span>
                </Field>
                <Field label="信任锚">
                  {clientCa ? (
                    <span>
                      <Mono>{clientCa.container_path}</Mono>{' '}
                      {clientCa.exists && !clientCa.error ? (
                        <Badge tone="green">present</Badge>
                      ) : (
                        <Badge tone="red">missing</Badge>
                      )}
                    </span>
                  ) : (
                    <span className="muted">—（见「身份与状态」）</span>
                  )}
                </Field>
                <Field label="券有效期">
                  <Mono>{links.ttl_seconds}s</Mono>
                  <span className="muted"> · 一次性，过期需重新签发</span>
                </Field>
              </div>
            ) : (
              <Empty title="还没有拿到入口信息" hint="确认已填入令牌，且 ctrl 版本支持 /api/v1/links（≥ 0.2.0）。" />
            )}

            {links?.endpoint.wildcard ? (
              <InfoBanner tone="warn">
                当前入口是通配地址 <Mono>{links.endpoint.host}</Mono>：网关按它连不上。在站点配置补
                <Mono> [ctrl.link] advertise = "ingest.example.com:6514" </Mono>后重启 ctrl。
              </InfoBanner>
            ) : null}
            {!canAdmin ? (
              <InfoBanner>只读令牌：可以查看授权状态，但不能签发或撤销（需要 admin）。</InfoBanner>
            ) : null}
          </Card>

          <Card title="三步完成接入" subtitle="与 center 的「连接 Gateway」页同一套流程，方向相反（数据面）。">
            <ol className="steps">
              <li className="step">
                <span className="step__index">1</span>
                <span className="step__body">
                  <strong>签发接入券</strong>
                  <span className="step__hint">
                    在下面的网关卡片点「生成接入券」。一次性、短命；重新签发会轮换旧券。
                  </span>
                </span>
              </li>
              <li className="step">
                <span className="step__index">2</span>
                <span className="step__body">
                  <strong>交付接入物</strong>
                  <span className="step__hint">
                    把入口、client CA（PEM）与接入券交给网关侧；券的明文只在本页展示这一次。
                  </span>
                </span>
              </li>
              <li className="step">
                <span className="step__index">3</span>
                <span className="step__body">
                  <strong>网关消费登记</strong>
                  <span className="step__hint">
                    网关用这张券调用 <Mono>/api/v1/link/redeem</Mono>，登记自己的客户端证书指纹；
                    之后用 mTLS 往数据面推数据。
                  </span>
                </span>
              </li>
            </ol>
          </Card>
        </div>
      </Block>

      <Block wide>
        {grants.length === 0 ? (
          <Card title="网关台账是空的">
            <Empty
              title="没有可授权的网关"
              hint="先在站点配置里加 [[gateways]]（name / tenant），重启 ctrl 后回到本页。"
            />
          </Card>
        ) : (
          <div className="stack">
            {grants.map((grant) => {
              const material = issued[grant.gateway]
              const busy = pending === grant.gateway
              return (
                <Card
                  key={grant.gateway}
                  className="grant"
                  title={
                    <span className="grant__title">
                      <Mono>{grant.gateway}</Mono>
                      <Badge tone={stateTone(grant.state)}>{grantLabel(grant.state)}</Badge>
                      {grant.linked && grant.state !== 'linked' ? <Badge tone="green">已接入</Badge> : null}
                      {!grant.enabled ? <Badge tone="gray">已停用</Badge> : null}
                    </span>
                  }
                  subtitle={
                    grant.state === 'linked'
                      ? '这台网关的客户端证书指纹已登记：数据面 mTLS 会按它放行。'
                      : grant.state === 'pending'
                        ? grant.linked
                          ? '已接入；当前另有一张新券待消费（换证书 / 换机器时用）。消费后以新指纹为准。'
                          : '已签发一张待消费的券；网关消费后状态会变成「已接入」。'
                        : grant.state === 'expired'
                          ? '券已过期（短 TTL）：重新签发一张再交付。'
                          : grant.state === 'revoked'
                            ? '授权已撤销：之前的证书指纹不再被承认。'
                            : '还没有签发过接入券。'
                  }
                  aside={
                    <div className="grant__actions">
                      <button
                        type="button"
                        className="button button--primary button--sm"
                        onClick={() => void handleIssue(grant.gateway)}
                        disabled={!canAdmin || !grant.enabled || busy}
                        title={
                          !canAdmin
                            ? '需要 admin 令牌'
                            : !grant.enabled
                              ? '网关已停用（enabled = false）'
                              : grant.state === 'linked'
                                ? '轮换券，不会清掉已绑定的指纹'
                                : ''
                        }
                      >
                        {busy
                          ? '生成中…'
                          : grant.state === 'pending' || grant.state === 'linked'
                            ? '重新签发'
                            : '生成接入券'}
                      </button>
                      <button
                        type="button"
                        className="button button--danger button--sm"
                        onClick={() => void handleRevoke(grant.gateway)}
                        disabled={!canAdmin || busy || (grant.state !== 'linked' && grant.state !== 'pending')}
                        title={canAdmin ? '清掉券与已登记的证书指纹' : '需要 admin 令牌'}
                      >
                        撤销授权
                      </button>
                    </div>
                  }
                >
                  <div className="kv kv--compact">
                    <Field label="租户">{grant.tenant ?? <span className="muted">未绑定</span>}</Field>
                    <Field label="签发时间">{formatDateTime(grant.issued_at)}</Field>
                    <Field label="券到期">
                      {grant.expires_at && grant.state === 'pending' ? (
                        <span>
                          {formatDateTime(grant.expires_at)}
                          {grant.state === 'pending' ? (
                            <span className="text-warn"> · 剩 {formatCountdown(grant.expires_at, now)}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </Field>
                    <Field label="登记的指纹">
                      {grant.fingerprint_sha256 ? (
                        <Mono title={grant.fingerprint_sha256}>{grant.fingerprint_sha256}</Mono>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </Field>
                    <Field label="接入时间">{formatDateTime(grant.redeemed_at)}</Field>
                  </div>

                  {material && grant.state !== 'pending' ? (
                    <InfoBanner tone={grant.state === 'linked' ? 'info' : 'warn'}>
                      这张券已不再待消费（{grantLabel(grant.state)}），下面的明文不再展示：
                      {grant.state === 'linked' ? '网关已消费并完成登记。' : '需要重新签发一张。'}
                    </InfoBanner>
                  ) : null}

                  {material && grant.state === 'pending' ? (
                    <div className="material">
                      <InfoBanner tone="warn">
                        接入券明文只显示这一次（刷新 / 切页即丢）。交付后建议立即完成消费；过期或丢失就重新签发。
                      </InfoBanner>

                      <div className="material__grid">
                        <Field label="网关 / 租户">
                          <Mono>{material.gateway}</Mono>
                          {material.tenant ? <span className="muted"> · {material.tenant}</span> : null}
                        </Field>
                        <Field label="入口">
                          <Mono>
                            {material.endpoint.host}:{material.endpoint.port}
                          </Mono>
                          <span className="muted"> · {material.endpoint.tls}</span>
                        </Field>
                        <Field label="到期">
                          {formatDateTime(material.expires_at)}
                          <span className="text-warn"> · 剩 {formatCountdown(material.expires_at, now)}</span>
                        </Field>
                      </div>

                      <CodeBlock
                        label="一次性接入券（link）"
                        hint="券 + CA 都在这一条里；它是一次性凭据，不点开、不进地址栏。"
                        code={material.link}
                        wrap
                        compact
                      />

                      <CodeBlock
                        label="网关消费命令（curl）"
                        hint="把占位符换成本机客户端证书的 SHA-256；成功后网关侧即完成登记。"
                        code={redeemCommand(origin, material)}
                        wrap
                      />

                      {material.trust_bundle_pem ? (
                        <details className="details">
                          <summary className="details__summary">
                            client CA（PEM）· 交付给网关作为数据面信任锚
                          </summary>
                          <div className="details__body">
                            <CodeBlock
                              label="client-ca.pem"
                              code={material.trust_bundle_pem}
                              filename="client-ca.pem"
                              wrap
                            />
                          </div>
                        </details>
                      ) : (
                        <InfoBanner tone="warn">
                          读不到 client CA：{material.trust_bundle_error ?? '原因未知'}。网关拿不到信任锚就无法校验数据面证书。
                        </InfoBanner>
                      )}
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        )}
      </Block>
    </PageShell>
  )
}
