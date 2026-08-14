import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MetaIndustriaFormModal, {
  type MetaIndustriaFormValues,
} from '../components/admin/MetaIndustriaFormModal';
import ModalShell from '../components/colaboradores/ModalShell';
import AppIcon from '../components/icons/AppIcon';
import { useToast } from '../context/ToastContext';
import {
  ANOS_PROJECAO,
  calcMetaMensal,
  calcProjecaoAnual,
  sumTotals,
  type MetaIndustria,
} from '../data/projecaoMetasData';
import { fetchIndustrias } from '../services/industriaService';
import {
  deleteMeta,
  fetchMetas,
  fetchVendasRealizadoAno,
  sumRealizado,
  upsertMeta,
} from '../services/metasService';
import { formatBRL } from '../utils/currency';
import { industriasMatch } from '../utils/vendasDomain';
import './Administrador.css';
import './admin/AdminFiliais.css';
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
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function isUuid(id: string) {
  return /^[0-9a-f-]{36}$/i.test(id);
}

function parseMoney(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return Number(digits) / 100;
}

type RegiaoTab = 'mapi' | 'pa';

type ProjecaoMetasProps = {
  /** Quando true, mostra voltar ao Administrador e título "Metas". */
  adminMode?: boolean;
};

export default function ProjecaoMetas({ adminMode = false }: ProjecaoMetasProps) {
  const { showToast } = useToast();
  const [anoBase, setAnoBase] = useState(String(new Date().getFullYear() - 1));
  const [tab, setTab] = useState<RegiaoTab>('mapi');
  const [mapiRows, setMapiRows] = useState<MetaIndustria[]>([]);
  const [paRows, setPaRows] = useState<MetaIndustria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<MetaIndustria | null>(null);
  const [deleting, setDeleting] = useState<MetaIndustria | null>(null);
  const [removing, setRemoving] = useState(false);

  const anoProjecao = String(Number(anoBase) + 1);
  const regiaoLabel = tab === 'mapi' ? 'MA/PI' : 'Pará';
  const regiaoDb = tab === 'mapi' ? ('MA/PI' as const) : ('PA' as const);

  const loadMetas = useCallback(async () => {
    setLoading(true);
    try {
      const [industrias, metas, vendasAno] = await Promise.all([
        fetchIndustrias(),
        fetchMetas(Number(anoProjecao)),
        fetchVendasRealizadoAno(Number(anoBase)),
      ]);

      const nomesFromVendas = Array.from(
        new Set(
          vendasAno
            .map((v) => (v.industria ?? '').trim())
            .filter(Boolean),
        ),
      );

      const buildForRegiao = async (
        regiao: 'MA/PI' | 'PA',
        prefix: string,
      ): Promise<MetaIndustria[]> => {
        const regiaoMetas = metas.filter((m) => m.regiao === regiao);

        if (regiaoMetas.length === 0) {
          const nomes: string[] = [];
          for (const ind of industrias) {
            nomes.push(ind.Nome);
          }
          for (const nomeVenda of nomesFromVendas) {
            const exists = nomes.some((n) => industriasMatch(n, nomeVenda));
            if (!exists) nomes.push(nomeVenda);
          }

          return nomes.map((nome, index) => {
            const realizado = sumRealizado(vendasAno, regiao, nome);
            return {
              id: `${prefix}-${index}`,
              nome,
              total2026: realizado,
              media2026: realizado / 12,
              manual: false,
              crescimento: 20,
              metaMensalManual: 0,
              projecaoAnualManual: 0,
            };
          });
        }

        return regiaoMetas.map((existing) => {
          const realizado = sumRealizado(vendasAno, regiao, existing.industria);
          return {
            id: existing.id,
            nome: existing.industria,
            total2026: realizado,
            media2026: realizado / 12,
            manual: existing.modo_manual,
            crescimento: existing.crescimento_percentual ?? 20,
            metaMensalManual: existing.meta_mensal_manual ?? 0,
            projecaoAnualManual: existing.meta_anual_manual ?? 0,
          };
        });
      };

      const [mapi, pa] = await Promise.all([
        buildForRegiao('MA/PI', 'mapi'),
        buildForRegiao('PA', 'pa'),
      ]);
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
    [mapiTotals, paTotals],
  );

  const activeTotals = sumTotals(activeRows);

  const averageGrowth = useMemo(() => {
    const calcRows = activeRows.filter((r) => !r.manual);
    if (calcRows.length === 0) return null;
    const avg = calcRows.reduce((acc, r) => acc + r.crescimento, 0) / calcRows.length;
    return Math.round(avg);
  }, [activeRows]);

  const hasManual = mapiRows.some((r) => r.manual) || paRows.some((r) => r.manual);

  const updateRow = (id: string, patch: Partial<MetaIndustria>) => {
    setActiveRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleToggleManual = (row: MetaIndustria) => {
    if (row.manual) {
      updateRow(row.id, { manual: false });
      return;
    }
    const mensal = calcMetaMensal({ ...row, manual: false });
    updateRow(row.id, {
      manual: true,
      metaMensalManual: mensal,
      projecaoAnualManual: mensal * 12,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allRows = [
        ...mapiRows.map((r) => ({ row: r, regiao: 'MA/PI' as const })),
        ...paRows.map((r) => ({ row: r, regiao: 'PA' as const })),
      ];

      for (const { row, regiao } of allRows) {
        await upsertMeta({
          ...(isUuid(row.id) ? { id: row.id } : {}),
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
      await loadMetas();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar metas.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (values: MetaIndustriaFormValues) => {
    const exists = activeRows.some((r) => r.nome.toUpperCase() === values.nome.toUpperCase());
    if (exists) {
      showToast('Essa indústria já está na lista desta região.', 'error');
      return;
    }

    const newRow: MetaIndustria = {
      id: `new-${tab}-${Date.now()}`,
      nome: values.nome,
      total2026: 0,
      media2026: 0,
      manual: true,
      crescimento: 20,
      metaMensalManual: values.metaMensal,
      projecaoAnualManual: values.metaAnual,
    };
    setActiveRows((rows) => [...rows, newRow]);
    showToast('Indústria adicionada. Clique em Salvar Metas para gravar.', 'success');
  };

  const handleEditSubmit = (values: MetaIndustriaFormValues) => {
    if (!editing) return;
    const duplicate = activeRows.some(
      (r) => r.id !== editing.id && r.nome.toUpperCase() === values.nome.toUpperCase(),
    );
    if (duplicate) {
      showToast('Já existe outra indústria com esse nome nesta região.', 'error');
      return;
    }
    updateRow(editing.id, {
      nome: values.nome,
      manual: true,
      metaMensalManual: values.metaMensal,
      projecaoAnualManual: values.metaAnual,
    });
    showToast('Indústria atualizada. Clique em Salvar Metas para gravar.', 'success');
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      if (isUuid(deleting.id)) {
        await deleteMeta(deleting.id);
      }
      setActiveRows((rows) => rows.filter((r) => r.id !== deleting.id));
      showToast('Indústria removida da projeção.', 'success');
      setDeleting(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="projecao-page">
        {adminMode && (
          <Link to="/administrador" className="admin-section-back">
            <span aria-hidden>←</span>
            Voltar ao Administrador
          </Link>
        )}
        <p style={{ padding: 24 }}>Carregando metas...</p>
      </div>
    );
  }

  return (
    <div className="projecao-page">
      {adminMode && (
        <Link to="/administrador" className="admin-section-back">
          <span aria-hidden>←</span>
          Voltar ao Administrador
        </Link>
      )}

      <header className="projecao-header">
        <div>
          <h1 className="page-title">{adminMode ? 'Metas' : 'Projeção de Metas'}</h1>
          <p className="projecao-subtitle">
            Defina as metas de crescimento por indústria e região
          </p>
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
            {saving ? 'Salvando...' : 'Salvar Metas'}
          </button>
        </div>
      </header>

      {hasManual && (
        <div className="projecao-alert">
          <AppIcon name="warning" size={18} />
          <p>
            <strong>Atenção:</strong> Algumas indústrias estão usando metas manuais. Quando o modo
            manual está ativo, o cálculo baseado no ano anterior é ignorado. Você só pode usar um
            método por vez (calculado OU manual).
          </p>
        </div>
      )}

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
            <p>
              Baseado no desempenho de {anoBase} • Ative &quot;Manual&quot; para definir metas
              diretamente
            </p>
          </div>
          <button type="button" className="projecao-btn-outline" onClick={() => setShowAdd(true)}>
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
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                    Nenhuma indústria nesta região. Use &quot;Adicionar Indústria&quot;.
                  </td>
                </tr>
              ) : (
                activeRows.map((row) => {
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
                          onClick={() => handleToggleManual(row)}
                          aria-label={`Manual ${row.nome}`}
                        >
                          <span />
                        </button>
                      </td>
                      <td className="col-growth">
                        {row.manual ? (
                          <span className="manual-dash">—</span>
                        ) : (
                          <div className="growth-input">
                            <button
                              type="button"
                              className="growth-step"
                              onClick={() =>
                                updateRow(row.id, {
                                  crescimento: Math.max(0, row.crescimento - 1),
                                })
                              }
                              aria-label="Diminuir"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              value={row.crescimento}
                              onChange={(e) =>
                                updateRow(row.id, {
                                  crescimento: Number(e.target.value) || 0,
                                })
                              }
                            />
                            <button
                              type="button"
                              className="growth-step"
                              onClick={() =>
                                updateRow(row.id, { crescimento: row.crescimento + 1 })
                              }
                              aria-label="Aumentar"
                            >
                              +
                            </button>
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
                              const value = parseMoney(e.target.value);
                              updateRow(row.id, {
                                metaMensalManual: value,
                                projecaoAnualManual: value * 12,
                              });
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
                              const value = parseMoney(e.target.value);
                              updateRow(row.id, {
                                projecaoAnualManual: value,
                                metaMensalManual: value / 12,
                              });
                            }}
                          />
                        ) : (
                          formatBRL(projecaoAnual)
                        )}
                      </td>
                      <td className="col-actions">
                        <button
                          type="button"
                          className="action-btn"
                          aria-label="Editar"
                          onClick={() => setEditing(row)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="action-btn danger"
                          aria-label="Excluir"
                          onClick={() => setDeleting(row)}
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
              {activeRows.length > 0 && (
                <tr className="total-row">
                  <td className="col-nome">TOTAL {tab === 'mapi' ? 'MA/PI' : 'PARÁ'}</td>
                  <td className="col-num">{formatBRL(activeTotals.total2026)}</td>
                  <td className="col-num">—</td>
                  <td />
                  <td className="col-growth">
                    {averageGrowth != null ? (
                      <span className="total-badge">+{averageGrowth}%</span>
                    ) : (
                      <span className="manual-dash">—</span>
                    )}
                  </td>
                  <td className="col-proj">{formatBRL(activeTotals.metaMensal)}</td>
                  <td className="col-proj">{formatBRL(activeTotals.projecaoAnual)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd && (
        <MetaIndustriaFormModal
          mode="create"
          regiaoLabel={regiaoLabel}
          onClose={() => setShowAdd(false)}
          onSubmit={handleAdd}
        />
      )}

      {editing && (
        <MetaIndustriaFormModal
          mode="edit"
          regiaoLabel={regiaoLabel}
          initial={{
            nome: editing.nome,
            metaMensal: editing.manual
              ? editing.metaMensalManual
              : calcMetaMensal(editing),
            metaAnual: editing.manual
              ? editing.projecaoAnualManual
              : calcProjecaoAnual(editing),
          }}
          onClose={() => setEditing(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {deleting && (
        <ModalShell onClose={() => setDeleting(null)} className="filiais-modal filiais-confirm-modal">
          <div className="filiais-modal-header">
            <div>
              <h2>Excluir indústria da projeção?</h2>
              <p>
                Remover <strong>{deleting.nome}</strong> da região <strong>{regiaoDb}</strong> em{' '}
                {anoProjecao}?
              </p>
            </div>
            <button
              type="button"
              className="filiais-modal-close"
              onClick={() => setDeleting(null)}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          <div className="filiais-modal-actions">
            <button
              type="button"
              className="filiais-btn-outline"
              onClick={() => setDeleting(null)}
              disabled={removing}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="filiais-btn-danger"
              onClick={handleConfirmDelete}
              disabled={removing}
            >
              {removing ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
