import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppIcon from '../components/icons/AppIcon';
import { useAuth } from '../context/AuthContext';
import { userHasHubSistema } from '../data/hubPermissions';
import {
  fetchHubFinanceDetail,
  type HubFinanceDetailResponse,
} from '../services/grupoFeHubService';
import './GrupoFeHub.css';
import './GrupoFeFinanceDetail.css';

const ACCENT = '#2563eb';

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

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'ativa',
  overdue: 'em atraso',
  cancelled: 'cancelada',
  canceled: 'cancelada',
  pending: 'pendente',
  expired: 'expirada',
  inactive: 'inativa',
  unknown: 'desconhecida',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  received: 'recebido',
  confirmed: 'confirmado',
  pending: 'pendente',
  overdue: 'em atraso',
  cancelled: 'cancelado',
  canceled: 'cancelado',
  deleted: 'excluído',
  refunded: 'estornado',
  failed: 'falhou',
  chargeback: 'chargeback',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  PIX: 'PIX',
  BOLETO: 'Boleto',
  TRANSFER: 'Transferência',
  BANK_TRANSFER: 'Transferência bancária',
  TED: 'TED',
  DOC: 'DOC',
  CASH: 'Dinheiro',
  UNDEFINED: 'Saldo',
  UNDEFINED_ACCOUNT: 'Saldo em conta',
  OTHER: 'Outro',
  UNDEFINED_OTHER: 'Outro',
};

const TX_TYPE_LABELS: Record<string, string> = {
  income: 'Receitas',
  expense: 'Despesas',
  transfer: 'Transferências',
  refund: 'Estornos',
  unknown: 'Outros',
};

