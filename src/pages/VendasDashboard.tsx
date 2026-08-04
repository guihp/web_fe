import { useEffect, useMemo, useState } from 'react';
import {
  DonutChart,
  HorizontalBarChart,
  KpiCardView,
  VerticalBarChart,
} from '../components/vendas/DashboardCharts';
import {
  fetchRealizadoVsMeta,
  fetchVendasMensais,
  fetchVendasPorIndustria,
  fetchVendasRaw,
} from '../services/dashboardService';
import { MESES_PT, regiaoFromEstado } from '../utils/vendasDomain';
import { formatBRLCompact } from '../utils/currency';
import './VendasDashboard.css';

const CORAL = '#ea6624';
const CORAL_DARK = '#d4551a';
const BLUE = '#3b82f6';

const MESES_LABEL = MESES_PT.map((m) => m.charAt(0) + m.slice(1).toLowerCase());

function mesToDb(mes: string) {
  const idx = MESES_LABEL.findIndex((m) => m.toLowerCase() === mes.toLowerCase());
  return idx >= 0 ? MESES_PT[idx] : mes.toUpperCase();
}

export default function VendasDashboard() {
  const currentYear = String(new Date().getFullYear());
  const currentMonthIdx = new Date().getMonth();
  const [mes, setMes] = useState(MESES_LABEL[currentMonthIdx] ?? 'Junho');
  const [ano, setAno] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [mapiMensal, setMapiMensal] = useState<{ mes: string; valor: number }[]>([]);
  const [paMensal, setPaMensal] = useState<{ mes: string; valor: number }[]>([]);
  const [mapiMesIndustria, setMapiMesIndustria] = useState<{ nome: string; valor: number }[]>([]);
  const [mapiAnualIndustria, setMapiAnualIndustria] = useState<{ nome: string; valor: number }[]>([]);
  const [paAnualIndustria, setPaAnualIndustria] = useState<{ nome: string; valor: number }[]>([]);
  const [metaMapi, setMetaMapi] = useState(0);
  const [metaPa, setMetaPa] = useState(0);
  const [realizadoMapiMes, setRealizadoMapiMes] = useState(0);
  const [realizadoPaMes, setRealizadoPaMes] = useState(0);
  const [totalMapi, setTotalMapi] = useState(0);
  const [totalPa, setTotalPa] = useState(0);

  const mesDb = mes === 'Todos' || mes === 'Todos os Meses' ? undefined : mesToDb(mes);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [
          mapiM,
          paM,
          mapiIndMes,
          mapiIndAno,
          paIndAno,
          vsMeta,
          rows,
        ] = await Promise.all([
          fetchVendasMensais(ano, 'MA/PI'),
          fetchVendasMensais(ano, 'PA'),
          fetchVendasPorIndustria(ano, mesDb, 'MA/PI'),
          fetchVendasPorIndustria(ano, undefined, 'MA/PI'),
          fetchVendasPorIndustria(ano, undefined, 'PA'),
          fetchRealizadoVsMeta(ano, mesDb),
          fetchVendasRaw(ano, mesDb),
        ]);

        if (cancelled) return;

        const sumRegiao = (regiao: 'MA/PI' | 'PA') =>
          rows
            .filter((r) => regiaoFromEstado(r.estado ?? '') === regiao)
            .reduce((a, r) => a + Number(r.valor), 0);

        setMapiMensal(mapiM.map((d) => ({ mes: d.label, valor: d.value })));
        setPaMensal(paM.map((d) => ({ mes: d.label, valor: d.value })));
        setMapiMesIndustria(mapiIndMes.map((d) => ({ nome: d.label, valor: d.value })));
        setMapiAnualIndustria(mapiIndAno.map((d) => ({ nome: d.label, valor: d.value })));
        setPaAnualIndustria(paIndAno.map((d) => ({ nome: d.label, valor: d.value })));
        setMetaMapi(vsMeta.meta / 2);
        setMetaPa(vsMeta.meta / 2);
        setRealizadoMapiMes(sumRegiao('MA/PI'));
        setRealizadoPaMes(sumRegiao('PA'));
        setTotalMapi(mapiM.reduce((a, d) => a + d.value, 0));
        setTotalPa(paM.reduce((a, d) => a + d.value, 0));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ano, mesDb]);

  const anos = useMemo(() => {
    const y = new Date().getFullYear();
    return [String(y - 1), String(y), String(y + 1)];
  }, []);

  const kpiCards = useMemo(
    () => [
      {
        id: 'total',
        title: `Total ${mes}`,
        realizado: realizadoMapiMes + realizadoPaMes,
        meta: metaMapi + metaPa,
        percentLabel: `${metaMapi + metaPa > 0 ? (((realizadoMapiMes + realizadoPaMes) / (metaMapi + metaPa)) * 100).toFixed(1) : '0'}% da meta`,
        icon: 'target' as const,
      },
      {
        id: 'mapi',
        title: `MA/PI — ${mes}`,
        realizado: realizadoMapiMes,
        meta: metaMapi,
        percentLabel: `${metaMapi > 0 ? ((realizadoMapiMes / metaMapi) * 100).toFixed(1) : '0'}% da meta`,
        icon: 'trend' as const,
      },
      {
        id: 'pa',
        title: `PA — ${mes}`,
        realizado: realizadoPaMes,
        meta: metaPa,
        percentLabel: `${metaPa > 0 ? ((realizadoPaMes / metaPa) * 100).toFixed(1) : '0'}% da meta`,
        icon: 'trend' as const,
      },
    ],
    [mes, realizadoMapiMes, realizadoPaMes, metaMapi, metaPa]
  );

  const handleExport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="vendas-dashboard">
        <p style={{ padding: 24 }}>Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="vendas-dashboard" id="vendas-dashboard-print">
      <header className="vendas-header">
        <div>
          <h1 className="page-title">Dashboard de Vendas</h1>
          <p className="vendas-subtitle">Acompanhamento Regional MA-PI-PA</p>
        </div>

        <div className="vendas-header-actions">
          <button type="button" className="btn-primary vendas-export-btn" onClick={handleExport}>
            <span>📄</span> Exportar PDF
          </button>
          <select className="vendas-select" value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="Todos">Todos os Meses</option>
            {MESES_LABEL.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="vendas-select" value={ano} onChange={(e) => setAno(e.target.value)}>
            {anos.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="vendas-kpi-grid">
        {kpiCards.map((card) => (
          <KpiCardView key={card.id} title={card.title} realizado={card.realizado} meta={card.meta} percentLabel={card.percentLabel} icon={card.icon} />
        ))}
      </section>

      <section className="card vendas-section">
        <h2 className="vendas-section-title">Comparativo Mensal por Região — {mes}</h2>

        <div className="vendas-compare-grid">
          <div className="vendas-compare-block">
            <h3>Realizado x Meta Mensal ({mes}) — MA/PI</h3>
            <DonutChart realizado={realizadoMapiMes} meta={metaMapi} color={CORAL} />
          </div>
          <div className="vendas-compare-block">
            <h3>Realizado x Meta Mensal ({mes}) — Pará</h3>
            <DonutChart realizado={realizadoPaMes} meta={metaPa} color={BLUE} />
          </div>
        </div>

        <div className="vendas-charts-grid">
          <div className="vendas-chart-card">
            <h3>Venda do Mês por Indústria — MA/PI</h3>
            <HorizontalBarChart data={mapiMesIndustria.length ? mapiMesIndustria : [{ nome: 'Sem dados', valor: 0 }]} color={CORAL} />
          </div>
          <div className="vendas-chart-card">
            <h3>Venda Anual por Indústria — Pará</h3>
            <HorizontalBarChart data={paAnualIndustria.length ? paAnualIndustria : [{ nome: 'Sem dados', valor: 0 }]} color={BLUE} />
          </div>
          <div className="vendas-chart-card full">
            <h3>Venda Anual por Indústria — MA/PI</h3>
            <HorizontalBarChart data={mapiAnualIndustria.length ? mapiAnualIndustria : [{ nome: 'Sem dados', valor: 0 }]} color={CORAL_DARK} />
          </div>
        </div>
      </section>

      <section className="vendas-monthly-grid">
        <article className="card vendas-monthly-card">
          <h2>Mensal — MA/PI</h2>
          <p className="vendas-monthly-meta">Meta: {formatBRLCompact(metaMapi)}/mês</p>
          <div className="vendas-total-box">
            <span>Total Realizado (Ano):</span>
            <strong>{formatBRLCompact(totalMapi)}</strong>
          </div>
          <VerticalBarChart data={mapiMensal} color={CORAL} />
        </article>

        <article className="card vendas-monthly-card">
          <h2>Mensal — Pará (PA)</h2>
          <p className="vendas-monthly-meta">Meta: {formatBRLCompact(metaPa)}/mês</p>
          <div className="vendas-total-box">
            <span>Total Realizado (Ano):</span>
            <strong>{formatBRLCompact(totalPa)}</strong>
          </div>
          <VerticalBarChart data={paMensal} color={BLUE} />
        </article>
      </section>
    </div>
  );
}
