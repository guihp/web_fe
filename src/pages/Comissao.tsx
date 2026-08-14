import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import {
  aggregateComissaoMensal,
  aggregateComissaoPorIndustria,
  aggregateComissaoPorRegiao,
  calcularComissoes,
  fetchComissaoIndustria,
  fetchPercentuais,
  updatePercentual,
} from '../services/comissaoService';
import { MESES_PT } from '../utils/vendasDomain';
import { formatBRL } from '../utils/currency';
import './Comissao.css';

type TabId = 'industria' | 'regiao' | 'mensal' | 'percentuais';

type ComissaoRow = {
  nome: string;
  vendas: number;
  percentual: number;
  comissao: number;
};

function ComissaoTable({ rows, showPercent = true }: { rows: ComissaoRow[]; showPercent?: boolean }) {
  const totalVendas = rows.reduce((acc, row) => acc + row.vendas, 0);
  const totalComissao = rows.reduce((acc, row) => acc + row.comissao, 0);

  return (
    <div className="comissao-table-wrap">
      <table className="comissao-table">
        <thead>
          <tr>
            <th>Indústria</th>
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

export default function Comissao() {
  const { showToast } = useToast();
  const currentYear = String(new Date().getFullYear());
  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState('Todos os Meses');
  const [regiao, setRegiao] = useState('Todas Regiões');
  const [tab, setTab] = useState<TabId>('industria');
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [rows, setRows] = useState<ComissaoRow[]>([]);
  const [percentuais, setPercentuais] = useState<{ nome: string; percentual: number }[]>([]);

  const regiaoFilter = regiao === 'Todas Regiões' ? undefined : regiao === 'Pará' ? 'PA' : 'MA/PI';
  const mesFilter = mes === 'Todos os Meses' ? undefined : mes;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [comissao, pct] = await Promise.all([
        fetchComissaoIndustria({ ano, mes: mesFilter, regiao: regiaoFilter }),
        fetchPercentuais(),
      ]);

      setPercentuais(pct.map((p) => ({ nome: p.industria, percentual: p.percentual })));

      if (tab === 'industria') {
        setRows(aggregateComissaoPorIndustria(comissao));
      } else if (tab === 'regiao') {
        setRows(
          aggregateComissaoPorRegiao(comissao).map((r) => ({
            nome: r.regiao,
            vendas: r.vendas,
            comissao: r.comissao,
            percentual: r.vendas > 0 ? (r.comissao / r.vendas) * 100 : 0,
          }))
        );
      } else if (tab === 'mensal') {
        setRows(
          aggregateComissaoMensal(comissao).map((r) => ({
            nome: r.mes,
            vendas: r.vendas,
            comissao: r.comissao,
            percentual: r.vendas > 0 ? (r.comissao / r.vendas) * 100 : 0,
          }))
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar comissões.', 'error');
    } finally {
      setLoading(false);
    }
  }, [ano, mesFilter, regiaoFilter, tab, showToast]);

  useEffect(() => {
    if (tab !== 'percentuais') {
      loadData();
      return;
    }
    setLoading(true);
    fetchPercentuais()
      .then((pct) => setPercentuais(pct.map((p) => ({ nome: p.industria, percentual: p.percentual }))))
      .catch((err) =>
        showToast(err instanceof Error ? err.message : 'Erro ao carregar percentuais.', 'error'),
      )
      .finally(() => setLoading(false));
  }, [loadData, tab, showToast]);

  const totals = useMemo(() => {
    const totalVendas = rows.reduce((a, r) => a + r.vendas, 0);
    const totalComissao = rows.reduce((a, r) => a + r.comissao, 0);
    const percentualMedio = totalVendas > 0 ? (totalComissao / totalVendas) * 100 : 0;
    return { totalVendas, totalComissao, percentualMedio };
  }, [rows]);

  const handleRecalcular = async () => {
    setRecalculating(true);
    try {
      await calcularComissoes(Number(ano), mesFilter);
      showToast('Comissões recalculadas com sucesso!', 'success');
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao recalcular.', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const handlePercentualChange = async (industria: string, value: number) => {
    try {
      await updatePercentual(industria, value);
      setPercentuais((prev) =>
        prev.map((p) => (p.nome === industria ? { ...p, percentual: value } : p))
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
          <select value={ano} onChange={(e) => setAno(e.target.value)}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {FILTRO_MESES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          <select value={regiao} onChange={(e) => setRegiao(e.target.value)}>
            <option value="Todas Regiões">Todas Regiões</option>
            <option value="MA/PI">MA/PI</option>
            <option value="Pará">Pará</option>
          </select>
        </label>
      </div>

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
          {(['industria', 'regiao', 'mensal', 'percentuais'] as TabId[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`comissao-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'industria' && 'Por Indústria'}
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
              <table className="comissao-table">
                <thead>
                  <tr>
                    <th>Indústria</th>
                    <th>% Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {percentuais.map((row) => (
                    <tr key={row.nome}>
                      <td className="col-nome">{row.nome}</td>
                      <td className="col-pct">
                        <input
                          type="number"
                          step="0.01"
                          value={row.percentual}
                          onChange={(e) =>
                            handlePercentualChange(row.nome, Number(e.target.value) || 0)
                          }
                          style={{ width: 80 }}
                        />
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <ComissaoTable rows={rows} showPercent={tab === 'industria'} />
        )}
      </section>
    </div>
  );
}
