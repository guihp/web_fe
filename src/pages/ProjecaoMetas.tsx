import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchIndustrias } from '../services/atividadesService';
import { useToast } from '../context/ToastContext';
import {
  fetchMetas,
  fetchRealizado,
  upsertMeta,
} from '../services/metasService';
import {
  ANOS_PROJECAO,
  calcMetaMensal,
  calcProjecaoAnual,
  sumTotals,
  type MetaIndustria,
} from '../data/projecaoMetasData';
import { formatBRL } from '../utils/currency';
import './ProjecaoMetas.css';

function IconEdit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

type RegiaoTab = 'mapi' | 'pa';

export default function ProjecaoMetas() {
  const { showToast } = useToast();
  const [anoBase, setAnoBase] = useState(String(new Date().getFullYear()));
  const [tab, setTab] = useState<RegiaoTab>('mapi');
  const [mapiRows, setMapiRows] = useState<MetaIndustria[]>([]);
  const [paRows, setPaRows] = useState<MetaIndustria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const anoProjecao = String(Number(anoBase) + 1);

  const loadMetas = useCallback(async () => {
    setLoading(true);
    try {
      const [industrias, metas] = await Promise.all([
        fetchIndustrias(),
        fetchMetas(Number(anoProjecao)),
      ]);

      const buildForRegiao = async (regiao: 'MA/PI' | 'PA', prefix: string): Promise<MetaIndustria[]> => {
        const regiaoMetas = metas.filter((m) => m.regiao === regiao);
        return Promise.all(
          industrias.map(async (ind, index) => {
            const existing = regiaoMetas.find((m) => m.industria === ind.Nome);
            const realizado = await fetchRealizado(Number(anoBase), regiao, ind.Nome);
            return {
              id: existing?.id ?? `${prefix}-${index}`,
              nome: ind.Nome,
              total2026: realizado,
              media2026: realizado / 12,
              manual: existing?.modo_manual ?? false,
              crescimento: existing?.crescimento_percentual ?? 20,
              metaMensalManual: existing?.meta_mensal_manual ?? 0,
              projecaoAnualManual: existing?.meta_anual_manual ?? 0,
            };
          })
        );
      };

      const [mapi, pa] = await Promise.all([buildForRegiao('MA/PI', 'mapi'), buildForRegiao('PA', 'pa')]);
      setMapiRows(mapi);
      setPaRows(pa);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar metas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [anoBase, anoProjecao, showToast]);

  useEffect(() => {
    loadMetas();
  }, [loadMetas]);
  const activeRows = tab === 'mapi' ? mapiRows : paRows;
  const setActiveRows = tab === 'mapi' ? setMapiRows : setPaRows;

  const mapiTotals = useMemo(() => sumTotals(mapiRows), [mapiRows]);
  const paTotals = useMemo(() => sumTotals(paRows), [paRows]);
  const geralTotals = useMemo(
    () => ({
      projecaoAnual: mapiTotals.projecaoAnual + paTotals.projecaoAnual,
      metaMensal: mapiTotals.metaMensal + paTotals.metaMensal,
    }),
    [mapiTotals, paTotals]
  );

  const activeTotals = sumTotals(activeRows);

  const updateRow = (id: string, patch: Partial<MetaIndustria>) => {
    setActiveRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allRows = [
        ...mapiRows.map((r) => ({ row: r, regiao: 'MA/PI' as const })),
        ...paRows.map((r) => ({ row: r, regiao: 'PA' as const })),
      ];

      for (const { row, regiao } of allRows) {
        const isUuid = /^[0-9a-f-]{36}$/i.test(row.id);
        await upsertMeta({
          ...(isUuid ? { id: row.id } : {}),
          industria: row.nome,
          regiao,
          ano_base: Number(anoBase),
          ano_projecao: Number(anoProjecao),
          crescimento_percentual: row.crescimento,
          modo_manual: row.manual,
          meta_anual_manual: row.manual ? row.projecaoAnualManual || null : null,
          meta_mensal_manual: row.manual ? row.metaMensalManual || null : null,
        });
      }

      showToast('Metas salvas com sucesso!', 'success');
      loadMetas();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar metas.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="projecao-page">
        <p style={{ padding: 24 }}>Carregando metas...</p>
      </div>
    );
  }

  return (
    <div className="projecao-page">
      <header className="projecao-header">
        <div>
          <h1 className="page-title">Projeção de Metas</h1>
          <p className="projecao-subtitle">Defina as metas de crescimento por indústria e região</p>
        </div>
        <div className="projecao-header-actions">
          <label className="ano-base-field">
            <span>Ano Base</span>
            <select value={anoBase} onChange={(e) => setAnoBase(e.target.value)}>
              {ANOS_PROJECAO.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
            <span>💾</span> {saving ? 'Salvando...' : 'Salvar Metas'}
          </button>
        </div>
      </header>

      <div className="projecao-alert">
        <span>⚠</span>
        <p>
          <strong>Atenção:</strong> Algumas indústrias estão usando metas manuais. Quando o modo manual está
          ativo, o cálculo baseado no ano anterior é ignorado. Você só pode usar um método por vez
          (calculado OU manual).
        </p>
      </div>

      <div className="projecao-summary-grid">
        <article className="projecao-summary card">
          <span>Total MA/PI — {anoProjecao}</span>
          <strong>{formatBRL(mapiTotals.projecaoAnual)}</strong>
          <small>Meta mensal: {formatBRL(mapiTotals.metaMensal)}</small>
        </article>
        <article className="projecao-summary card">
          <span>Total PA — {anoProjecao}</span>
          <strong>{formatBRL(paTotals.projecaoAnual)}</strong>
          <small>Meta mensal: {formatBRL(paTotals.metaMensal)}</small>
        </article>
        <article className="projecao-summary card highlight">
          <span>Total Geral — {anoProjecao}</span>
          <strong>{formatBRL(geralTotals.projecaoAnual)}</strong>
          <small>Meta mensal: {formatBRL(geralTotals.metaMensal)}</small>
        </article>
      </div>

      <section className="card projecao-table-section">
        <div className="projecao-table-head">
          <div>
            <h2>Projeção de Metas por Indústria — {anoProjecao}</h2>
            <p>Baseado no desempenho de {anoBase} • Ative &quot;Manual&quot; para definir metas diretamente</p>
          </div>
          <button type="button" className="projecao-btn-outline">
            <span>+</span> Adicionar Indústria
          </button>
        </div>

        <div className="projecao-tabs">
          <button
            type="button"
            className={`projecao-tab ${tab === 'mapi' ? 'active' : ''}`}
            onClick={() => setTab('mapi')}
          >
            MA/PI ({mapiRows.length})
          </button>
          <button
            type="button"
            className={`projecao-tab ${tab === 'pa' ? 'active' : ''}`}
            onClick={() => setTab('pa')}
          >
            Pará ({paRows.length})
          </button>
        </div>

        <div className="projecao-table-wrap">
          <table className="projecao-table">
            <thead>
              <tr>
                <th>Indústria</th>
                <th>Total {anoBase}</th>
                <th>Média {anoBase}</th>
                <th>Manual</th>
                <th>Crescimento (%)</th>
                <th>Meta Mensal {anoProjecao}</th>
                <th>Projeção Anual {anoProjecao}</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => {
                const metaMensal = calcMetaMensal(row);
                const projecaoAnual = calcProjecaoAnual(row);

                return (
                  <tr key={row.id} className={row.manual ? 'manual-row' : ''}>
                    <td className="col-nome">{row.nome}</td>
                    <td className="col-num">{formatBRL(row.total2026)}</td>
                    <td className="col-num">{formatBRL(row.media2026)}</td>
                    <td className="col-toggle">
                      <button
                        type="button"
                        className={`toggle ${row.manual ? 'on' : ''}`}
                        onClick={() => updateRow(row.id, { manual: !row.manual })}
                        aria-label={`Manual ${row.nome}`}
                      >
                        <span />
                      </button>
                    </td>
                    <td className="col-growth">
                      {row.manual ? (
                        <span className="manual-badge">Manual</span>
                      ) : (
                        <div className="growth-input">
                          <span>+</span>
                          <input
                            type="number"
                            value={row.crescimento}
                            onChange={(e) =>
                              updateRow(row.id, { crescimento: Number(e.target.value) || 0 })
                            }
                          />
                          <span>%</span>
                        </div>
                      )}
                    </td>
                    <td className="col-proj">
                      {row.manual ? (
                        <input
                          type="text"
                          className="manual-value-input"
                          value={formatBRL(row.metaMensalManual)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            const value = Number(digits) / 100;
                            updateRow(row.id, { metaMensalManual: value });
                          }}
                        />
                      ) : (
                        formatBRL(metaMensal)
                      )}
                    </td>
                    <td className="col-proj">
                      {row.manual ? (
                        <input
                          type="text"
                          className="manual-value-input"
                          value={formatBRL(row.projecaoAnualManual)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            const value = Number(digits) / 100;
                            updateRow(row.id, { projecaoAnualManual: value });
                          }}
                        />
                      ) : (
                        formatBRL(projecaoAnual)
                      )}
                    </td>
                    <td className="col-actions">
                      <button type="button" className="action-btn" aria-label="Editar">
                        <IconEdit />
                      </button>
                      <button type="button" className="action-btn danger" aria-label="Excluir">
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td className="col-nome">TOTAL {tab === 'mapi' ? 'MA/PI' : 'PARÁ'}</td>
                <td className="col-num">{formatBRL(activeTotals.total2026)}</td>
                <td className="col-num">—</td>
                <td />
                <td className="col-growth">
                  <span className="total-badge">+20%</span>
                </td>
                <td className="col-proj">{formatBRL(activeTotals.metaMensal)}</td>
                <td className="col-proj">{formatBRL(activeTotals.projecaoAnual)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
