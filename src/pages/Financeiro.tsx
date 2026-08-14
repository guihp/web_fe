import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BackToPortal from '../components/layout/BackToPortal';
import ContratoDetail from '../components/financeiro/ContratoDetail';
import ComposicaoTab from '../components/financeiro/ComposicaoTab';
import Comissao from './Comissao';
import {
  type ComparativoMes,
  type Contrato,
  type ContratoStatus,
  type KanbanTask,
  type ReceitaIndustria,
  type ReceitaMes,
} from '../data/financeiroData';
import { formatBRL } from '../utils/currency';
import { parseValor } from '../services/vendaService';
import { fetchIndustriaNomes } from '../services/industriaService';
import {
  advanceKanbanTask,
  createContrato,
  deleteContrato,
  fetchComparativoMeses,
  fetchContratos,
  fetchFinanceiroKpis,
  fetchKanbanTasks,
  fetchReceitaPorIndustria,
  fetchReceitaPorMes,
  generateKanbanMesAtual,
  moveKanbanTask,
  updateContrato,
  type ContratoCreateInput,
  type FinanceiroKpis,
} from '../services/financeiroService';
import { useToast } from '../context/ToastContext';
import './Financeiro.css';

type Tab = 'contratos' | 'composicao' | 'relatorios' | 'kanban' | 'comissao';

const VALID_TABS: Tab[] = ['contratos', 'composicao', 'relatorios', 'kanban', 'comissao'];

const TIPOS = ['Todos os tipos', 'Contrato de Indústria', 'Cobertura de Merchandising', 'Ação de Vendas'];
const STATUS_OPTS = ['Todos', 'Rascunho', 'Ativo', 'Encerrado', 'Cancelado'];
const TIPO_FORM = TIPOS.filter((t) => t !== 'Todos os tipos');
const STATUS_FORM = STATUS_OPTS.filter((s) => s !== 'Todos') as ContratoStatus[];

