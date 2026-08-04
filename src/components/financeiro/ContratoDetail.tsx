import { useEffect, useMemo, useRef, useState } from 'react';
import {
  valorTotalFilial,
  type Contrato,
  type ContratoAnexo,
  type ContratoFilial,
  type ContratoStatus,
  type HistoricoEvento,
} from '../../data/financeiroData';
import { formatBRL } from '../../utils/currency';
import { parseValor } from '../../services/vendaService';
import {
  addContratoFiliais,
  deleteContratoAnexo,
  fetchContratoAnexos,
  fetchContratoFiliais,
  fetchContratoHistorico,
  fetchFiliaisCatalog,
  fetchRegionaisNomes,
  removeContratoFilial,
  updateContratoStatus,
  uploadContratoAnexo,
  type FilialCatalogItem,
} from '../../services/financeiroService';
import './ContratoDetail.css';

type DetailTab = 'filiais' | 'anexos' | 'historico';

const STATUS_OPTIONS: ContratoStatus[] = ['Rascunho', 'Ativo', 'Encerrado', 'Cancelado'];

type ContratoDetailProps = {
  contrato: Contrato;
  onBack: () => void;
  onUpdate: (contrato: Contrato) => void;
};

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconFactory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 21h18" />
      <path d="M5 21V10l5 3V10l5 3V7h4v14" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M14 10h5a1 1 0 0 1 1 1v10" />
      <path d="M8 8h2M8 12h2M8 16h2" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2v20" />
      <path d="M17 7c0-2-2-3-5-3s-5 1-5 3 2 3 5 3 5 1 5 3-2 3-5 3-5-1-5-3" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V5" />
      <path d="M7 10l5-5 5 5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export default function ContratoDetail({ contrato, onBack, onUpdate }: ContratoDetailProps) {
  const [tab, setTab] = useState<DetailTab>('filiais');
  const [filiais, setFiliais] = useState<ContratoFilial[]>([]);
  const [anexos, setAnexos] = useState<ContratoAnexo[]>([]);
  const [historico, setHistorico] = useState<HistoricoEvento[]>([]);
  const [status, setStatus] = useState<ContratoStatus>(contrato.status);
  const [loading, setLoading] = useState(true);
  const [toRemove, setToRemove] = useState<ContratoFilial | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const valorTotal = useMemo(
    () => filiais.reduce((acc, f) => acc + valorTotalFilial(f), 0),
    [filiais]
  );

  const reloadHistorico = async () => {
    setHistorico(await fetchContratoHistorico(contrato.id));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStatus(contrato.status);
    Promise.all([
      fetchContratoFiliais(contrato.id),
      fetchContratoAnexos(contrato.id),
      fetchContratoHistorico(contrato.id),
    ])
      .then(([nextFiliais, nextAnexos, nextHistorico]) => {
        if (!active) return;
        setFiliais(nextFiliais);
        setAnexos(nextAnexos);
        setHistorico(nextHistorico);
      })
      .catch((error) => {
        console.error(error);
        if (active) alert('Não foi possível carregar os detalhes do contrato.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contrato.id]);

  const handleStatusChange = async (next: ContratoStatus) => {
    if (next === status) return;
    const prev = status;
    try {
      const updated = await updateContratoStatus(contrato.id, next, prev);
      setStatus(updated.status);
      onUpdate({ ...updated, valorMensal: valorTotal || updated.valorMensal });
      await reloadHistorico();
    } catch (error) {
      console.error(error);
      alert('Não foi possível alterar o status do contrato.');
    }
  };

  const confirmRemoveFilial = async () => {
    if (!toRemove) return;
    try {
      await removeContratoFilial(contrato.id, toRemove.id, `${toRemove.codigo} - ${toRemove.nome}`);
      const nextFiliais = await fetchContratoFiliais(contrato.id);
      setFiliais(nextFiliais);
      const nextTotal = nextFiliais.reduce((acc, filial) => acc + valorTotalFilial(filial), 0);
      onUpdate({ ...contrato, valorMensal: nextTotal, status });
      await reloadHistorico();
      setToRemove(null);
    } catch (error) {
      console.error(error);
      alert('Não foi possível remover a filial.');
    }
  };

  const handleAddFiliais = async (
    selected: FilialCatalogItem[],
    valores: { valorHora: number; horas: number; visitasSem: number }
  ) => {
    const novas = selected.filter((item) => !filiais.some((f) => f.codigo === item.codigo));
    if (novas.length === 0) {
      setShowAdd(false);
      return;
    }
    try {
      await addContratoFiliais(
        contrato.id,
        novas.map((item) => ({
          lojaId: item.id,
          codigo: item.codigo,
          nome: item.nome,
          cidade: item.cidade,
          estado: item.estado,
          regional: item.regional,
          ...valores,
        }))
      );
      const nextFiliais = await fetchContratoFiliais(contrato.id);
      setFiliais(nextFiliais);
      const nextTotal = nextFiliais.reduce((acc, filial) => acc + valorTotalFilial(filial), 0);
      onUpdate({ ...contrato, valorMensal: nextTotal, status });
      await reloadHistorico();
      setShowAdd(false);
    } catch (error) {
      console.error(error);
      alert('Não foi possível adicionar as filiais.');
    }
  };

  const handleAttachPdf = async (file: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Selecione um arquivo PDF.');
      return;
    }
    try {
      await uploadContratoAnexo(contrato.id, file);
      setAnexos(await fetchContratoAnexos(contrato.id));
      await reloadHistorico();
    } catch (error) {
      console.error(error);
      alert('Não foi possível anexar o PDF.');
    }
  };

  const handleDeleteAnexo = async (anexoId: string) => {
    try {
      await deleteContratoAnexo(contrato.id, anexoId);
      setAnexos(await fetchContratoAnexos(contrato.id));
      await reloadHistorico();
    } catch (error) {
      console.error(error);
      alert('Não foi possível remover o anexo.');
    }
  };

  return (
    <div className="contrato-detail">
      <div className="cd-top">
        <button type="button" className="cd-back" onClick={onBack} aria-label="Voltar">
          <IconBack />
        </button>
        <div className="cd-top-main">
          <div className="cd-title-row">
            <h2>{contrato.titulo}</h2>
            <span className={`fin-status ${status.toLowerCase()}`}>{status}</span>
          </div>
          <p>
            {contrato.subtitulo} • {contrato.industria}
          </p>
        </div>
        <select
          className="cd-status-select"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as ContratoStatus)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="cd-kpi-grid">
        <article className="card cd-kpi">
          <div className="cd-kpi-icon">
            <IconFactory />
          </div>
          <div>
            <span>Indústria</span>
            <strong>{contrato.industria}</strong>
          </div>
        </article>
        <article className="card cd-kpi">
          <div className="cd-kpi-icon">
            <IconCalendar />
          </div>
          <div>
            <span>Fechamento</span>
            <strong>{contrato.fechamento}</strong>
          </div>
        </article>
        <article className="card cd-kpi">
          <div className="cd-kpi-icon">
            <IconBuilding />
          </div>
          <div>
            <span>Filiais</span>
            <strong>{filiais.length}</strong>
          </div>
        </article>
        <article className="card cd-kpi highlight">
          <div className="cd-kpi-icon soft">
            <IconDollar />
          </div>
          <div>
            <span>Valor Total</span>
            <strong>{formatBRL(valorTotal || contrato.valorMensal)}</strong>
          </div>
        </article>
      </div>

      <nav className="cd-tabs" aria-label="Detalhes do contrato">
        <button type="button" className={tab === 'filiais' ? 'active' : ''} onClick={() => setTab('filiais')}>
          <IconBuilding /> Filiais
        </button>
        <button type="button" className={tab === 'anexos' ? 'active' : ''} onClick={() => setTab('anexos')}>
          <IconDoc /> Anexos
        </button>
        <button type="button" className={tab === 'historico' ? 'active' : ''} onClick={() => setTab('historico')}>
          <IconClock /> Histórico
        </button>
      </nav>

      {tab === 'filiais' && (
        <section className="card cd-panel">
          <div className="cd-panel-top">
            <h3>Filiais do Contrato</h3>
            <button type="button" className="fin-btn-primary" onClick={() => setShowAdd(true)}>
              + Adicionar Filial
            </button>
          </div>
          <div className="fin-table-wrap">
            <table className="fin-table cd-filiais-table">
              <thead>
                <tr>
                  <th>Filial</th>
                  <th>Cidade</th>
                  <th>Valor Hora</th>
                  <th>Horas</th>
                  <th>Visitas Sem.</th>
                  <th>Visitas Mês</th>
                  <th>Valor Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filiais.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.codigo} - {f.nome}
                    </td>
                    <td>
                      {f.cidade}, {f.estado}
                    </td>
                    <td>{formatBRL(f.valorHora)}</td>
                    <td>{f.horas}</td>
                    <td>{f.visitasSem}</td>
                    <td>{f.visitasMes}</td>
                    <td>
                      <strong>{formatBRL(valorTotalFilial(f))}</strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cd-row-del"
                        aria-label="Remover filial"
                        onClick={() => setToRemove(f)}
                      >
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={8} className="fin-empty-row">
                      Carregando filiais...
                    </td>
                  </tr>
                )}
                {!loading && filiais.length === 0 && (
                  <tr>
                    <td colSpan={8} className="fin-empty-row">
                      Nenhuma filial vinculada a este contrato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'anexos' && (
        <section className="card cd-panel">
          <div className="cd-anexos-top">
            <button type="button" className="fin-btn-outline" onClick={() => fileRef.current?.click()}>
              <IconUpload /> Anexar PDF
            </button>
            <span>Apenas arquivos PDF são permitidos</span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                handleAttachPdf(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </div>

          {loading ? (
            <div className="cd-empty-anexo">
              <strong>Carregando anexos...</strong>
            </div>
          ) : anexos.length === 0 ? (
            <div className="cd-empty-anexo">
              <div className="cd-empty-icon">
                <IconDoc />
              </div>
              <strong>Nenhum arquivo anexado.</strong>
              <p>Clique em &quot;Anexar PDF&quot; para adicionar documentos.</p>
            </div>
          ) : (
            <ul className="cd-anexo-list">
              {anexos.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.nome}</strong>
                    <span>
                      {a.tamanho} • {a.data}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="cd-row-del"
                    aria-label="Remover anexo"
                    onClick={() => handleDeleteAnexo(a.id)}
                  >
                    <IconTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'historico' && (
        <section className="card cd-panel">
          <div className="cd-timeline">
            {loading && <p className="fin-empty-row">Carregando histórico...</p>}
            {historico.map((evento) => (
              <article key={evento.id} className={`cd-timeline-item ${evento.tipo}`}>
                <div className="cd-timeline-dot" aria-hidden />
                <div>
                  <strong>{evento.titulo}</strong>
                  <p>{evento.detalhe}</p>
                  <span>{evento.data}</span>
                </div>
              </article>
            ))}
            {!loading && historico.length === 0 && (
              <p className="fin-empty-row">Nenhum evento registrado.</p>
            )}
          </div>
        </section>
      )}

      {toRemove && (
        <div className="fin-modal-overlay" onClick={() => setToRemove(null)}>
          <div className="fin-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Remover filial do contrato?</h2>
            <p>
              A filial &quot;{toRemove.codigo} - {toRemove.nome}&quot; será removida deste contrato. Esta ação
              não pode ser desfeita.
            </p>
            <div className="fin-modal-actions">
              <button type="button" className="fin-btn-outline" onClick={() => setToRemove(null)}>
                Cancelar
              </button>
              <button type="button" className="fin-btn-danger" onClick={confirmRemoveFilial}>
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AddFiliaisModal
          jaVinculadas={new Set(filiais.map((f) => f.codigo))}
          onClose={() => setShowAdd(false)}
          onAdd={handleAddFiliais}
        />
      )}
    </div>
  );
}

function AddFiliaisModal({
  jaVinculadas,
  onClose,
  onAdd,
}: {
  jaVinculadas: Set<number>;
  onClose: () => void;
  onAdd: (
    selected: FilialCatalogItem[],
    valores: { valorHora: number; horas: number; visitasSem: number }
  ) => Promise<void>;
}) {
  const [valorHora, setValorHora] = useState('30,00');
  const [horas, setHoras] = useState('2');
  const [visitasSem, setVisitasSem] = useState('3');
  const [regional, setRegional] = useState('Todas as regionais');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [catalog, setCatalog] = useState<FilialCatalogItem[]>([]);
  const [regionais, setRegionais] = useState<string[]>(['Todas as regionais']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchFiliaisCatalog(), fetchRegionaisNomes()])
      .then(([lojas, nomes]) => {
        setCatalog(lojas.length > 0 ? lojas : []);
        setRegionais(['Todas as regionais', ...nomes.filter((nome) => nome !== 'Todas as regionais')]);
      })
      .catch((error) => {
        console.error(error);
        setCatalog([]);
        setRegionais(['Todas as regionais']);
      })
      .finally(() => setLoading(false));
  }, []);

  const disponiveis = useMemo(() => {
    return catalog.filter((f) => {
      if (jaVinculadas.has(f.codigo)) return false;
      if (regional !== 'Todas as regionais' && f.regional !== regional) return false;
      return true;
    });
  }, [catalog, jaVinculadas, regional]);

  const toggle = (codigo: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(disponiveis.map((f) => f.codigo)));
  const clearAll = () => setSelected(new Set());

  const handleAdd = async () => {
    const escolhidas = disponiveis.filter((f) => selected.has(f.codigo));
    await onAdd(escolhidas, {
      valorHora: parseValor(valorHora) || 0,
      horas: Number(horas) || 0,
      visitasSem: Number(visitasSem) || 0,
    });
  };

  return (
    <div className="fin-modal-overlay" onClick={onClose}>
      <div
        className="fin-modal fin-modal-form cd-add-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cd-add-header">
          <div>
            <h2>Adicionar Filiais ao Contrato</h2>
            <p>Selecione as filiais e defina os valores de atendimento.</p>
          </div>
          <button type="button" className="cd-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="cd-add-values">
          <label>
            <span>Valor Hora (R$)</span>
            <input value={valorHora} onChange={(e) => setValorHora(e.target.value)} />
          </label>
          <label>
            <span>Horas Atendimento</span>
            <input value={horas} onChange={(e) => setHoras(e.target.value)} />
          </label>
          <label>
            <span>Visitas Semanais</span>
            <input value={visitasSem} onChange={(e) => setVisitasSem(e.target.value)} />
          </label>
        </div>

        <div className="cd-add-tools">
          <select value={regional} onChange={(e) => setRegional(e.target.value)}>
            {regionais.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="cd-add-tools-actions">
            <button type="button" className="fin-btn-outline" onClick={selectAll}>
              Selecionar todas
            </button>
            <button type="button" className="fin-btn-outline" onClick={clearAll}>
              Limpar
            </button>
          </div>
        </div>

        <div className="cd-add-list">
          {loading && <p className="fin-empty-row">Carregando filiais...</p>}
          {disponiveis.map((f) => {
            const checked = selected.has(f.codigo);
            return (
              <button
                key={f.codigo}
                type="button"
                className={`cd-add-item ${checked ? 'selected' : ''}`}
                onClick={() => toggle(f.codigo)}
              >
                <span className={`cd-check ${checked ? 'on' : ''}`} aria-hidden />
                <span className="cd-add-item-icon">
                  <IconBuilding />
                </span>
                <span className="cd-add-item-text">
                  <strong>
                    {f.codigo} - {f.nome}
                  </strong>
                  <em>
                    {f.cidade}, {f.estado} • {f.codigo}
                  </em>
                </span>
              </button>
            );
          })}
          {!loading && disponiveis.length === 0 && (
            <p className="fin-empty-row">Nenhuma filial disponível.</p>
          )}
        </div>

        <div className="fin-modal-actions">
          <button type="button" className="fin-btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="fin-btn-primary"
            disabled={selected.size === 0}
            onClick={handleAdd}
          >
            Adicionar {selected.size} filiais
          </button>
        </div>
      </div>
    </div>
  );
}
