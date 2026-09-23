import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppIcon from '../components/icons/AppIcon';
import { useAuth } from '../context/AuthContext';
import { userHasHubSistema } from '../data/hubPermissions';
import {
  fetchHubImobiDetail,
  type HubImobiDetailResponse,
} from '../services/grupoFeHubService';
import './GrupoFeHub.css';
import './GrupoFeImobiDetail.css';

const ACCENT = '#0d9488';

function formatNumber(value: unknown) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HBarList({
  data,
  accent,
}: {
  data: { label: string | null | undefined; value: number }[];
  accent: string;
}) {
  const rows = data
    .map((d) => ({ ...d, label: String(d.label ?? '').trim() }))
    .filter((d) => d.value > 0 && d.label)
    .slice(0, 10);
  const max = Math.max(...rows.map((d) => d.value), 1);
  if (rows.length === 0) return <p className="gfh-muted">Sem distribuição</p>;

  return (
    <div className="gfh-hbar-list">
      {rows.map((item) => (
        <div key={item.label} className="gfh-hbar-row">
          <div className="gfh-hbar-top">
            <span title={item.label}>{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
          <div className="gfh-hbar-track">
            <div
              className="gfh-hbar-fill"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 55%, #fff))`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GrupoFeImobiDetail() {
  const { user } = useAuth();
  const hasImobi = userHasHubSistema(user?.is_super_admin, user?.hub_sistemas, 'imobi');

  const [data, setData] = useState<HubImobiDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !hasImobi) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const detail = await fetchHubImobiDetail(user.id);
        if (!cancelled) setData(detail);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar detalhe Imobi.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, hasImobi]);

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of data?.empresas_ativas ?? []) map.set(e.id, e.name);
    return map;
  }, [data?.empresas_ativas]);

  if (!hasImobi) {
    return <Navigate to="/grupo-fe" replace />;
  }

  const resumo = data?.resumo;
  const visitas = data?.visitas;
  const atendimentos = data?.atendimentos;

  const kpis = [
    { label: 'Leads', value: formatNumber(resumo?.leads) },
    { label: 'Imóveis', value: formatNumber(resumo?.imoveis) },
    { label: 'Visitas futuras', value: formatNumber(visitas?.futuras) },
    { label: 'Msgs 7d', value: formatNumber(atendimentos?.mensagens_7d) },
    { label: 'Empresas ativas', value: formatNumber(resumo?.empresas_ativas) },
  ];

  return (
    <div className="gfh-page gfi-page" style={{ ['--gfh-accent' as string]: ACCENT }}>
      <header className="gfh-hero">
        <div className="gfh-hero-top">
          <Link to="/grupo-fe" className="gfh-back">
            <AppIcon name="arrowLeft" size={16} />
            Central Grupo Fé
          </Link>
          {data?.generated_at && (
            <span className="gfh-live-pill">
              <i />
              Ao vivo ·{' '}
              {new Date(data.generated_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <div className="gfi-title-row">
          <span className="gfh-card-icon" aria-hidden>
            <AppIcon name="building" size={18} />
          </span>
          <div>
            <div className="gfh-card-eyebrow">Imobiliário</div>
            <h1>IAFÉ Imobi</h1>
            <p>Visitas, atendimentos, leads e empresas ativas — visão consolidada do CRM.</p>
          </div>
        </div>
      </header>

      {loading && (
        <div className="gfh-state gfh-skeleton-wrap">
          <div className="gfh-skeleton-row">
            <div className="gfh-skeleton" />
            <div className="gfh-skeleton" />
            <div className="gfh-skeleton" />
            <div className="gfh-skeleton" />
          </div>
          <p>Carregando detalhe Imobi…</p>
        </div>
      )}

      {error && <p className="gfh-state gfh-state-error">{error}</p>}

      {!loading && !error && data && (
        <>
          <section className="gfi-kpi-strip" aria-label="Indicadores Imobi">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="gfh-kpi">
                <span className="gfh-kpi-label">{kpi.label}</span>
                <strong className="gfh-kpi-value">{kpi.value}</strong>
              </div>
            ))}
          </section>

          <div className="gfi-blocks">
            <section className="gfh-card gfi-block">
              <header className="gfi-block-head">
                <h2>Empresas ativas</h2>
                <span className="gfh-muted">
                  {formatNumber(data.empresas_ativas.length)} com assinatura ativa
                </span>
              </header>
              {data.empresas_ativas.length === 0 ? (
                <p className="gfh-muted">Nenhuma empresa ativa no momento.</p>
              ) : (
                <div className="gfi-table-wrap">
                  <table className="gfi-table">
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Status</th>
                        <th>Leads</th>
                        <th>Visitas</th>
                        <th>Msgs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.empresas_ativas.map((e) => (
                        <tr key={e.id}>
                          <td>{e.name}</td>
                          <td>
                            <span className="gfi-badge">{e.subscription_status ?? '—'}</span>
                          </td>
                          <td>{formatNumber(e.leads)}</td>
                          <td>{formatNumber(e.visitas)}</td>
                          <td>{formatNumber(e.msgs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="gfh-card gfi-block">
              <header className="gfi-block-head">
                <h2>Visitas</h2>
                <span className="gfh-muted">
                  {formatNumber(visitas?.total)} total · {formatNumber(visitas?.futuras)} futuras
                </span>
              </header>
              <div className="gfi-split">
                <div>
                  <h3>Por status</h3>
                  <HBarList
                    accent={ACCENT}
                    data={(visitas?.por_status ?? []).map((s) => ({
                      label: s.status,
                      value: s.n,
                    }))}
                  />
                </div>
                <div>
                  <h3>Recentes</h3>
                  {(visitas?.recentes ?? []).length === 0 ? (
                    <p className="gfh-muted">Nenhuma visita registrada.</p>
                  ) : (
                    <ul className="gfi-list gfi-list-scroll">
                      {(visitas?.recentes ?? []).slice(0, 20).map((v) => (
                        <li key={v.id}>
                          <div className="gfi-list-main">
                            <strong>{formatDateTime(v.start_at)}</strong>
                            <span className="gfi-badge">{v.status ?? '—'}</span>
                          </div>
                          <span className="gfh-muted">
                            {v.company_id
                              ? (companyNameById.get(v.company_id) ?? v.company_id.slice(0, 8))
                              : 'Sem empresa'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <section className="gfh-card gfi-block">
              <header className="gfi-block-head">
                <h2>Atendimentos</h2>
                <span className="gfh-muted">Mensagens e conversas</span>
              </header>
              <div className="gfh-kpi-row">
                <div className="gfh-kpi">
                  <span className="gfh-kpi-label">Msgs 7 dias</span>
                  <strong className="gfh-kpi-value">
                    {formatNumber(atendimentos?.mensagens_7d)}
                  </strong>
                </div>
                <div className="gfh-kpi">
                  <span className="gfh-kpi-label">Msgs 30 dias</span>
                  <strong className="gfh-kpi-value">
                    {formatNumber(atendimentos?.mensagens_30d)}
                  </strong>
                </div>
                <div className="gfh-kpi">
                  <span className="gfh-kpi-label">Conversas</span>
                  <strong className="gfh-kpi-value">
                    {formatNumber(atendimentos?.conversas_distintas)}
                  </strong>
                </div>
                <div className="gfh-kpi">
                  <span className="gfh-kpi-label">Msgs total</span>
                  <strong className="gfh-kpi-value">
                    {formatNumber(atendimentos?.mensagens_total)}
                  </strong>
                </div>
              </div>
            </section>

            <section className="gfh-card gfi-block">
              <header className="gfi-block-head">
                <h2>Leads por stage</h2>
                <span className="gfh-muted">{formatNumber(resumo?.leads)} leads na base</span>
              </header>
              <HBarList
                accent={ACCENT}
                data={(data.leads_por_stage ?? []).map((s) => ({
                  label: s.stage,
                  value: s.n,
                }))}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