function toDateInput(brDate: string) {
  const [dd, mm, yyyy] = brDate.split('/');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateInput(isoDate: string) {
  if (!isoDate) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function IconKanban() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="10" rx="1" />
      <rect x="17" y="4" width="5" height="13" rx="1" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M3 7l2.5-3h13L21 7" />
      <path d="M16 13h2" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 17l6-6 4 4 8-10" />
      <path d="M14 5h7v7" />
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

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M14 10h5a1 1 0 0 1 1 1v10" />
      <path d="M8 8h2M8 12h2M8 16h2" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconSync() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a9 9 0 0 1-15.5 6.3" />
      <path d="M3 12a9 9 0 0 1 15.5-6.3" />
      <path d="M21 4v6h-6M3 20v-6h6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function StackedMonthChart({ data }: { data: ReceitaMes[] }) {
  const max = Math.max(...data.map((d) => d.contratos + d.comissoes), 1);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="fin-month-chart">
      <div className="fin-month-y">
        {[120000, 90000, 60000, 30000, 0].map((v) => (
          <span key={v}>{formatBRL(v)}</span>
        ))}
      </div>
      <div className="fin-month-bars">
        {data.map((item) => {
          const total = item.contratos + item.comissoes;
          const h = (total / max) * 100;
          const cH = total > 0 ? (item.contratos / total) * h : 0;
          const mH = total > 0 ? (item.comissoes / total) * h : 0;
          return (
            <div
              key={item.mes}
              className="fin-month-col"
              onMouseEnter={() => setHover(item.mes)}
              onMouseLeave={() => setHover(null)}
            >
              {total > 0 && <span className="fin-month-label">{formatBRL(total)}</span>}
              <div className="fin-month-shell">
                {item.comissoes > 0 && (
                  <div className="fin-month-seg comissao" style={{ height: `${mH}%` }} />
                )}
                <div className="fin-month-seg contrato" style={{ height: `${Math.max(cH, total > 0 ? 4 : 0)}%` }} />
              </div>
              <span className="fin-month-mes">{item.mes}</span>
              {hover === item.mes && (
                <div className="fin-month-tooltip">
                  <strong>{item.mes}</strong>
                  <span className="contrato-txt">Contratos: {formatBRL(item.contratos)}</span>
                  <span className="comissao-txt">Comissões: {formatBRL(item.comissoes)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IndustriaChart({ data }: { data: ReceitaIndustria[] }) {
  const max = Math.max(...data.map((d) => d.contratos + d.comissoes), 1);

  return (
    <div className="fin-industria-chart">
      {data.map((item) => {
        const total = item.contratos + item.comissoes;
        const width = (total / max) * 100;
        const cW = total > 0 ? (item.contratos / total) * width : 0;
        const mW = total > 0 ? (item.comissoes / total) * width : 0;
        return (
          <div key={item.nome} className="fin-industria-row">
            <span className="fin-industria-name">{item.nome}</span>
            <div className="fin-industria-track">
              <div className="fin-industria-fill contrato" style={{ width: `${cW}%` }} />
              {mW > 0 && <div className="fin-industria-fill comissao" style={{ width: `${mW}%` }} />}
              <span className="fin-industria-value">{formatBRL(total)}</span>
            </div>
          </div>
        );
      })}
      <div className="fin-chart-legend">
        <span>
          <i className="contrato" /> Contratos
        </span>
        <span>
          <i className="comissao" /> Comissões
        </span>
      </div>
    </div>
  );
}

function ContratosTab({
  contratos,
  onDelete,
  onSave,
  onView,
  onCreate,
}: {
  contratos: Contrato[];
  onDelete: (id: string) => Promise<void>;
  onSave: (contrato: Contrato) => Promise<void>;
  onView: (contrato: Contrato) => void;
  onCreate: (input: ContratoCreateInput) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [status, setStatus] = useState(STATUS_OPTS[0]);
  const [toDelete, setToDelete] = useState<Contrato | null>(null);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    subtitulo: '',
    industria: '',
    fechamento: '',
    valorMensal: '',
    status: 'Ativo' as ContratoStatus,
    tipo: 'Cobertura de Merchandising',
  });
  const [createForm, setCreateForm] = useState({
    tipo: 'Cobertura de Merchandising',
    industria: '',
    titulo: '',
    descricao: '',
    fechamento: '',
    inicio: '',
    termino: '',
    diaInicioFat: '1',
    diaFimFat: '28',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [industrias, setIndustrias] = useState<string[]>([]);

  useEffect(() => {
    fetchIndustriaNomes()
      .then(setIndustrias)
      .catch(() => setIndustrias([]));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contratos.filter((c) => {
      if (tipo !== 'Todos os tipos' && c.tipo !== tipo) return false;
      if (status !== 'Todos' && c.status !== status) return false;
      if (!term) return true;
      return (
        c.titulo.toLowerCase().includes(term) ||
        c.industria.toLowerCase().includes(term) ||
        c.subtitulo.toLowerCase().includes(term)
      );
    });
  }, [contratos, search, tipo, status]);

  const openEdit = (contrato: Contrato) => {
    setEditing(contrato);
    setFormError(null);
    setForm({
      titulo: contrato.titulo,
      subtitulo: contrato.subtitulo,
      industria: contrato.industria,
      fechamento: toDateInput(contrato.fechamento),
      valorMensal: String(contrato.valorMensal).replace('.', ','),
      status: contrato.status,
      tipo: contrato.tipo,
    });
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await onDelete(toDelete.id);
      setToDelete(null);
    } catch {
      // The parent displays the persistence error.
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.titulo.trim() || !form.industria.trim() || !form.fechamento) {
      setFormError('Preencha título, indústria e data de fechamento.');
      return;
    }

    try {
      await onSave({
        ...editing,
        titulo: form.titulo.trim(),
        subtitulo: form.subtitulo.trim() || form.titulo.trim(),
        industria: form.industria.trim(),
        fechamento: fromDateInput(form.fechamento),
        valorMensal: parseValor(form.valorMensal),
        status: form.status,
        tipo: form.tipo,
      });
      setEditing(null);
    } catch {
      // The parent displays the persistence error.
    }
  };

  const openCreate = () => {
    setCreateError(null);
    setCreateForm({
      tipo: 'Cobertura de Merchandising',
      industria: '',
      titulo: '',
      descricao: '',
      fechamento: '',
      inicio: '',
      termino: '',
      diaInicioFat: '1',
      diaFimFat: '28',
    });
    setShowCreate(true);
  };

  const updateCreateField = (field: keyof typeof createForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!createForm.tipo || !createForm.titulo.trim() || !createForm.industria) {
      setCreateError('Preencha tipo, indústria e título do contrato.');
      return;
    }

    try {
      await onCreate({
        tipo: createForm.tipo,
        industria: createForm.industria,
        titulo: createForm.titulo.trim(),
        descricao: createForm.descricao.trim(),
        dataFechamento: createForm.fechamento || null,
        dataInicio: createForm.inicio || null,
        dataTermino: createForm.termino || null,
        diaInicioFat: Number(createForm.diaInicioFat) || 1,
        diaFimFat: Number(createForm.diaFimFat) || 28,
        status: 'Rascunho',
      });
      setShowCreate(false);
    } catch {
      // The parent displays the persistence error.
    }
  };

  return (
    <div className="fin-contratos">
      <div className="fin-toolbar">
        <div className="fin-search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Buscar por título, número ou indústria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="fin-btn-primary" onClick={openCreate}>
          + Novo Contrato
        </button>
      </div>

      <div className="card fin-table-card">
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Indústria</th>
                <th>Fechamento</th>
                <th>Valor Mensal</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="fin-title-cell">
                      <span className="fin-title-icon">
                        <IconBuilding />
                      </span>
                      <div>
                        <strong>{c.titulo}</strong>
                        <span>{c.subtitulo}</span>
                      </div>
                    </div>
                  </td>
                  <td>{c.industria}</td>
                  <td>{c.fechamento}</td>
                  <td>{formatBRL(c.valorMensal)}</td>
                  <td>
                    <span className={`fin-status ${c.status.toLowerCase()}`}>{c.status}</span>
                  </td>
                  <td>
                    <div className="fin-row-actions">
                      <button type="button" aria-label="Ver" onClick={() => onView(c)}>
                        <IconEye />
                      </button>
                      <button type="button" aria-label="Editar" onClick={() => openEdit(c)}>
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        aria-label="Excluir"
                        onClick={() => setToDelete(c)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="fin-empty-row">
                    Nenhum contrato encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toDelete && (
        <div className="fin-modal-overlay" onClick={() => setToDelete(null)}>
          <div
            className="fin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fin-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="fin-delete-title">Excluir contrato?</h2>
            <p>
              O contrato &quot;{toDelete.titulo}&quot; será excluído permanentemente, incluindo todas as
              filiais associadas. Esta ação não pode ser desfeita.
            </p>
            <div className="fin-modal-actions">
              <button type="button" className="fin-btn-outline" onClick={() => setToDelete(null)}>
                Cancelar
              </button>
              <button type="button" className="fin-btn-danger" onClick={confirmDelete}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fin-modal-overlay" onClick={() => setEditing(null)}>
          <div
            className="fin-modal fin-modal-form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fin-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="fin-edit-title">Editar contrato</h2>
            <p className="fin-modal-desc">Altere as informações do contrato e salve as mudanças.</p>

            <div className="fin-form">
              <label className="fin-field full">
                <span>Título</span>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => updateField('titulo', e.target.value)}
                />
              </label>

              <label className="fin-field full">
                <span>Subtítulo</span>
                <input
                  type="text"
                  value={form.subtitulo}
                  onChange={(e) => updateField('subtitulo', e.target.value)}
                />
              </label>

              <label className="fin-field">
                <span>Indústria</span>
                <select value={form.industria} onChange={(e) => updateField('industria', e.target.value)}>
                  <option value="">Selecione uma indústria</option>
                  {industrias.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                  {form.industria && !industrias.includes(form.industria) && (
                    <option value={form.industria}>{form.industria}</option>
                  )}
                </select>
              </label>

              <label className="fin-field">
                <span>Fechamento</span>
                <input
                  type="date"
                  value={form.fechamento}
                  onChange={(e) => updateField('fechamento', e.target.value)}
                />
              </label>

              <label className="fin-field">
                <span>Valor mensal</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.valorMensal}
                  onChange={(e) => updateField('valorMensal', e.target.value)}
                  placeholder="0,00"
                />
              </label>

              <label className="fin-field">
                <span>Tipo</span>
                <select value={form.tipo} onChange={(e) => updateField('tipo', e.target.value)}>
                  {TIPO_FORM.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fin-field full">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value as ContratoStatus)}
                >
                  {STATUS_FORM.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {formError && <p className="fin-form-error">{formError}</p>}

            <div className="fin-modal-actions">
              <button type="button" className="fin-btn-outline" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button type="button" className="fin-btn-primary" onClick={handleSave}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fin-modal-overlay" onClick={() => setShowCreate(false)}>
          <div
            className="fin-modal fin-modal-form fin-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fin-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fin-create-header">
              <div>
                <h2 id="fin-create-title">Novo Contrato</h2>
                <p>Preencha os dados do contrato. Após criar, você poderá adicionar as filiais.</p>
              </div>
              <button
                type="button"
                className="fin-create-close"
                onClick={() => setShowCreate(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="fin-create-body">
              <label className="fin-field full">
                <span>
                  Tipo de Contrato <em>*</em>
                </span>
                <select
                  value={createForm.tipo}
                  onChange={(e) => updateCreateField('tipo', e.target.value)}
                >
                  {TIPO_FORM.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fin-field full">
                <span>Indústria</span>
                <select
                  value={createForm.industria}
                  onChange={(e) => updateCreateField('industria', e.target.value)}
                >
                  <option value="">Selecione uma indústria</option>
                  {industrias.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                  {industrias.length === 0 && (
                    <option value="" disabled>
                      Carregando indústrias...
                    </option>
                  )}
                </select>
              </label>

              <label className="fin-field full">
                <span>
                  Título do Contrato <em>*</em>
                </span>
                <input
                  type="text"
                  placeholder="Ex: Cobertura Merchandising 2024"
                  value={createForm.titulo}
                  onChange={(e) => updateCreateField('titulo', e.target.value)}
                />
              </label>

              <label className="fin-field full">
                <span>Descrição</span>
                <textarea
                  rows={3}
                  placeholder="Detalhes do contrato..."
                  value={createForm.descricao}
                  onChange={(e) => updateCreateField('descricao', e.target.value)}
                />
              </label>

              <div className="fin-create-dates">
                <label className="fin-field">
                  <span>Data Fechamento</span>
                  <input
                    type="date"
                    value={createForm.fechamento}
                    onChange={(e) => updateCreateField('fechamento', e.target.value)}
                  />
                </label>
                <label className="fin-field">
                  <span>Início</span>
                  <input
                    type="date"
                    value={createForm.inicio}
                    onChange={(e) => updateCreateField('inicio', e.target.value)}
                  />
                </label>
                <label className="fin-field">
                  <span>Término</span>
                  <input
                    type="date"
                    value={createForm.termino}
                    onChange={(e) => updateCreateField('termino', e.target.value)}
                  />
                </label>
              </div>

              <div className="fin-create-days">
                <label className="fin-field">
                  <span>Dia Início Faturamento</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={createForm.diaInicioFat}
                    onChange={(e) => updateCreateField('diaInicioFat', e.target.value)}
                  />
                </label>
                <label className="fin-field">
                  <span>Dia Fim Faturamento</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={createForm.diaFimFat}
                    onChange={(e) => updateCreateField('diaFimFat', e.target.value)}
                  />
                </label>
              </div>
            </div>

            {createError && <p className="fin-form-error">{createError}</p>}

            <div className="fin-modal-actions">
              <button type="button" className="fin-btn-outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
              <button type="button" className="fin-btn-primary" onClick={handleCreate}>
                Criar Contrato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RelatoriosTab({
  kpis,
  receitaMes,
  receitaIndustria,
  comparativo,
}: {
  kpis: FinanceiroKpis;
  receitaMes: ReceitaMes[];
  receitaIndustria: ReceitaIndustria[];
  comparativo: ComparativoMes[];
}) {
  return (
    <div className="fin-relatorios">
      <div className="fin-kpi-grid four">
        <article className="card fin-kpi">
          <div className="fin-kpi-icon soft-coral">
            <IconDollar />
          </div>
          <div>
            <span>Receita Mês Atual</span>
            <strong>{formatBRL(kpis.receitaMesAtual)}</strong>
          </div>
        </article>
        <article className="card fin-kpi">
          <div className="fin-kpi-icon soft-green">↗</div>
          <div>
            <span>vs Mês Anterior</span>
            <strong className={kpis.vsMesAnterior == null || kpis.vsMesAnterior >= 0 ? 'positive' : 'negative'}>
              {kpis.vsMesAnterior == null
                ? '—'
                : `${kpis.vsMesAnterior >= 0 ? '+' : ''}${kpis.vsMesAnterior.toFixed(2).replace('.', ',')}%`}
            </strong>
          </div>
        </article>
        <article className="card fin-kpi">
          <div className="fin-kpi-icon soft-purple">%</div>
          <div>
            <span>Total Comissões</span>
            <strong>{formatBRL(kpis.totalComissoesMes)}</strong>
          </div>
        </article>
        <article className="card fin-kpi">
          <div className="fin-kpi-icon soft-blue">
            <IconBuilding />
          </div>
          <div>
            <span>Indústrias Ativas</span>
            <strong>{kpis.industriasAtivas}</strong>
          </div>
        </article>
      </div>

      <section className="card fin-panel">
        <header className="fin-panel-header">
          <span className="fin-panel-icon">📅</span>
          <h2>Receita por Mês (Contratos + Comissões)</h2>
        </header>
        <StackedMonthChart data={receitaMes} />
        <div className="fin-chart-legend">
          <span>
            <i className="contrato" /> Contratos
          </span>
          <span>
            <i className="comissao" /> Comissões
          </span>
        </div>
      </section>

      <section className="card fin-panel">
        <header className="fin-panel-header">
          <span className="fin-panel-icon">📊</span>
          <h2>Receita por Indústria (Contratos + Comissões)</h2>
        </header>
        <IndustriaChart data={receitaIndustria} />
      </section>

      <section className="card fin-panel">
        <header className="fin-panel-header">
          <span className="fin-panel-icon">↗</span>
          <h2>Comparativo Mês Atual vs Anterior</h2>
        </header>
        <div className="fin-table-wrap">
          <table className="fin-table compact">
            <thead>
              <tr>
                <th>Período</th>
                <th>Contratos</th>
                <th>Comissões</th>
                <th>Total</th>
                <th>Variação</th>
              </tr>
            </thead>
            <tbody>
              {comparativo.map((row) => (
                <tr key={row.periodo}>
                  <td>{row.periodo}</td>
                  <td>{formatBRL(row.contratos)}</td>
                  <td>{formatBRL(row.comissoes)}</td>
                  <td>
                    <strong>{formatBRL(row.total)}</strong>
                  </td>
                  <td>
                    {row.variacao == null ? (
                      '—'
                    ) : (
                      <span className={row.variacao >= 0 ? 'positive' : 'negative'}>
                        {row.variacao >= 0 ? '+' : ''}
                        {row.variacao.toFixed(2).replace('.', ',')}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KanbanTab({
  tasks,
  onAdvance,
  onMove,
  onGenerate,
  onConfigure,
}: {
  tasks: KanbanTask[];
  onAdvance: (id: string) => void;
  onMove: (id: string, coluna: KanbanTask['coluna']) => void;
  onGenerate: () => void;
  onConfigure: (contratoId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<KanbanTask['coluna'] | null>(null);

  const pendente = tasks.filter((t) => t.coluna === 'pendente');
  const aguardando = tasks.filter((t) => t.coluna === 'aguardando');
  const faturado = tasks.filter((t) => t.coluna === 'faturado');

  const totalPendente = pendente.reduce((a, t) => a + t.valor, 0);
  const totalAguardando = aguardando.reduce((a, t) => a + t.valor, 0);
  const totalFaturado = faturado.reduce((a, t) => a + t.valor, 0);

  const columns = [
    { key: 'pendente' as const, title: 'Pendente', icon: <IconClock />, items: pendente, badge: pendente.length },
    {
      key: 'aguardando' as const,
      title: 'Aguardando Autorização',
      icon: <IconSync />,
      items: aguardando,
      badge: aguardando.length,
    },
    { key: 'faturado' as const, title: 'Faturado', icon: <IconCheck />, items: faturado, badge: faturado.length },
  ];

  return (
    <div className="fin-kanban">
      <div className="fin-kanban-top">
        <h2>Kanban de Faturamento</h2>
        <button type="button" className="fin-btn-outline" onClick={onGenerate}>
          ↻ Gerar Tarefas do Mês
        </button>
      </div>

      <div className="fin-kpi-grid three">
        <article className="card fin-kpi mini">
          <div className="fin-kpi-icon soft-coral">
            <IconClock />
          </div>
          <div>
            <span>Total a Faturar</span>
            <strong>{formatCompactMoney(totalPendente)}</strong>
          </div>
        </article>
        <article className="card fin-kpi mini">
          <div className="fin-kpi-icon soft-blue">
            <IconSync />
          </div>
          <div>
            <span>Aguardando Autorização</span>
            <strong>{formatCompactMoney(totalAguardando)}</strong>
          </div>
        </article>
        <article className="card fin-kpi mini">
          <div className="fin-kpi-icon soft-green">
            <IconCheck />
          </div>
          <div>
            <span>Total Faturado</span>
            <strong>{formatCompactMoney(totalFaturado)}</strong>
          </div>
        </article>
      </div>

      <div className="fin-kanban-board">
        {columns.map((col) => (
          <section
            key={col.key}
            className={`fin-kanban-col ${overCol === col.key ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((prev) => (prev === col.key ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/task-id') || draggingId;
              if (id) onMove(id, col.key);
              setDraggingId(null);
              setOverCol(null);
            }}
          >
            <header>
              <span>
                {col.icon} {col.title}
              </span>
              <em>{col.badge}</em>
            </header>
            <div className="fin-kanban-list">
              {col.items.length === 0 && <p className="fin-kanban-empty">Nenhuma tarefa</p>}
              {col.items.map((task) => (
                <article
                  key={task.id}
                  className={`fin-kanban-card ${draggingId === task.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(task.id);
                    e.dataTransfer.setData('text/task-id', task.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverCol(null);
                  }}
                >
                  <div className="fin-kanban-card-top">
                    <span>{task.periodo}</span>
                    <span className="fin-kanban-tag">{task.tag}</span>
                  </div>
                  <strong>{task.titulo}</strong>
                  <p>
                    <IconBuilding /> {task.industria}
                  </p>
                  <footer>
                    <span className="fin-kanban-money">$ {formatCompactMoney(task.valor)}</span>
                    <div className="fin-kanban-card-actions">
                      {col.key === 'pendente' && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => onConfigure(task.contratoId)}
                        >
                          Configurar
                        </button>
                      )}
                      {col.key !== 'faturado' && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => onAdvance(task.id)}
                        >
                          Avançar →
                        </button>
                      )}
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function Financeiro() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'contratos';
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'contratos') params.delete('tab');
    else params.set('tab', next);
    if (next !== 'composicao') params.delete('contrato');
    setSearchParams(params, { replace: true });
  };
  const focusContratoId = searchParams.get('contrato');

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [kpis, setKpis] = useState<FinanceiroKpis>({
    contratosAtivos: 0,
    totalContratos: 0,
    totalComissoesMes: 0,
    totalAFaturar: 0,
    receitaMensalTotal: 0,
    receitaMesAtual: 0,
    vsMesAnterior: null,
    industriasAtivas: 0,
  });
  const [receitaMes, setReceitaMes] = useState<ReceitaMes[]>([]);
  const [receitaIndustria, setReceitaIndustria] = useState<ReceitaIndustria[]>([]);
  const [comparativo, setComparativo] = useState<ComparativoMes[]>([]);
  const [viewing, setViewing] = useState<Contrato | null>(null);

  const loadAll = async () => {
    const [nextContratos, nextTasks, nextKpis, nextReceitaMes, nextReceitaIndustria, nextComparativo] =
      await Promise.all([
        fetchContratos(),
        fetchKanbanTasks(),
        fetchFinanceiroKpis(),
        fetchReceitaPorMes(),
        fetchReceitaPorIndustria(),
        fetchComparativoMeses(),
      ]);
    setContratos(nextContratos);
    setTasks(nextTasks);
    setKpis(nextKpis);
    setReceitaMes(nextReceitaMes);
    setReceitaIndustria(nextReceitaIndustria);
    setComparativo(nextComparativo);
  };

  const refreshDerived = async () => {
    const [nextTasks, nextKpis, nextReceitaMes, nextReceitaIndustria, nextComparativo] = await Promise.all([
      fetchKanbanTasks(),
      fetchFinanceiroKpis(),
      fetchReceitaPorMes(),
      fetchReceitaPorIndustria(),
      fetchComparativoMeses(),
    ]);
    setTasks(nextTasks);
    setKpis(nextKpis);
    setReceitaMes(nextReceitaMes);
    setReceitaIndustria(nextReceitaIndustria);
    setComparativo(nextComparativo);
  };

  useEffect(() => {
    loadAll().catch((error) => {
      console.error(error);
      showToast('Não foi possível carregar os dados financeiros.', 'error');
    });
  }, []);

  const handleDeleteContrato = async (id: string) => {
    try {
      await deleteContrato(id);
      if (viewing?.id === id) setViewing(null);
      await loadAll();
      showToast('Contrato excluído.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível excluir o contrato.', 'error');
      throw error;
    }
  };

  const handleSaveContrato = async (contrato: Contrato) => {
    try {
      const updated = await updateContrato(contrato.id, {
        titulo: contrato.titulo,
        descricao: contrato.subtitulo,
        industria: contrato.industria,
        dataFechamento: toDateInput(contrato.fechamento) || null,
        valorMensal: contrato.valorMensal,
        status: contrato.status,
        tipo: contrato.tipo,
      });
      setViewing((prev) => (prev?.id === updated.id ? updated : prev));
      await loadAll();
      showToast('Contrato atualizado.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível atualizar o contrato.', 'error');
      throw error;
    }
  };

  const handleCreateContrato = async (input: ContratoCreateInput) => {
    try {
      const created = await createContrato(input);
      await loadAll();
      setTab('composicao');
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('tab', 'composicao');
          params.set('contrato', created.id);
          return params;
        },
        { replace: true },
      );
      showToast('Contrato criado. Configure a composição do mês.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível criar o contrato.', 'error');
      throw error;
    }
  };

  const advanceTask = async (id: string) => {
    try {
      await advanceKanbanTask(id);
      await refreshDerived();
      showToast('Tarefa avançada.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível avançar a tarefa.', 'error');
    }
  };

  const moveTask = async (id: string, coluna: KanbanTask['coluna']) => {
    const current = tasks.find((task) => task.id === id);
    if (!current || current.coluna === coluna) return;
    try {
      await moveKanbanTask(id, coluna);
      await refreshDerived();
      showToast('Tarefa movida.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível mover a tarefa.', 'error');
    }
  };

  const handleGenerateKanban = async () => {
    try {
      const count = await generateKanbanMesAtual();
      await refreshDerived();
      showToast(`${count} tarefa(s) do mês gerada(s).`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível gerar as tarefas do mês.', 'error');
    }
  };

  if (viewing) {
    return (
      <div className="financeiro-page">
        <BackToPortal />
        <header className="fin-header">
          <div>
            <h1 className="page-title">Módulo Financeiro</h1>
            <p className="fin-subtitle">Gestão de contratos de merchandising e ações de vendas</p>
          </div>
        </header>
        <ContratoDetail
          contrato={viewing}
          onBack={() => setViewing(null)}
          onUpdate={(contrato) => {
            setContratos((prev) => prev.map((c) => (c.id === contrato.id ? contrato : c)));
            setViewing(contrato);
            refreshDerived().catch((error) => {
              console.error(error);
              showToast('Dados atualizados, mas os indicadores não puderam ser recarregados.', 'error');
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="financeiro-page">
      <BackToPortal />

      <header className="fin-header">
        <div>
          <h1 className="page-title">Módulo Financeiro</h1>
          <p className="fin-subtitle">Gestão de contratos de merchandising e ações de vendas</p>
        </div>
      </header>

      <div className="fin-kpi-grid four">
        <article className="card fin-kpi">
          <div>
            <span>Contratos Ativos</span>
            <strong>{kpis.contratosAtivos}</strong>
            <em className="positive">↗ {kpis.totalContratos} total</em>
          </div>
          <div className="fin-kpi-icon soft-coral square">
            <IconDoc />
          </div>
        </article>
        <article className="card fin-kpi">
          <div>
            <span>Total Comissões (Mês)</span>
            <strong>{formatCompactMoney(kpis.totalComissoesMes)}</strong>
          </div>
          <div className="fin-kpi-icon soft-coral square">
            <IconDollar />
          </div>
        </article>
        <article className="card fin-kpi">
          <div>
            <span>Total a Faturar</span>
            <strong>{formatCompactMoney(kpis.totalAFaturar)}</strong>
          </div>
          <div className="fin-kpi-icon soft-coral square">
            <IconWallet />
          </div>
        </article>
        <article className="card fin-kpi">
          <div>
            <span>Receita Mensal Total</span>
            <strong>{formatCompactMoney(kpis.receitaMensalTotal)}</strong>
          </div>
          <div className="fin-kpi-icon soft-coral square">
            <IconTrend />
          </div>
        </article>
      </div>

      <nav className="fin-tabs" aria-label="Abas do financeiro">
        <button
          type="button"
          className={tab === 'contratos' ? 'active' : ''}
          onClick={() => setTab('contratos')}
        >
          <IconDoc /> Contratos
        </button>
        <button
          type="button"
          className={tab === 'composicao' ? 'active' : ''}
          onClick={() => setTab('composicao')}
        >
          <IconBuilding /> Composição
        </button>
        <button
          type="button"
          className={tab === 'relatorios' ? 'active' : ''}
          onClick={() => setTab('relatorios')}
        >
          <IconChart /> Relatórios
        </button>
        <button type="button" className={tab === 'kanban' ? 'active' : ''} onClick={() => setTab('kanban')}>
          <IconKanban /> Kanban
        </button>
        <button
          type="button"
          className={tab === 'comissao' ? 'active' : ''}
          onClick={() => setTab('comissao')}
        >
          <IconDollar /> Comissão
        </button>
      </nav>

      {tab === 'contratos' && (
        <ContratosTab
          contratos={contratos}
          onDelete={handleDeleteContrato}
          onSave={handleSaveContrato}
          onView={setViewing}
          onCreate={handleCreateContrato}
        />
      )}
      {tab === 'composicao' && (
        <ComposicaoTab
          contratos={contratos}
          focusContratoId={focusContratoId}
          onDone={async () => {
            await loadAll();
          }}
        />
      )}
      {tab === 'relatorios' && (
        <RelatoriosTab
          kpis={kpis}
          receitaMes={receitaMes}
          receitaIndustria={receitaIndustria}
          comparativo={comparativo}
        />
      )}
      {tab === 'kanban' && (
        <KanbanTab
          tasks={tasks}
          onAdvance={advanceTask}
          onMove={moveTask}
          onGenerate={handleGenerateKanban}
          onConfigure={(contratoId) => {
            setSearchParams(
              (prev) => {
                const params = new URLSearchParams(prev);
                params.set('tab', 'composicao');
                params.set('contrato', contratoId);
                return params;
              },
              { replace: true },
            );
          }}
        />
      )}
      {tab === 'comissao' && (
        <div className="comissao-embedded">
          <Comissao />
        </div>
      )}
    </div>
  );
}
