import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import {
  aggregateComissaoMensal,
  aggregateComissaoPorNome,
  aggregateComissaoPorRegiao,
  calcularComissoes,
  CATEGORIAS_COMISSAO,
  fetchComissaoRows,
  fetchPercentuais,
  updatePercentual,
} from '../services/comissaoService';
import { MESES_PT } from '../utils/vendasDomain';
import { formatBRL } from '../utils/currency';
import './Comissao.css';

type TabId = 'nome' | 'regiao' | 'mensal' | 'percentuais';

type ComissaoRow = {
  nome: string;
  vendas: number;
  percentual: number;
  comissao: number;
};

type PercentualRow = {
  nome: string;
  percentual: number;
  categoria: string;
};

function currentMesPt() {
  return MESES_PT[new Date().getMonth()] ?? 'JANEIRO';
}

function isMesTodos(mes: string) {
  const n = mes.trim().toUpperCase();
  return n === '' || n === 'TODOS' || n === 'TODOS OS MESES';
}

function ComissaoTable({
  rows,
  nomeLabel,
  showPercent = true,
}: {
  rows: ComissaoRow[];
  nomeLabel: string;
  showPercent?: boolean;
}) {
  const totalVendas = rows.reduce((acc, row) => acc + row.vendas, 0);
  const totalComissao = rows.reduce((acc, row) => acc + row.comissao, 0);

  return (
    <div className="comissao-table-wrap">
      <table className="comissao-table">
        <thead>
          <tr>
            <th>{nomeLabel}</th>
            <th>Vendas</th>
            {showPercent && <th>%</th>}
            <th>Comissão</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.nome}>
              <td className="col-nome">{row.nome}</td>
              <td className="col-num">{formatBRL(row.vendas)}</td>
              {showPercent && <td className="col-pct">{row.percentual.toFixed(2).replace('.', ',')}%</td>}
              <td className="col-comissao">{formatBRL(row.comissao)}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td className="col-nome">TOTAL</td>
            <td className="col-num">{formatBRL(totalVendas)}</td>
            {showPercent && <td className="col-pct">—</td>}
            <td className="col-comissao">{formatBRL(totalComissao)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const FILTRO_MESES = ['Todos os Meses', ...MESES_PT];

/** Alerta temporário: some após 31/12/2026 (categorias completas em todos os meses). */
function showCategoriaAlertUntil2026() {
  return new Date() <= new Date(2026, 11, 31, 23, 59, 59, 999);
}

export default function Comissao() {
  const { showToast } = useToast();
  const currentYear = String(new Date().getFullYear());
  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState<string>(currentMesPt());
  const [regiao, setRegiao] = useState('Todas Regiões');
  const [tab, setTab] = useState<TabId>('nome');
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [rows, setRows] = useState<ComissaoRow[]>([]);
  const [kpiRows, setKpiRows] = useState<ComissaoRow[]>([]);
  const [percentuais, setPercentuais] = useState<PercentualRow[]>([]);

  const regiaoFilter =
    regiao === 'Todas Regiões' ? undefined : regiao === 'Pará' ? 'PA' : regiao;
  const mesFilter = isMesTodos(mes) ? undefined : mes.toUpperCase();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [comissao, pct] = await Promise.all([
        fetchComissaoRows({ ano, mes: mesFilter, regiao: regiaoFilter }),
        fetchPercentuais(),
      ]);

      setPercentuais(
        pct.map((p) => ({
          nome: p.industria,
          percentual: p.percentual,
          categoria: p.categoria ?? '',
        })),
      );

      const porNome = aggregateComissaoPorNome(comissao).map((r) => ({
        nome: r.nome,
        vendas: r.vendas,
        comissao: r.comissao,
        percentual: r.percentual,
      }));
      setKpiRows(porNome);

      if (tab === 'nome') {
        setRows(porNome);
      } else if (tab === 'regiao') {
        setRows(
          aggregateComissaoPorRegiao(comissao).map((r) => ({
            nome: r.regiao,
            vendas: r.vendas,
            comissao: r.comissao,
            percentual: r.vendas > 0 ? (r.comissao / r.vendas) * 100 : 0,
          })),
        );
      } else if (tab === 'mensal') {
        setRows(
          aggregateComissaoMensal(comissao).map((r) => ({
            nome: r.mes,
            vendas: r.vendas,
            comissao: r.comissao,
            percentual: r.vendas > 0 ? (r.comissao / r.vendas) * 100 : 0,
          })),
        );
      } else {
        setRows(porNome);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar comissões.', 'error');
    } finally {
      setLoading(false);
    }
  }, [ano, mesFilter, regiaoFilter, tab, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    const source = tab === 'percentuais' ? kpiRows : rows;
    const totalVendas = source.reduce((a, r) => a + r.vendas, 0);
    const totalComissao = source.reduce((a, r) => a + r.comissao, 0);
    const percentualMedio = totalVendas > 0 ? (totalComissao / totalVendas) * 100 : 0;
    return { totalVendas, totalComissao, percentualMedio };
  }, [rows, kpiRows, tab]);

  const handleRecalcular = async () => {
    setRecalculating(true);
    try {
      await calcularComissoes(Number(ano), mesFilter);
      showToast(
        mesFilter
          ? `Comissões de ${mesFilter}/${ano} recalculadas e salvas.`
          : `Comissões de ${ano} recalculadas e salvas.`,
        'success',
      );
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao recalcular.', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const persistPercentual = async (
    nome: string,
    percentual: number,
    categoria: string,
  ) => {
    try {
      await updatePercentual(nome, percentual, categoria || null);
      setPercentuais((prev) =>
        prev.map((p) =>
          p.nome === nome ? { ...p, percentual, categoria } : p,
        ),
      );
      showToast('Percentual atualizado.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar percentual.', 'error');
    }
  };

  const anos = [String(Number(currentYear) - 1), currentYear, String(Number(currentYear) + 1)];

  return (
    <div className="comissao-page">
      <header className="comissao-header">
        <h1 className="page-title">Comissão por Indústria</h1>
        <button type="button" className="btn-primary" disabled={recalculating} onClick={handleRecalcular}>
          <span>↻</span> {recalculating ? 'Calculando...' : 'Recalcular'}
        </button>
      </header>

      <div className="comissao-filters card">
        <label>
          <span className="comissao-filter-label">Ano</span>
          <select value={ano} onChange={(e) => setAno(e.target.value)}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="comissao-filter-label">Mês</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {FILTRO_MESES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="comissao-filter-label">Região</span>
          <select value={regiao} onChange={(e) => setRegiao(e.target.value)}>
            <option value="Todas Regiões">Todas Regiões</option>
            <option value="MA/PI">MA/PI</option>
            <option value="Pará">Pará</option>
          </select>
        </label>
      </div>

      {showCategoriaAlertUntil2026() && (
        <aside className="comissao-alert" role="status">
          <strong>Categoria nas comissões</strong>
          <p>
            Só a partir de <em>agosto/2026</em> todos os pedidos têm categoria. Nos meses anteriores
            isso não está completo. Para cálculo de <em>todos os meses</em> ou <em>anual</em>,
            mantenha a categoria em <em>Geral (todas)</em>. Já no mensal de agosto em diante, pode
            usar categoria normalmente.
          </p>
        </aside>
      )}

      <div className="comissao-kpi-grid">
        <article className="comissao-kpi card">
          <span>Total Vendas</span>
          <strong>
            <em className="symbol">$</em> {formatBRL(totals.totalVendas)}
          </strong>
        </article>
        <article className="comissao-kpi card highlight">
          <span>Total Comissão</span>
          <strong className="coral">
            <em className="symbol">$</em> {formatBRL(totals.totalComissao)}
          </strong>
        </article>
        <article className="comissao-kpi card">
          <span>% Médio</span>
          <strong>
            <em className="symbol coral">%</em> {totals.percentualMedio.toFixed(2).replace('.', ',')}%
          </strong>
        </article>
      </div>

      <section className="card comissao-content">
        <div className="comissao-tabs">
          {(['nome', 'regiao', 'mensal', 'percentuais'] as TabId[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`comissao-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'nome' && 'Por Indústria'}
              {t === 'regiao' && 'Por Região'}
              {t === 'mensal' && 'Mensal'}
              {t === 'percentuais' && 'Percentuais'}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ padding: 24 }}>Carregando...</p>
        ) : tab === 'percentuais' ? (
          <div className="comissao-table-wrap">
            {percentuais.length === 0 ? (
              <p style={{ padding: 24 }}>Nenhuma indústria encontrada.</p>
            ) : (
              <>
                <p className="comissao-hint comissao-hint-inline">
                  Um % por indústria. Categoria ao lado é opcional: se escolher, o cálculo usa só as
                  vendas dessa categoria.
                </p>
                <table className="comissao-table">
                  <thead>
                    <tr>
                      <th>Indústria</th>
                      <th>Categoria</th>
                      <th>% Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {percentuais.map((row) => (
                      <tr key={row.nome}>
                        <td className="col-nome">{row.nome}</td>
                        <td className="col-categoria">
                          <select
                            className="comissao-cat-select"
                            value={row.categoria}
                            onChange={(e) =>
                              void persistPercentual(row.nome, row.percentual, e.target.value)
                            }
                            aria-label={`Categoria de comissão ${row.nome}`}
                          >
                            <option value="">Geral (todas)</option>
                            {CATEGORIAS_COMISSAO.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="col-pct">
                          <label className="comissao-pct-field">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.percentual}
                              onChange={(e) => {
                                const value = Number(e.target.value) || 0;
                                setPercentuais((prev) =>
                                  prev.map((p) =>
                                    p.nome === row.nome ? { ...p, percentual: value } : p,
                                  ),
                                );
                              }}
                              onBlur={(e) => {
                              const value = Number(e.target.value) || 0;
                              const current = percentuais.find((p) => p.nome === row.nome);
                              void persistPercentual(
                                row.nome,
                                value,
                                current?.categoria ?? row.categoria,
                              );
                            }}
                              aria-label={`Percentual de comissão ${row.nome}`}
                            />
                            <span aria-hidden>%</span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        ) : rows.length === 0 ? (
          <p style={{ padding: 24 }}>
            Nenhum valor salvo para este filtro. Clique em Recalcular para calcular e gravar no banco.
          </p>
        ) : (
          <ComissaoTable
            rows={rows}
            nomeLabel={tab === 'nome' ? 'Indústria' : tab === 'regiao' ? 'Região' : 'Mês'}
            showPercent={tab === 'nome'}
          />
        )}
      </section>
    </div>
  );
}
