import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isContratoIndustria,
  isContratoLojas,
  valorTotalFilial,
  type ComissaoBase,
  type Contrato,
  type ContratoFilial,
} from '../../data/financeiroData';
import { formatBRL } from '../../utils/currency';
import { useToast } from '../../context/ToastContext';
import {
  addContratoFiliais,
  concluirComposicaoMes,
  copyFiliaisMesAnterior,
  fetchCategoriasVendaIndustria,
  fetchContratoComissaoMes,
  fetchContratoFiliais,
  fetchFiliaisCatalog,
  fetchRegionaisNomes,
  isComposicaoMesCompleta,
  previewVendasContratoIndustria,
  removeContratoFilial,
  updateContratoFilialValores,
  type FilialCatalogItem,
} from '../../services/financeiroService';

const MESES = [
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

type ComposicaoTabProps = {
  contratos: Contrato[];
  focusContratoId?: string | null;
  onDone: () => Promise<void> | void;
};

export default function ComposicaoTab({ contratos, focusContratoId, onDone }: ComposicaoTabProps) {
  const { showToast } = useToast();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [selectedId, setSelectedId] = useState<string | null>(focusContratoId ?? null);
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});
  const [loadingList, setLoadingList] = useState(true);

  const elegiveis = useMemo(
    () =>
      contratos.filter(
        (c) =>
          c.status !== 'Cancelado' &&
          c.status !== 'Encerrado' &&
          (isContratoLojas(c.tipo) || isContratoIndustria(c.tipo)),
      ),
    [contratos],
  );

  const selected = elegiveis.find((c) => c.id === selectedId) ?? null;

  const refreshStatus = useCallback(async () => {
    setLoadingList(true);
    try {
      const entries = await Promise.all(
        elegiveis.map(async (c) => [c.id, await isComposicaoMesCompleta(c, ano, mes)] as const),
      );
      setStatusMap(Object.fromEntries(entries));
    } catch (error) {
      console.error(error);
      showToast('Não foi possível carregar o status das composições.', 'error');
    } finally {
      setLoadingList(false);
    }
  }, [elegiveis, ano, mes, showToast]);

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, [refreshStatus]);

  useEffect(() => {
    if (focusContratoId) setSelectedId(focusContratoId);
  }, [focusContratoId]);

  return (
    <div className="fin-composicao">
      <div className="fin-composicao-toolbar card">
        <div>
          <h2>Composição mensal</h2>
          <p>
            Monte lojas (Cobertura / Ação) ou comissão sobre vendas (Indústria). Ao concluir, o
            contrato vai para <strong>Aguardando Autorização</strong> no Kanban.
          </p>
        </div>
        <div className="fin-composicao-period">
          <label>
            Mês
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((nome, idx) => (
                <option key={nome} value={idx + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ano
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {[ano - 1, ano, ano + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="fin-composicao-layout">
        <aside className="card fin-composicao-list">
          <h3>Contratos</h3>
          {loadingList && <p className="fin-muted">Carregando...</p>}
          {!loadingList && elegiveis.length === 0 && (
            <p className="fin-muted">Nenhum contrato elegível.</p>
          )}
          <ul>
            {elegiveis.map((c) => {
              const ok = statusMap[c.id];
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={selectedId === c.id ? 'active' : ''}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <strong>{c.titulo}</strong>
                    <span>{c.industria}</span>
                    <em className={ok ? 'ok' : 'pendente'}>{ok ? 'Concluído' : 'Pendente'}</em>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="card fin-composicao-editor">
          {!selected && <p className="fin-muted">Selecione um contrato para configurar o mês.</p>}
          {selected && isContratoLojas(selected.tipo) && (
            <LojasEditor
              contrato={selected}
              ano={ano}
              mes={mes}
              onDone={async () => {
                await onDone();
                await refreshStatus();
              }}
            />
          )}
          {selected && isContratoIndustria(selected.tipo) && (
            <IndustriaEditor
              contrato={selected}
              ano={ano}
              mes={mes}
              onDone={async () => {
                await onDone();
                await refreshStatus();
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function LojasEditor({
  contrato,
  ano,
  mes,
  onDone,
}: {
  contrato: Contrato;
  ano: number;
  mes: number;
  onDone: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [filiais, setFiliais] = useState<ContratoFilial[]>([]);
  const [modelo, setModelo] = useState<'hora_visita' | 'valor_fixo'>(
    contrato.modeloCobranca === 'valor_fixo' ? 'valor_fixo' : 'hora_visita',
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchContratoFiliais(contrato.id, ano, mes);
      setFiliais(rows);
      if (rows[0]?.modeloCobranca) setModelo(rows[0].modeloCobranca);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar lojas do mês.', 'error');
    } finally {
      setLoading(false);
    }
  }, [contrato.id, ano, mes, showToast]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const total = filiais.reduce(
    (acc, f) => acc + valorTotalFilial({ ...f, modeloCobranca: modelo }),
    0,
  );

  const applyModelo = async (next: 'hora_visita' | 'valor_fixo') => {
    setModelo(next);
    try {
      await Promise.all(
        filiais.map((f) => updateContratoFilialValores(f.id, { modeloCobranca: next })),
      );
      await load();
    } catch (error) {
      console.error(error);
      showToast('Não foi possível atualizar o modelo de cobrança.', 'error');
    }
  };

  return (
    <div className="fin-comp-editor">
      <header>
        <div>
          <h3>{contrato.titulo}</h3>
          <p>
            {contrato.tipo} • {contrato.industria} • {MESES[mes - 1]}/{ano}
          </p>
        </div>
        <strong>{formatBRL(total)}</strong>
      </header>

      <div className="fin-comp-actions">
        <label>
          Modelo de cobrança
          <select
            value={modelo}
            onChange={(e) => applyModelo(e.target.value as 'hora_visita' | 'valor_fixo')}
          >
            <option value="hora_visita">Valor hora × horas × visitas</option>
            <option value="valor_fixo">Valor fixo por loja</option>
          </select>
        </label>
        <button
          type="button"
          className="fin-btn ghost"
          onClick={async () => {
            try {
              await copyFiliaisMesAnterior(contrato.id, ano, mes);
              showToast('Lojas copiadas do mês anterior.', 'success');
              await load();
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Falha ao copiar.', 'error');
            }
          }}
        >
          Copiar mês anterior
        </button>
        <button type="button" className="fin-btn" onClick={() => setShowAdd(true)}>
          + Lojas
        </button>
      </div>

      {loading ? (
        <p className="fin-muted">Carregando lojas...</p>
      ) : (
        <div className="fin-table-wrap">
          <table className="fin-table compact">
            <thead>
              <tr>
                <th>Loja</th>
                <th>Cidade</th>
                {modelo === 'hora_visita' ? (
                  <>
                    <th>R$/h</th>
                    <th>Horas</th>
                    <th>Vis./sem</th>
                  </>
                ) : (
                  <th>Valor fixo</th>
                )}
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filiais.map((f) => (
                <tr key={f.id}>
                  <td>{f.nome}</td>
                  <td>
                    {f.cidade}/{f.estado}
                  </td>
                  {modelo === 'hora_visita' ? (
                    <>
                      <td>
                        <input
                          type="number"
                          defaultValue={f.valorHora}
                          onBlur={async (e) => {
                            await updateContratoFilialValores(f.id, {
                              valorHora: Number(e.target.value) || 0,
                              modeloCobranca: modelo,
                            });
                            await load();
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          defaultValue={f.horas}
                          onBlur={async (e) => {
                            await updateContratoFilialValores(f.id, {
                              horas: Number(e.target.value) || 0,
                              modeloCobranca: modelo,
                            });
                            await load();
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          defaultValue={f.visitasSem}
                          onBlur={async (e) => {
                            await updateContratoFilialValores(f.id, {
                              visitasSem: Number(e.target.value) || 0,
                              modeloCobranca: modelo,
                            });
                            await load();
                          }}
                        />
                      </td>
                    </>
                  ) : (
                    <td>
                      <input
                        type="number"
                        defaultValue={f.valorFixo}
                        onBlur={async (e) => {
                          await updateContratoFilialValores(f.id, {
                            valorFixo: Number(e.target.value) || 0,
                            modeloCobranca: modelo,
                          });
                          await load();
                        }}
                      />
                    </td>
                  )}
                  <td>{formatBRL(valorTotalFilial({ ...f, modeloCobranca: modelo }))}</td>
                  <td>
                    <button
                      type="button"
                      className="fin-icon-btn danger"
                      onClick={async () => {
                        await removeContratoFilial(contrato.id, f.id, f.nome);
                        await load();
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {filiais.length === 0 && (
                <tr>
                  <td colSpan={7} className="fin-muted">
                    Nenhuma loja neste mês. Adicione ou copie do mês anterior.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <footer className="fin-comp-footer">
        <button
          type="button"
          className="fin-btn primary"
          disabled={saving || filiais.length === 0}
          onClick={async () => {
            setSaving(true);
            try {
              await concluirComposicaoMes({
                contrato,
                ano,
                mes,
                modeloCobranca: modelo,
              });
              showToast('Composição concluída. Kanban: Aguardando Autorização.', 'success');
              await onDone();
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Falha ao concluir.', 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Concluindo...' : 'Concluir mês → Aguardando Autorização'}
        </button>
      </footer>

      {showAdd && (
        <AddLojasMesModal
          contratoId={contrato.id}
          ano={ano}
          mes={mes}
          modelo={modelo}
          onClose={() => setShowAdd(false)}
          onAdded={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function IndustriaEditor({
  contrato,
  ano,
  mes,
  onDone,
}: {
  contrato: Contrato;
  ano: number;
  mes: number;
  onDone: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [percentual, setPercentual] = useState(contrato.comissaoPercentual || 2);
  const [base, setBase] = useState<ComissaoBase>(contrato.comissaoBase || 'venda_total');
  const [categoria, setCategoria] = useState(contrato.comissaoCategoria || '');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [preview, setPreview] = useState({ valorVenda: 0, valorComissao: 0, qtdPedidos: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategoriasVendaIndustria(contrato.industria)
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, [contrato.industria]);

  useEffect(() => {
    fetchContratoComissaoMes(contrato.id, ano, mes)
      .then((row) => {
        if (!row) return;
        setPercentual(row.percentual);
        setBase(row.base);
        setCategoria(row.categoria ?? '');
      })
      .catch(() => undefined);
  }, [contrato.id, ano, mes]);

  useEffect(() => {
    previewVendasContratoIndustria({
      industria: contrato.industria,
      ano,
      mes,
      base,
      categoria,
      percentual,
    })
      .then(setPreview)
      .catch(() => setPreview({ valorVenda: 0, valorComissao: 0, qtdPedidos: 0 }));
  }, [contrato.industria, ano, mes, base, categoria, percentual]);

  return (
    <div className="fin-comp-editor">
      <header>
        <div>
          <h3>{contrato.titulo}</h3>
          <p>
            {contrato.tipo} • {contrato.industria} • {MESES[mes - 1]}/{ano}
          </p>
        </div>
        <strong>{formatBRL(preview.valorComissao)}</strong>
      </header>

      <div className="fin-comp-industria-grid">
        <label>
          Base da comissão
          <select value={base} onChange={(e) => setBase(e.target.value as ComissaoBase)}>
            <option value="venda_total">Venda total da indústria no mês</option>
            <option value="venda_categoria">Venda por categoria</option>
          </select>
        </label>
        {base === 'venda_categoria' && (
          <label>
            Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Selecionar...</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Percentual (%)
          <input
            type="number"
            step="0.01"
            value={percentual}
            onChange={(e) => setPercentual(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className="fin-comp-preview">
        <article>
          <span>Vendas base</span>
          <strong>{formatBRL(preview.valorVenda)}</strong>
        </article>
        <article>
          <span>Pedidos</span>
          <strong>{preview.qtdPedidos}</strong>
        </article>
        <article>
          <span>Comissão estimada</span>
          <strong>{formatBRL(preview.valorComissao)}</strong>
        </article>
      </div>

      <footer className="fin-comp-footer">
        <button
          type="button"
          className="fin-btn primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await concluirComposicaoMes({
                contrato,
                ano,
                mes,
                percentual,
                comissaoBase: base,
                categoria: categoria || null,
                modeloCobranca: 'comissao_industria',
              });
              showToast('Comissão do mês concluída. Kanban: Aguardando Autorização.', 'success');
              await onDone();
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Falha ao concluir.', 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Concluindo...' : 'Concluir mês → Aguardando Autorização'}
        </button>
      </footer>
    </div>
  );
}

function AddLojasMesModal({
  contratoId,
  ano,
  mes,
  modelo,
  onClose,
  onAdded,
}: {
  contratoId: string;
  ano: number;
  mes: number;
  modelo: 'hora_visita' | 'valor_fixo';
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState<FilialCatalogItem[]>([]);
  const [regionais, setRegionais] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [regional, setRegional] = useState('Todas');
  const [valorHora, setValorHora] = useState(30);
  const [horas, setHoras] = useState(2);
  const [visitasSem, setVisitasSem] = useState(3);
  const [valorFixo, setValorFixo] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchFiliaisCatalog(), fetchRegionaisNomes()])
      .then(([lojas, regs]) => {
        setCatalog(lojas);
        setRegionais(regs);
      })
      .catch(() => showToast('Erro ao carregar lojas.', 'error'));
  }, [showToast]);

  const filtered = catalog.filter((l) => regional === 'Todas' || l.regional === regional);

  return (
    <div className="fin-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="fin-modal card" role="dialog" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Adicionar lojas · {MESES[mes - 1]}/{ano}</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="fin-comp-actions">
          <label>
            Regional
            <select value={regional} onChange={(e) => setRegional(e.target.value)}>
              <option value="Todas">Todas</option>
              {regionais.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {modelo === 'hora_visita' ? (
            <>
              <label>
                R$/h
                <input type="number" value={valorHora} onChange={(e) => setValorHora(Number(e.target.value) || 0)} />
              </label>
              <label>
                Horas
                <input type="number" value={horas} onChange={(e) => setHoras(Number(e.target.value) || 0)} />
              </label>
              <label>
                Vis./sem
                <input
                  type="number"
                  value={visitasSem}
                  onChange={(e) => setVisitasSem(Number(e.target.value) || 0)}
                />
              </label>
            </>
          ) : (
            <label>
              Valor fixo
              <input type="number" value={valorFixo} onChange={(e) => setValorFixo(Number(e.target.value) || 0)} />
            </label>
          )}
        </div>
        <div className="fin-lojas-pick">
          {filtered.map((loja) => (
            <label key={loja.id} className="fin-loja-chip">
              <input
                type="checkbox"
                checked={selected.has(loja.id)}
                onChange={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(loja.id)) next.delete(loja.id);
                    else next.add(loja.id);
                    return next;
                  });
                }}
              />
              <span>
                {loja.codigo} · {loja.nome}
              </span>
            </label>
          ))}
        </div>
        <footer>
          <button type="button" className="fin-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="fin-btn primary"
            disabled={saving || selected.size === 0}
            onClick={async () => {
              setSaving(true);
              try {
                const picked = catalog.filter((l) => selected.has(l.id));
                await addContratoFiliais(
                  contratoId,
                  picked.map((l) => ({
                    lojaId: l.id,
                    codigo: l.codigo,
                    nome: l.nome,
                    cidade: l.cidade,
                    estado: l.estado,
                    regional: l.regional,
                    valorHora,
                    horas,
                    visitasSem,
                    valorFixo,
                    modeloCobranca: modelo,
                  })),
                  ano,
                  mes,
                );
                showToast(`${picked.length} loja(s) adicionada(s).`, 'success');
                await onAdded();
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Erro ao adicionar.', 'error');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
