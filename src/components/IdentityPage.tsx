import type { CertFile, Status, WhoAmI } from '../api'
import { formatBytes, formatDateTime } from '../format'
import { Badge, Block, Card, Empty, Field, Mono, PageShell } from './ui'

function certTone(cert: CertFile): 'green' | 'red' {
  return cert.exists && !cert.error ? 'green' : 'red'
}

export function IdentityPage({
  status,
  certs,
  me,
}: {
  status: Status
  certs: CertFile[]
  me: WhoAmI | null
}) {
  return (
    <PageShell
      title="身份与状态"
      summary="管理面身份（mTLS）、授权作用域（Bearer）、站点身份文件（证书 / 私钥 / 信任锚）。私钥永远不返回任何派生值。"
    >
      <Block wide>
        <div className="grid grid--2">
          <Card
            title="本次连接"
            subtitle="传输身份来自 mTLS，作用域来自 Bearer 令牌 —— 两件事，分开看。"
            aside={me ? <Badge tone={me.can_apply ? 'green' : 'blue'}>{me.scope}</Badge> : null}
          >
            {me ? (
              <div className="kv">
                <Field label="作用域">
                  <Mono>{me.scope}</Mono>
                  <span className="muted"> · </span>
                  {me.can_apply ? (
                    <span className="text-ok">可下发配置 / 重启数据面</span>
                  ) : (
                    <span className="text-muted">只读（viewer）</span>
                  )}
                </Field>
                <Field label="传输身份">
                  {me.identity ? (
                    <span>
                      <Mono>{me.identity.id}</Mono>
                      {me.identity.cn ? <span className="muted"> · cn={me.identity.cn}</span> : null}
                    </span>
                  ) : (
                    <span className="muted">未出示客户端证书（明文回环或单向 TLS）</span>
                  )}
                </Field>
                {me.identity ? (
                  <>
                    <Field label="指纹">
                      <Mono title={me.identity.fingerprint_sha256}>{me.identity.fingerprint_sha256}</Mono>
                    </Field>
                    <Field label="有效期">
                      {formatDateTime(me.identity.not_before)} → {formatDateTime(me.identity.not_after)}
                    </Field>
                  </>
                ) : null}
              </div>
            ) : (
              <Empty title="没有身份信息" hint="确认已填入令牌且 ctrl 可达。" />
            )}
          </Card>

          <Card title="管理面姿态" subtitle="这些字段决定「谁能调管理面」。">
            <div className="kv">
              <Field label="监听">
                <Mono>
                  {status.listen}:{status.port}
                </Mono>
              </Field>
              <Field label="TLS">
                {status.tls ? (
                  <span>
                    <Mono>{status.tls.cert_file}</Mono>
                    <span className="muted"> · </span>
                    <Badge tone={status.tls.mtls ? 'green' : 'amber'}>
                      {status.tls.mtls ? 'mTLS' : '单向 TLS'}
                    </Badge>
                  </span>
                ) : (
                  <span className="text-warn">未启用（只应绑回环）</span>
                )}
              </Field>
              <Field label="匿名放行">
                {status.tls?.allow_unauthenticated ? (
                  <Badge tone="amber">allow_unauthenticated = true</Badge>
                ) : (
                  <Badge tone="green">关闭</Badge>
                )}
              </Field>
              <Field label="工作根">
                <Mono title={status.work_root}>{status.work_root}</Mono>
              </Field>
            </div>
          </Card>
        </div>
      </Block>

      <Block wide>
        <Card title="站点身份文件" subtitle="存在性 / 权限位 / 证书 SHA-256 / 到期；私钥不给指纹、不给正文。">
          {certs.length === 0 ? (
            <Empty title="没有读到身份文件" hint="检查 [ingest] 与 [ctrl.tls] 的路径，以及 identity/ 的挂载。" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>角色</th>
                    <th>状态</th>
                    <th>mode</th>
                    <th>大小</th>
                    <th>SHA-256</th>
                    <th>notAfter</th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((cert) => (
                    <tr key={cert.role}>
                      <td>
                        <Mono>{cert.role}</Mono>
                      </td>
                      <td>
                        <Badge tone={certTone(cert)}>
                          {cert.exists && !cert.error ? 'present' : 'missing'}
                        </Badge>
                        {cert.error ? <p className="table__error">{cert.error}</p> : null}
                      </td>
                      <td>
                        <Mono>{cert.mode ?? '—'}</Mono>
                      </td>
                      <td>{cert.bytes === null ? '—' : formatBytes(cert.bytes)}</td>
                      <td>
                        {cert.sha256 ? (
                          <Mono title={cert.sha256}>{`${cert.sha256.slice(0, 24)}…`}</Mono>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{cert.not_after ? formatDateTime(cert.not_after) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">
            `server_cert` / `server_key` / `client_ca` 是<strong>数据面容器内</strong>路径；ctrl 通过{' '}
            <Mono>identity_dir</Mono> 映射到宿主路径才能检查。私钥出现 `other` 可读写应视为配置错误。
          </p>
        </Card>
      </Block>

      <Block wide>
        <Card
          title="安全 lint"
          subtitle="与「总览」同源；这里给全量（含 warn）。"
          aside={
            status.lint.length === 0 ? (
              <Badge tone="green">无发现</Badge>
            ) : (
              <Badge tone={status.lint.some((item) => item.level === 'error') ? 'red' : 'amber'}>
                {status.lint.length} 条
              </Badge>
            )
          }
        >
          {status.lint.length === 0 ? (
            <Empty title="没有发现任何问题" hint="证书映射、framing、鉴权与授权 TTL 都通过了检查。" />
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
        </Card>
      </Block>
    </PageShell>
  )
}
