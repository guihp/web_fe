import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../components/icons/AppIcon';
import { VerticalBarChart } from '../components/vendas/DashboardCharts';
import {
  fetchComparativoIndustrias,
  fetchCrescimentoRegional,
  fetchVendasMensais,
  fetchVendasMensaisComparativo,
} from '../services/dashboardService';
import { mesNumeroFromNome, MESES_PT, type Regiao } from '../utils/vendasDomain';
import { formatBRL, formatBRLCompact } from '../utils/currency';
import { fetchIndustriaNomes } from '../services/industriaService';
import './Relatorios.css';

function calcDiff(a: number | null, b: number | null) {
  if (a === null || b === null) return null;
  return b - a;
}

function chartRegiaoToDomain(regiao: string): Regiao | undefined {
  if (regiao === 'MA/PI') return 'MA/PI';
  if (regiao === 'Pará' || regiao === 'PA') return 'PA';
  return undefined;
}

function VariacaoBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="variacao-neutral">-</span>;
  const positive = value >= 0;
  return (
    <span className={`variacao-badge ${positive ? 'up' : 'down'}`}>
      {positive ? '↗' : '↘'} {positive ? '+' : ''}
      {value.toFixed(1).replace('.', ',')}%
    </span>
  );
}

export default function Relatorios() {
  const currentYear = new Date().getFullYear();
  const [mes, setMes] = useState('Todos os Meses');
  const [regiao, setRegiao] = useState('Todas');
  const [anoBase, setAnoBase] = useState(String(currentYear - 1));
  const [anoComp, setAnoComp] = useState(String(currentYear));
  const [industriaChart, setIndustriaChart] = useState('Todas as Indústrias');
  const [anoChart, setAnoChart] = useState(String(currentYear));
  const [regiaoChart, setRegiaoChart] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [chartLoading, setChartLoading] = useState(true);
  const [comparativo, setComparativo] = useState<
    { industria: string; valorBase: number; valorComp: number; variacao: number | null }[]
  >([]);
  const [crescimentoRegional, setCrescimentoRegional] = useState({
    mapi: { atual: 0, anterior: 0, variacao: null as number | null },
    pa: { atual: 0, anterior: 0, variacao: null as number | null },
    geral: { atual: 0, anterior: 0, variacao: null as number | null },
  });
  const [mensalComp, setMensalComp] = useState<{ mes: string; base: number; comp: number }[]>([]);
  const [mensalChart, setMensalChart] = useState<{ mes: string; valor: number }[]>([]);
  const [industriasFiltro, setIndustriasFiltro] = useState<string[]>([]);

  const ateMesNumero =
    mes === 'Todos os Meses' ? new Date().getMonth() + 1 : mesNumeroFromNome(mes.toUpperCase());
  const mesNomeFiltro =
    mes === 'Todos os Meses' ? undefined : MESES_PT[ateMesNumero - 1];
  const regiaoFiltro = chartRegiaoToDomain(regiao);

  useEffect(() => {
    fetchIndustriaNomes()
      .then(setIndustriasFiltro)
      .catch(() => setIndustriasFiltro([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchComparativoIndustrias(anoBase, anoComp, regiaoFiltro, mesNomeFiltro, ateMesNumero),
      fetchCrescimentoRegional(anoBase, anoComp, ateMesNumero, regiaoFiltro),
      fetchVendasMensaisComparativo(anoBase, anoComp, regiaoFiltro),
    ])
      .then(([comp, cresc, mensal]) => {
        if (cancelled) return;
        setComparativo(comp);
        setCrescimentoRegional(cresc);
        setMensalComp(mensal);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setHasLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [anoBase, anoComp, ateMesNumero, mesNomeFiltro, regiaoFiltro]);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);

    const regiaoDomain = chartRegiaoToDomain(regiaoChart);
    const industria =
      industriaChart === 'Todas as Indústrias' ? undefined : industriaChart;

    fetchVendasMensais(anoChart, regiaoDomain, industria)
      .then((rows) => {
        if (cancelled) return;
        setMensalChart(rows.map((r) => ({ mes: r.label, valor: r.value })));
      })
      .catch(() => {
        if (!cancelled) setMensalChart([]);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [industriaChart, anoChart, regiaoChart]);

  const topQueda = useMemo(
    () =>
      [...comparativo]
        .filter((c) => c.variacao !== null && c.variacao < 0 && c.valorBase > 0)
        .sort((a, b) => (a.variacao ?? 0) - (b.variacao ?? 0))
        .slice(0, 3),
    [comparativo],
  );

  const topCrescimento = useMemo(
    () =>
      [...comparativo]
        .filter((c) => c.variacao !== null && c.variacao > 0 && c.valorComp > 0)
        .sort((a, b) => {
          const diffA = a.valorComp - a.valorBase;
          const diffB = b.valorComp - b.valorBase;
          // Prioriza maior ganho absoluto; empate pela variação %
          if (diffB !== diffA) return diffB - diffA;
          return (b.variacao ?? 0) - (a.variacao ?? 0);
        })
        .slice(0, 3),
    [comparativo],
  );

  const crescimentoRows = useMemo(() => {
    const rows = [
      { label: 'MA/PI', ...crescimentoRegional.mapi },
      { label: 'Pará', ...crescimentoRegional.pa },
      { label: 'Geral', ...crescimentoRegional.geral },
    ];
    if (regiao === 'MA/PI') return rows.filter((r) => r.label === 'MA/PI');
    if (regiao === 'Pará') return rows.filter((r) => r.label === 'Pará');
    return rows;
  }, [crescimentoRegional, regiao]);

  const anos = [
    String(currentYear - 2),
    String(currentYear - 1),
    String(currentYear),
    String(currentYear + 1),
  ];
  const meses = [
    'Todos os Meses',
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  if (!hasLoaded && loading) {
    return (
      <div className="relatorios-page">
        <p style={{ padding: 24 }}>Carregando relatórios...</p>
      </div>
    );
  }

  const paraResumo = {
    label: 'Pará',
    valor2025: crescimentoRegional.pa.anterior,
    valor2026: crescimentoRegional.pa.atual,
    variacao: crescimentoRegional.pa.variacao,
  };

  return (
    <div className="relatorios-page">
      <header className="relatorios-header">
        <div>
          <h1 className="page-title">Relatórios de Crescimento</h1>
          <p className="relatorios-subtitle">
            Comparativo de desempenho {anoBase} x {anoComp}
            {mes === 'Todos os Meses'
              ? ` · YTD até ${MESES_PT[ateMesNumero - 1]?.slice(0, 3) ?? ''}`
              : ` · ${mes}`}
            {regiao !== 'Todas' ? ` · ${regiao}` : ''}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <AppIcon name="file" size={16} /> Exportar PDF
        </button>
      </header>

      <div className={`relatorios-filters card ${loading ? 'is-loading' : ''}`}>
        <label>
          <span>Mês</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)} disabled={loading}>
            {meses.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Região</span>
          <select value={regiao} onChange={(e) => setRegiao(e.target.value)} disabled={loading}>
            {['Todas', 'MA/PI', 'Pará'].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="ano-compare">
          <span>Ano Base</span>
          <div className="ano-compare-row">
            <select
              value={anoBase}
              onChange={(e) => setAnoBase(e.target.value)}
              disabled={loading}
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className="vs">vs</span>
            <select
              value={anoComp}
              onChange={(e) => setAnoComp(e.target.value)}
              disabled={loading}
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {loading && <p className="relatorios-updating">Atualizando relatórios...</p>}

      <div className="relatorios-highlights">
        <article className="highlight-card growth">
          <h3>
            <AppIcon name="medal" size={18} /> Top 3 Crescimento
          </h3>
          {topCrescimento.length === 0 ? (
            <p className="empty-highlight">Nenhum crescimento registrado</p>
          ) : (
            <ul>
              {topCrescimento.map((item, index) => (
                <li key={item.industria}>
                  <span>
                    {index + 1}. {item.industria}
                  </span>
                  <strong>+{(item.variacao ?? 0).toFixed(1).replace('.', ',')}%</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="highlight-card decline">
          <h3>
            <AppIcon name="warning" size={18} /> Top 3 Queda
          </h3>
          {topQueda.length === 0 ? (
            <p className="empty-highlight">Nenhuma queda registrada</p>
          ) : (
            <ul>
              {topQueda.map((item, index) => (
                <li key={item.industria}>
                  <span>
                    {index + 1}. {item.industria}
                  </span>
                  <strong>{(item.variacao ?? 0).toFixed(1).replace('.', ',')}%</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <section className="card relatorios-table-section">
        <h2>Comparativo por Indústria</h2>
        <div className="relatorios-table-wrap">
          <table className="relatorios-table">
            <thead>
              <tr>
                <th>Indústria</th>
                <th>{anoBase}</th>
                <th>{anoComp}</th>
                <th>Diferença</th>
                <th>Variação</th>
              </tr>
            </thead>
            <tbody>
              {comparativo.map((item) => {
                const diff = calcDiff(item.valorBase, item.valorComp);
                const variacao = item.variacao;
                const insuficiente = item.valorBase === 0 && item.valorComp === 0;

                return (
                  <tr key={item.industria}>
                    <td className="col-industria">{item.industria}</td>
                    <td className="col-num">
                      {insuficiente ? (
                        <em className="muted">Dados insuficientes</em>
                      ) : (
                        formatBRL(item.valorBase)
                      )}
                    </td>
                    <td className="col-num">
                      {insuficiente ? (
                        <em className="muted">Dados insuficientes</em>
                      ) : (
                        formatBRL(item.valorComp)
                      )}
                    </td>
                    <td className={`col-num ${diff !== null && diff < 0 ? 'negative' : ''}`}>
                      {diff === null ? <em className="muted">-</em> : formatBRL(diff)}
                    </td>
                    <td className="col-var">
                      {insuficiente ? <em className="muted">-</em> : <VariacaoBadge value={variacao} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="resumo-executivo">
        <h3>
          <AppIcon name="lightbulb" size={18} /> Resumo Executivo
        </h3>
        <p>
          <strong>Total geral:</strong>{' '}
          {crescimentoRegional.geral.variacao !== null ? (
            <>
              {crescimentoRegional.geral.variacao >= 0 ? 'Crescimento' : 'Retração'} de{' '}
              <strong
                className={crescimentoRegional.geral.variacao >= 0 ? 'positive' : 'negative'}
              >
                {crescimentoRegional.geral.variacao.toFixed(1).replace('.', ',')}%
              </strong>{' '}
              no comparativo YTD ({formatBRLCompact(crescimentoRegional.geral.anterior)} →{' '}
              {formatBRLCompact(crescimentoRegional.geral.atual)}).
            </>
          ) : (
            'Dados insuficientes para o período selecionado.'
          )}
        </p>
      </section>

      <section className="crescimento-real">
        <h3>
          <AppIcon name="trend" size={18} /> Crescimento Real (YTD) · {anoBase} x {anoComp}
        </h3>
        <p className="crescimento-real-note">
          Comparação considerando apenas os meses já realizados em ambos os anos (até o mês atual).
        </p>
        <div className="crescimento-real-list">
          {crescimentoRows.map((item) => (
            <div key={item.label} className="crescimento-real-row">
              <span className="label">{item.label}</span>
              <span className="values">
                {formatBRLCompact(item.anterior)} → {formatBRLCompact(item.atual)}
              </span>
              <span className={item.variacao !== null && item.variacao >= 0 ? 'positive' : 'negative'}>
                {item.variacao !== null
                  ? `${item.variacao >= 0 ? '+' : ''}${item.variacao.toFixed(1).replace('.', ',')}%`
                  : '-'}
              </span>
              <span>
                ({item.variacao !== null && item.variacao >= 0 ? '+' : ''}
                {formatBRLCompact(item.atual - item.anterior)})
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="regiao-summary">
        <span className="label">Pará</span>
        <span className="values">
          {formatBRLCompact(paraResumo.valor2025)} → {formatBRLCompact(paraResumo.valor2026)}
        </span>
        <span
          className={
            paraResumo.variacao !== null && paraResumo.variacao >= 0 ? 'positive' : 'negative'
          }
        >
          {paraResumo.variacao !== null
            ? `${paraResumo.variacao >= 0 ? '+' : ''}${paraResumo.variacao.toFixed(1).replace('.', ',')}% (+${formatBRLCompact(paraResumo.valor2026 - paraResumo.valor2025)})`
            : '-'}
        </span>
      </div>

      <section className="card relatorios-table-section">
        <h2>
          Comparativo Mensal ({anoBase} x {anoComp})
        </h2>
        <div className="relatorios-table-wrap">
          <table className="relatorios-table mensal">
            <thead>
              <tr>
                <th>Mês</th>
                <th>{anoBase}</th>
                <th>{anoComp}</th>
                <th>Variação</th>
              </tr>
            </thead>
            <tbody>
              {mensalComp.map((item) => {
                const variacao = item.base > 0 ? ((item.comp - item.base) / item.base) * 100 : null;
                return (
                  <tr key={item.mes}>
                    <td>{item.mes}</td>
                    <td className="col-num">{item.base ? formatBRLCompact(item.base) : '-'}</td>
                    <td className="col-num">
                      {item.comp ? (
                        formatBRLCompact(item.comp)
                      ) : (
                        <em className="muted">Aguardando dados</em>
                      )}
                    </td>
                    <td className="col-var">
                      <VariacaoBadge value={variacao} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card relatorios-chart-section">
        <h2>Vendas Mensais por Indústria</h2>
        <div className="relatorios-chart-filters">
          <label>
            <span>Indústria</span>
            <select value={industriaChart} onChange={(e) => setIndustriaChart(e.target.value)}>
              <option value="Todas as Indústrias">Todas as Indústrias</option>
              {industriasFiltro.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Ano</span>
            <select value={anoChart} onChange={(e) => setAnoChart(e.target.value)}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Região</span>
            <select value={regiaoChart} onChange={(e) => setRegiaoChart(e.target.value)}>
              {['Todas', 'MA/PI', 'Pará'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        {chartLoading ? (
          <p className="relatorios-chart-loading">Atualizando gráfico...</p>
        ) : (
          <VerticalBarChart data={mensalChart} color="#ea6624" />
        )}
      </section>
    </div>
  );
}
