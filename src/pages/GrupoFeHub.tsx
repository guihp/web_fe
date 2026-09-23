import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppIcon, { type AppIconName } from '../components/icons/AppIcon';
import { useAuth } from '../context/AuthContext';
import { HUB_SISTEMAS, userHasHubSistema, type HubSistemaId } from '../data/hubPermissions';
import {
  fetchHubMetrics,
  type HubMetricsResponse,
  type HubSistemaMetricsResult,
} from '../services/grupoFeHubService';
import './GrupoFeHub.css';

const SISTEMA_META: Record<
  HubSistemaId,
  { accent: string; icon: AppIconName; short: string }
> = {
  fe: { accent: '#ea6624', icon: 'cart', short: 'Operação' },
  finance: { accent: '#2563eb', icon: 'money', short: 'Financeiro' },
  imobi: { accent: '#0d9488', icon: 'building', short: 'Imobiliário' },
  daily: { accent: '#7c3aed', icon: 'clipboard', short: 'Dev' },
};

function formatNumber(value: unknown) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function formatMoney(value: unknown) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(n);
}

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isNaN(n) ? 0 : n;
}

type Slice = { label: string; value: number; color: string };

function DonutChart({ slices, size = 120, thickness = 18 }: { slices: Slice[]; size?: number; thickness?: number }) {
  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  if (total <= 0) {
    return (
      <div className="gfh-donut gfh-donut-empty" style={{ width: size, height: size }}>
        <span>Sem dados</span>
      </div>
    );
  }

  return (
    <div className="gfh-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={thickness}
        />
        {slices
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="gfh-donut-center">
        <strong>{formatNumber(total)}</strong>
        <span>total</span>
      </div>
    </div>
  );
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
    .slice(0, 6);
  const max = Math.max(...rows.map((d) => d.value), 1);
  if (rows.length === 0) return <p className="gfh-muted">Sem distribuição no período</p>;

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

function StackedStatus({
  todo,
  doing,
  done,
}: {
  todo: number;
  doing: number;
  done: number;
}) {
  const total = todo + doing + done;
  if (total <= 0) return <p className="gfh-muted">Nenhuma demanda na semana</p>;
  const pct = (v: number) => `${(v / total) * 100}%`;

  return (
    <div className="gfh-stack">
      <div className="gfh-stack-bar" role="img" aria-label="Status das demandas">
        <span style={{ width: pct(todo), background: '#94a3b8' }} title={`A fazer: ${todo}`} />
        <span style={{ width: pct(doing), background: '#f59e0b' }} title={`Em andamento: ${doing}`} />
        <span style={{ width: pct(done), background: '#16a34a' }} title={`Concluído: ${done}`} />
      </div>
      <div className="gfh-stack-legend">
        <span>
          <i style={{ background: '#94a3b8' }} /> A fazer {formatNumber(todo)}
        </span>
        <span>
          <i style={{ background: '#f59e0b' }} /> Em andamento {formatNumber(doing)}
        </span>
        <span>
          <i style={{ background: '#16a34a' }} /> Concluído {formatNumber(done)}
        </span>
      </div>
    </div>
  );
}

type Featured = { label: string; value: string; hint?: string };

function featuredFor(result: HubSistemaMetricsResult): Featured {
  const m = result.metrics ?? {};
  switch (result.sistema) {
    case 'fe':
      return {
        label: 'Pedidos em aberto',
        value: formatNumber(m.pedidos_kanban_abertos),
        hint: `${formatNumber(m.vendas_mes)} vendas no mês`,
      };
    case 'finance':
      return {
        label: 'Ticket médio / assinante',
        value: formatMoney(m.ticket_medio_assinante),
        hint: `${formatNumber(m.assinantes_faturando)} faturando · MRR ${formatMoney(m.mrr_estimado)}`,
      };
    case 'imobi':
      return {
        label: 'Leads na base',
        value: formatNumber(m.leads),
        hint: `${formatNumber(m.empresas_total)} empresas · ${formatNumber(m.imoveis)} imóveis`,
      };
    case 'daily': {
      const semana = (m.demandas_semana ?? {}) as Record<string, unknown>;
      return {
        label: 'Demandas na semana',
        value: formatNumber(semana.total),
        hint: `${formatNumber(m.clientes)} projetos · ${formatNumber(m.usuarios)} usuários`,
      };
    }
    default:
      return { label: '—', value: '—' };
  }
}

function secondaryKpis(result: HubSistemaMetricsResult): { label: string; value: string }[] {
  const m = result.metrics ?? {};
  switch (result.sistema) {
    case 'fe':
      return [
        { label: 'Usuários ativos', value: formatNumber(m.usuarios_ativos) },
        { label: 'Vendas do mês', value: formatNumber(m.vendas_mes) },
      ];
    case 'finance':
      return [
        { label: 'Assinaturas ativas', value: formatNumber(m.assinaturas_ativas) },
        { label: 'Em trial', value: formatNumber(m.assinaturas_trial) },
        { label: 'Faturando', value: formatNumber(m.assinantes_faturando) },
      ];
    case 'imobi':
      return [
        { label: 'Empresas ativas', value: formatNumber(m.empresas_ativas) },
        { label: 'Trial', value: formatNumber(m.empresas_trial) },
        { label: 'Bloqueadas', value: formatNumber(m.empresas_bloqueadas) },
        { label: 'Usuários', value: formatNumber(m.usuarios_ativos) },
      ];
    case 'daily': {
      const semana = (m.demandas_semana ?? {}) as Record<string, unknown>;
      return [
        { label: 'A fazer', value: formatNumber(semana.todo) },
        { label: 'Em andamento', value: formatNumber(semana.doing) },
        { label: 'Concluído', value: formatNumber(semana.done) },
      ];
    }
    default:
      return [];
  }
}

function chartPanel(result: HubSistemaMetricsResult, accent: string) {
  const m = result.metrics ?? {};

  if (result.sistema === 'finance') {
    return (
      <div className="gfh-viz">
        <DonutChart
          slices={[
            { label: 'Ativas', value: num(m.assinaturas_ativas), color: accent },
            { label: 'Trial', value: num(m.assinaturas_trial), color: '#93c5fd' },
          ]}
        />
        <div className="gfh-viz-side">
          <h3>Assinaturas</h3>
          <HBarList
            accent={accent}
            data={[
              { label: 'Ativas', value: num(m.assinaturas_ativas) },
              { label: 'Trial', value: num(m.assinaturas_trial) },
            ]}
          />
        </div>
      </div>
    );
  }

  if (result.sistema === 'imobi') {
    return (
      <div className="gfh-viz">
        <DonutChart
          slices={[
            { label: 'Ativas', value: num(m.empresas_ativas), color: accent },
            { label: 'Trial', value: num(m.empresas_trial), color: '#5eead4' },
            { label: 'Bloqueadas', value: num(m.empresas_bloqueadas), color: '#f87171' },
          ]}
        />
        <div className="gfh-viz-side">
          <h3>Empresas</h3>
          <HBarList
            accent={accent}
            data={[
              { label: 'Ativas', value: num(m.empresas_ativas) },
              { label: 'Trial', value: num(m.empresas_trial) },
              { label: 'Bloqueadas', value: num(m.empresas_bloqueadas) },
            ]}
          />
        </div>
      </div>
    );
  }

  if (result.sistema === 'daily') {
    const semana = (m.demandas_semana ?? {}) as Record<string, unknown>;
    const rows = (m.demandas_por_cliente ?? []) as { cliente: string; total: number }[];
    return (
      <div className="gfh-viz gfh-viz-stack">
        <div>
          <h3>Status da semana</h3>
          <StackedStatus
            todo={num(semana.todo)}
            doing={num(semana.doing)}
            done={num(semana.done)}
          />
        </div>
        <div>
          <h3>Por cliente</h3>
          <HBarList
            accent={accent}
            data={rows.map((r) => ({ label: r.cliente, value: Number(r.total ?? 0) }))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="gfh-viz">
      <DonutChart
        slices={[
          { label: 'Kanban', value: num(m.pedidos_kanban_abertos), color: accent },
          { label: 'Vendas', value: num(m.vendas_mes), color: '#fdba74' },
        ]}
      />
      <div className="gfh-viz-side">
        <h3>Operação</h3>
        <HBarList
          accent={accent}
          data={[
            { label: 'Kanban aberto', value: num(m.pedidos_kanban_abertos) },
            { label: 'Vendas do mês', value: num(m.vendas_mes) },
          ]}
        />
      </div>
    </div>
  );
}

function SistemaCard({
  result,
  nome,
  descricao,
}: {
  result: HubSistemaMetricsResult;
  nome: string;
  descricao: string;
}) {
  const meta = SISTEMA_META[result.sistema];
  const featured = featuredFor(result);
  const kpis = secondaryKpis(result);
  const detailPath =
    result.sistema === 'imobi'
      ? '/grupo-fe/imobi'
      : result.sistema === 'finance'
        ? '/grupo-fe/finance'
        : result.sistema === 'daily'
          ? '/grupo-fe/daily'
          : null;

  const body = (
    <>
      <header className="gfh-card-head">
        <div className="gfh-card-title-row">
          <span className="gfh-card-icon" aria-hidden>
            <AppIcon name={meta.icon} size={18} />
          </span>
          <div>
            <div className="gfh-card-eyebrow">{meta.short}</div>
            <h2>{nome}</h2>
            <p>{descricao}</p>
          </div>
        </div>
        <span className={`gfh-status ${result.ok ? 'ok' : 'err'}`}>
          {result.ok ? 'Ao vivo' : 'Erro'}
        </span>
      </header>

      {!result.ok ? (
        <p className="gfh-error">{result.error ?? 'Não foi possível carregar este sistema.'}</p>
      ) : (
        <>
          <div className="gfh-featured">
            <span className="gfh-featured-label">{featured.label}</span>
            <strong className="gfh-featured-value">{featured.value}</strong>
            {featured.hint && <span className="gfh-featured-hint">{featured.hint}</span>}
          </div>

          <div className="gfh-kpi-row">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="gfh-kpi">
                <span className="gfh-kpi-label">{kpi.label}</span>
                <strong className="gfh-kpi-value">{kpi.value}</strong>
              </div>
            ))}
          </div>

          <div className="gfh-chart">{chartPanel(result, meta.accent)}</div>
        </>
      )}
    </>
  );

  if (detailPath) {
    return (
      <Link
        to={detailPath}
        id={`gfh-sistema-${result.sistema}`}
        className="gfh-card gfh-card-link"
        style={{ ['--gfh-accent' as string]: meta.accent }}
      >
        {body}
      </Link>
    );
  }

  return (
    <article
      id={`gfh-sistema-${result.sistema}`}
      className="gfh-card"
      style={{ ['--gfh-accent' as string]: meta.accent }}
    >
      {body}
    </article>
  );
}

function buildExecutiveSummary(results: HubSistemaMetricsResult[]) {
  const byId = new Map(results.map((r) => [r.sistema, r]));
  const fe = byId.get('fe');
  const finance = byId.get('finance');
  const imobi = byId.get('imobi');
  const daily = byId.get('daily');

  const cards: { label: string; value: string; sub: string; accent: string }[] = [];

  if (finance?.ok) {
    cards.push({
      label: 'Ticket médio Finance',
      value: formatMoney(finance.metrics?.ticket_medio_assinante),
      sub: `${formatNumber(finance.metrics?.assinantes_faturando)} faturando`,
      accent: SISTEMA_META.finance.accent,
    });
  }
  if (imobi?.ok) {
    cards.push({
      label: 'Leads Imobi',
      value: formatNumber(imobi.metrics?.leads),
      sub: `${formatNumber(imobi.metrics?.empresas_total)} empresas`,
      accent: SISTEMA_META.imobi.accent,
    });
  }
  if (daily?.ok) {
    const semana = (daily.metrics?.demandas_semana ?? {}) as Record<string, unknown>;
    cards.push({
      label: 'Demandas (semana)',
      value: formatNumber(semana.total),
      sub: `${formatNumber(semana.done)} concluídas`,
      accent: SISTEMA_META.daily.accent,
    });
  }
  if (fe?.ok) {
    cards.push({
      label: 'Kanban Fé',
      value: formatNumber(fe.metrics?.pedidos_kanban_abertos),
      sub: `${formatNumber(fe.metrics?.usuarios_ativos)} usuários ativos`,
      accent: SISTEMA_META.fe.accent,
    });
  }

  return cards;
}

export default function GrupoFeHub() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<HubMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visibleSystems = useMemo(() => {
    return HUB_SISTEMAS.filter((s) =>
      userHasHubSistema(user?.is_super_admin, user?.hub_sistemas, s.id),
    );
  }, [user?.is_super_admin, user?.hub_sistemas]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const metrics = await fetchHubMetrics(user.id);
        if (!cancelled) setData(metrics);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar o hub.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const focusSistema = searchParams.get('sistema');
  useEffect(() => {
    if (loading || !focusSistema) return;
    const el = document.getElementById(`gfh-sistema-${focusSistema}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [loading, focusSistema, visibleSystems]);

  const bySistema = useMemo(() => {
    const map = new Map<HubSistemaId, HubSistemaMetricsResult>();
    for (const row of data?.sistemas ?? []) map.set(row.sistema, row);
    return map;
  }, [data]);

  const summary = useMemo(
    () => buildExecutiveSummary(data?.sistemas ?? []),
    [data?.sistemas],
  );

  const onlineCount = useMemo(
    () => (data?.sistemas ?? []).filter((s) => s.ok).length,
    [data?.sistemas],
  );

  return (
    <div className="gfh-page">
      <header className="gfh-hero">
        <div className="gfh-hero-top">
          <Link to="/" className="gfh-back">
            <AppIcon name="arrowLeft" size={16} />
            Portal
          </Link>
          {data?.generated_at && (
            <span className="gfh-live-pill">
              <i />
              {onlineCount}/{visibleSystems.length} sistemas ·{' '}
              {new Date(data.generated_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <h1>Central Grupo Fé</h1>
        <p>
          Painel executivo dos produtos Fé — métricas agregadas no servidor, sem expor chaves dos
          outros projetos no navegador.
        </p>
      </header>

      {loading && (
        <div className="gfh-state gfh-skeleton-wrap">
          <div className="gfh-skeleton-row">
            <div className="gfh-skeleton" />
            <div className="gfh-skeleton" />
            <div className="gfh-skeleton" />
            <div className="gfh-skeleton" />
          </div>
          <p>Carregando métricas consolidadas…</p>
        </div>
      )}

      {error && <p className="gfh-state gfh-state-error">{error}</p>}

      {!loading && !error && summary.length > 0 && (
        <section className="gfh-summary" aria-label="Resumo executivo">
          {summary.map((card) => (
            <div
              key={card.label}
              className="gfh-summary-card"
              style={{ ['--gfh-accent' as string]: card.accent }}
            >
              <span className="gfh-summary-label">{card.label}</span>
              <strong className="gfh-summary-value">{card.value}</strong>
              <span className="gfh-summary-sub">{card.sub}</span>
            </div>
          ))}
        </section>
      )}

      {!loading && !error && (
        <div className="gfh-grid">
          {visibleSystems.map((sistema) => {
            const result = bySistema.get(sistema.id) ?? {
              sistema: sistema.id,
              ok: false,
              error: 'Sem dados retornados para este sistema.',
            };
            return (
              <SistemaCard
                key={sistema.id}
                result={result}
                nome={sistema.nome}
                descricao={sistema.descricao}
              />
            );
          })}
        </div>
      )}

      {!loading && !error && visibleSystems.length === 0 && (
        <p className="gfh-state">Nenhum sistema liberado. Fale com um admin supremo.</p>
      )}
    </div>
  );
}