function normalizeKey(value: string | null | undefined) {
  if (value == null) return '';
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function subscriptionStatusLabel(status: string | null | undefined, isTrial = false) {
  if (!status) return isTrial ? '— (teste)' : '—';
  const key = normalizeKey(status);
  const base = SUBSCRIPTION_STATUS_LABELS[key] ?? status;
  return isTrial ? `${base} (teste)` : base;
}

function paymentStatusLabel(status: string | null) {
  if (!status) return '—';
  const key = normalizeKey(status);
  return PAYMENT_STATUS_LABELS[key] ?? status;
}

function paymentMethodLabel(method: string | null) {
  if (!method) return null;
  const upper = String(method).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return PAYMENT_METHOD_LABELS[upper] ?? method;
}

function txTypeLabel(type: string | null | undefined) {
  if (!type) return 'Outros';
  const key = normalizeKey(type);
  return TX_TYPE_LABELS[key] ?? type;
}

export default function GrupoFeFinanceDetail() {
  const { user } = useAuth();
  const hasFinance = userHasHubSistema(user?.is_super_admin, user?.hub_sistemas, 'finance');

  const [data, setData] = useState<HubFinanceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !hasFinance) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const detail = await fetchHubFinanceDetail(user.id);
        if (!cancelled) setData(detail);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar detalhe Finance.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, hasFinance]);

  if (!hasFinance) {
    return <Navigate to="/grupo-fe" replace />;
  }

  const resumo = data?.resumo;
  const pagamentos = data?.pagamentos;
  const transacoes = data?.transacoes_mes;
  const funil = data?.funil;

  const kpis = [
    { label: 'Clientes', value: formatNumber(resumo?.clientes) },
    { label: 'Ativas', value: formatNumber(resumo?.assinaturas_ativas) },
    { label: 'Faturando', value: formatNumber(resumo?.assinantes_faturando) },
    { label: 'Ticket', value: formatMoney(resumo?.ticket_medio_assinante) },
    { label: 'MRR', value: formatMoney(resumo?.mrr_estimado) },
  ];

  return (
    <div className="gfh-page gff-page" style={{ ['--gfh-accent' as string]: ACCENT }}>
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
        <div className="gff-title-row">
          <span className="gfh-card-icon" aria-hidden>
            <AppIcon name="money" size={18} />
          </span>
          <div>
            <div className="gfh-card-eyebrow">Financeiro</div>
            <h1>IAFÉ Finance</h1>
            <p>Assinaturas, pagamentos, transações e funil de cadastro — visão consolidada.</p>
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
          <p>Carregando detalhe Finance…</p>
        </div>
      )}

      {error && <p className="gfh-state gfh-state-error">{error}</p>}

      {!loading && !error && data && (
        <>
          <section className="gff-kpi-strip" aria-label="Indicadores Finance">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="gfh-kpi">
                <span className="gfh-kpi-label">{kpi.label}</span>
                <strong className="gfh-kpi-value">{kpi.value}</strong>
              </div>
            ))}
          </section>

          <div className="gff-blocks">
            <section className="gfh-card gff-block">
              <header className="gff-block-head">
                <h2>Assinaturas por status</h2>
                <span className="gfh-muted">
                  {formatNumber(resumo?.assinaturas_overdue)} em atraso ·{' '}
                  {formatNumber(resumo?.assinaturas_cancelled)} canceladas
                </span>
              </header>
              <HBarList
                accent={ACCENT}
                data={(data.assinaturas_por_status ?? []).map((s) => ({
                  label: subscriptionStatusLabel(s.status, s.is_trial),
                  value: s.n,
                }))}
              />
            </section>

            <section className="gfh-card gff-block">
              <header className="gff-block-head">
                <h2>Pagamentos</h2>
                <span className="gfh-muted">
                  {formatNumber(pagamentos?.recebidos_count)} recebidos ·{' '}
                  {formatMoney(pagamentos?.recebidos_soma)}
                </span>
              </header>
              {(pagamentos?.recentes ?? []).length === 0 ? (
                <p className="gfh-muted">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="gff-list gff-list-scroll">
                  {(pagamentos?.recentes ?? []).slice(0, 20).map((p, i) => (
                    <li key={`${p.paid_at ?? 'na'}-${i}`}>
                      <div className="gff-list-main">
                        <strong>{formatMoney(p.amount)}</strong>
                        <span className="gff-badge">{paymentStatusLabel(p.status)}</span>
                      </div>
                      <span className="gfh-muted">
                        {formatDateTime(p.paid_at)}
                        {p.payment_method ? ` · ${paymentMethodLabel(p.payment_method)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="gfh-card gff-block">
              <header className="gff-block-head">
                <h2>Transações do mês</h2>
                <span className="gfh-muted">{formatNumber(transacoes?.total)} lançamentos</span>
              </header>
              <div className="gfh-kpi-row">
                <div className="gfh-kpi">
                  <span className="gfh-kpi-label">Receitas</span>
                  <strong className="gfh-kpi-value">{formatMoney(transacoes?.receitas)}</strong>
                </div>
                <div className="gfh-kpi">
                  <span className="gfh-kpi-label">Despesas</span>
                  <strong className="gfh-kpi-value">{formatMoney(transacoes?.despesas)}</strong>
                </div>
                <div className="gfh-kpi">
                  <span className="gfh-kpi-label">Total</span>
                  <strong className="gfh-kpi-value">{formatNumber(transacoes?.total)}</strong>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <h3>Por tipo</h3>
                <HBarList
                  accent={ACCENT}
                  data={(transacoes?.por_tipo ?? []).map((t) => ({
                    label: `${txTypeLabel(t.type)} (${formatMoney(t.soma)})`,
                    value: t.n,
                  }))}
                />
              </div>
            </section>

            <section className="gfh-card gff-block">
              <header className="gff-block-head">
                <h2>Funil de cadastro</h2>
                <span className="gfh-muted">Pendentes, leads e desistências</span>
              </header>
              <div className="gff-funil">
                <div className="gff-funil-item">
                  <span>Cadastros pendentes</span>
                  <strong>{formatNumber(funil?.pending_registrations)}</strong>
                </div>
                <div className="gff-funil-item">
                  <span>Leads parciais</span>
                  <strong>{formatNumber(funil?.partial_leads)}</strong>
                </div>
                <div className="gff-funil-item">
                  <span>Desistentes</span>
                  <strong>{formatNumber(funil?.desistentes)}</strong>
                </div>
              </div>
            </section>

            <section className="gfh-card gff-block">
              <header className="gff-block-head">
                <h2>Clientes recentes</h2>
                <span className="gfh-muted">{formatNumber(resumo?.clientes)} na base</span>
              </header>
              {(data.clientes_recentes ?? []).length === 0 ? (
                <p className="gfh-muted">Nenhum cliente recente.</p>
              ) : (
                <ul className="gff-list gff-list-scroll">
                  {(data.clientes_recentes ?? []).map((c, i) => (
                    <li key={`${c.email ?? 'na'}-${i}`}>
                      <div className="gff-list-main">
                        <strong>{c.full_name?.trim() || 'Sem nome'}</strong>
                        <span className="gfh-muted">{formatDate(c.created_at)}</span>
                      </div>
                      <span className="gfh-muted">{c.email ?? '—'}</span>
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
