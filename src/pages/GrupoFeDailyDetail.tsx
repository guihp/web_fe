import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppIcon from '../components/icons/AppIcon';
import { useAuth } from '../context/AuthContext';
import { userHasHubSistema } from '../data/hubPermissions';
import {
  fetchHubDailyDetail,
  type HubDailyDetailResponse,
} from '../services/grupoFeHubService';
import './GrupoFeHub.css';
import './GrupoFeDailyDetail.css';

const ACCENT = '#7c3aed';

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'A fazer',
  doing: 'Em andamento',
  done: 'Concluído',
};

const CLIENT_STATUS_LABELS: Record<string, string> = {
  oportunidade: 'Oportunidade',
  kickoff: 'Kickoff',
  aguardando_informacoes: 'Aguardando informações',
  execucao: 'Execução',
  testes: 'Testes',
  melhorias: 'Melhorias',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const ART_STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
};

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

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function taskStatusLabel(status: string | null | undefined) {
  if (!status) return '—';
  return TASK_STATUS_LABELS[status] ?? status;
}

function clientStatusLabel(status: string | null) {
  if (!status) return '—';
  return CLIENT_STATUS_LABELS[status] ?? status;
}

function artStatusLabel(status: string | null | undefined) {
  if (!status) return '—';
  return ART_STATUS_LABELS[status] ?? status;
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

export default function GrupoFeDailyDetail() {
  const { user } = useAuth();
  const hasDaily = userHasHubSistema(user?.is_super_admin, user?.hub_sistemas, 'daily');

  const [data, setData] = useState<HubDailyDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !hasDaily) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const detail = await fetchHubDailyDetail(user.id);
        if (!cancelled) setData(detail);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar detalhe Daily.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, hasDaily]);

  if (!hasDaily) {
    return <Navigate to="/grupo-fe" replace />;
  }

  const resumo = data?.resumo;
  const semana = resumo?.demandas_semana;
  const weekRange =
    resumo?.semana?.start && resumo?.semana?.end
      ? `${formatDate(resumo.semana.start)} – ${formatDate(resumo.semana.end)}`
      : null;

  const kpis = [
    { label: 'Usuários', value: formatNumber(resumo?.usuarios) },
    { label: 'Projetos', value: formatNumber(resumo?.clientes) },
    { label: 'Demandas semana', value: formatNumber(semana?.total) },
    { label: 'A fazer', value: formatNumber(semana?.todo) },
    { label: 'Em andamento', value: formatNumber(semana?.doing) },
    { label: 'Atrasadas', value: formatNumber(resumo?.tarefas_atrasadas) },
  ];

  return (
    <div className="gfh-page gfd-page" style={{ ['--gfh-accent' as string]: ACCENT }}>
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
        <div className="gfd-title-row">
          <span className="gfh-card-icon" aria-hidden>
            <AppIcon name="clipboard" size={18} />
          </span>
          <div>
            <div className="gfh-card-eyebrow">Dev</div>
            <h1>Daily</h1>
            <p>
              Demandas da semana, projetos, artes e atividade — visão consolidada do board.
              {weekRange ? ` Semana ${weekRange}.` : ''}
            </p>
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
          <p>Carregando detalhe Daily…</p>
        </div>
      )}

      {error && <p className="gfh-state gfh-state-error">{error}</p>}

      {!loading && !error && data && (
        <>
          <section className="gfd-kpi-strip" aria-label="Indicadores Daily">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="gfh-kpi">
                <span className="gfh-kpi-label">{kpi.label}</span>
                <strong className="gfh-kpi-value">{kpi.value}</strong>
              </div>
            ))}
          </section>

          <div className="gfd-blocks">
            <section className="gfh-card gfd-block">
              <header className="gfd-block-head">
                <h2>Demandas da semana</h2>
                <span className="gfh-muted">
                  {formatNumber(semana?.total)} no período
                  {resumo?.artes_pendentes
                    ? ` · ${formatNumber(resumo.artes_pendentes)} artes pendentes`
                    : ''}
                </span>
              </header>
              <div className="gfd-split">
                <div>
                  <h3>Por status</h3>
                  <HBarList
                    accent={ACCENT}
                    data={(data.demandas_por_status ?? []).map((s) => ({
                      label: taskStatusLabel(s.status),
                      value: s.n,
                    }))}
                  />
                </div>
                <div>
                  <h3>Por cliente</h3>
                  <HBarList
                    accent={ACCENT}
                    data={(data.demandas_por_cliente ?? []).map((c) => ({
                      label: c.cliente,
                      value: c.total,
                    }))}
                  />
                </div>
              </div>
            </section>

            <section className="gfh-card gfd-block">
              <header className="gfd-block-head">
                <h2>Tarefas recentes</h2>
                <span className="gfh-muted">
                  {formatNumber(resumo?.tarefas_daily)} tarefas daily
                </span>
              </header>
              {(data.tarefas_recentes ?? []).length === 0 ? (
                <p className="gfh-muted">Nenhuma tarefa recente.</p>
              ) : (
                <ul className="gfd-list gfd-list-scroll">
                  {(data.tarefas_recentes ?? []).map((t, i) => (
                    <li key={`${t.title}-${t.updated_at ?? i}`}>
                      <div className="gfd-list-main">
                        <strong>{t.title}</strong>
                        <span className="gfd-badge">{taskStatusLabel(t.status)}</span>
                      </div>
                      <span className="gfh-muted">
                        {t.client_name ?? 'Sem projeto'}
                        {` · ${t.assignee_name ? `responsável ${t.assignee_name}` : 'sem responsável'}`}
                        {t.due_date ? ` · prazo ${formatDate(t.due_date)}` : ''}
                        {t.updated_at ? ` · ${formatDateTime(t.updated_at)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="gfh-card gfd-block">
              <header className="gfd-block-head">
                <h2>Projetos</h2>
                <span className="gfh-muted">{formatNumber(data.projetos.length)} na base</span>
              </header>
              {data.projetos.length === 0 ? (
                <p className="gfh-muted">Nenhum projeto cadastrado.</p>
              ) : (
                <div className="gfd-table-wrap">
                  <table className="gfd-table">
                    <thead>
                      <tr>
                        <th>Projeto</th>
                        <th>Status</th>
                        <th>Prioridade</th>
                        <th>Abertas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projetos.map((p) => (
                        <tr key={p.name}>
                          <td>{p.name}</td>
                          <td>
                            <span className="gfd-badge">{clientStatusLabel(p.status)}</span>
                          </td>
                          <td>{formatNumber(p.week_priority)}</td>
                          <td>{formatNumber(p.tarefas_abertas)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="gfh-card gfd-block">
              <header className="gfd-block-head">
                <h2>Artes</h2>
                <span className="gfh-muted">
                  {formatNumber(data.artes.pendentes)} pendentes de aprovação
                </span>
              </header>
              {(data.artes.recentes ?? []).length === 0 ? (
                <p className="gfh-muted">Nenhuma arte registrada.</p>
              ) : (
                <ul className="gfd-list gfd-list-scroll">
                  {(data.artes.recentes ?? []).map((a, i) => (
                    <li key={`${a.title ?? 'arte'}-${a.created_at ?? i}`}>
                      <div className="gfd-list-main">
                        <strong>{a.title?.trim() || 'Sem título'}</strong>
                        <span className="gfd-badge">{artStatusLabel(a.status)}</span>
                      </div>
                      <span className="gfh-muted">{formatDateTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="gfh-card gfd-block">
              <header className="gfd-block-head">
                <h2>Atividade recente</h2>
                <span className="gfh-muted">Últimas ações no board</span>
              </header>
              {(data.atividade_recente ?? []).length === 0 ? (
                <p className="gfh-muted">Nenhuma atividade recente.</p>
              ) : (
                <ul className="gfd-list gfd-list-scroll">
                  {(data.atividade_recente ?? []).map((a, i) => (
                    <li key={`${a.action}-${a.created_at ?? i}`}>
                      <div className="gfd-list-main">
                        <strong>{a.action}</strong>
                        <span className="gfh-muted">{formatDateTime(a.created_at)}</span>
                      </div>
                      <span className="gfh-muted">{a.client_name ?? 'Geral'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
