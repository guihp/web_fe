import { useEffect, useMemo, useRef, useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import {
  fetchPromotores,
  type AtividadeFormData,
} from '../../services/atividadesService';
import { fetchIndustriasAtivas, type Industria } from '../../services/industriaService';
import { fetchLojas, formatLojaNome, type Loja } from '../../services/lojasService';
import type { Usuario } from '../../utils/format';
import './AtividadeModals.css';

const TIPOS_ATIVIDADE = ['Antes e Depois', 'Degustação'];

type AddAtividadeModalProps = {
  onClose: () => void;
  onSubmit: (data: AtividadeFormData) => void;
  error?: string | null;
};

const emptyForm = {
  tipo: '',
  loja: '',
  secoes: '',
  usuarioId: '',
  dataInicio: '',
  dataFim: '',
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export default function AddAtividadeModal({ onClose, onSubmit, error }: AddAtividadeModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [selectedIndustrias, setSelectedIndustrias] = useState<string[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const [lojaId, setLojaId] = useState('');
  const [lojaQuery, setLojaQuery] = useState('');
  const [lojaOpen, setLojaOpen] = useState(false);
  const lojaWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetchLojas(), fetchIndustriasAtivas(), fetchPromotores()])
      .then(([lojasData, industriasData, usuariosData]) => {
        setLojas(lojasData.filter((l) => !l.status || l.status === 'Ativo'));
        setIndustrias(industriasData);
        setUsuarios(usuariosData);
      })
      .catch(() => {
        setLojas([]);
        setIndustrias([]);
        setUsuarios([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedLoja = useMemo(
    () => lojas.find((l) => String(l.id) === lojaId) ?? null,
    [lojas, lojaId],
  );

  const lojasFiltradas = useMemo(() => {
    const q = normalizeSearch(lojaQuery);
    const list = !q
      ? lojas
      : lojas.filter((loja) => {
          const nome = normalizeSearch(loja.Nome);
          const label = normalizeSearch(formatLojaNome(loja));
          const codigo = loja.codigo != null ? String(loja.codigo) : '';
          const id = String(loja.id);
          const cidade = normalizeSearch(loja.cidade ?? '');
          return (
            nome.includes(q) ||
            label.includes(q) ||
            codigo.includes(q) ||
            id.includes(q) ||
            cidade.includes(q)
          );
        });
    return list.slice(0, 60);
  }, [lojas, lojaQuery]);

  useEffect(() => {
    if (!lojaOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (lojaWrapRef.current && !lojaWrapRef.current.contains(event.target as Node)) {
        setLojaOpen(false);
        if (selectedLoja) setLojaQuery(formatLojaNome(selectedLoja));
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [lojaOpen, selectedLoja]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectLoja = (loja: Loja) => {
    setLojaId(String(loja.id));
    setLojaQuery(formatLojaNome(loja));
    setLojaOpen(false);
    updateField('loja', loja.Nome);
    setFormError(null);
  };

  const toggleIndustria = (nome: string) => {
    setSelectedIndustrias((prev) =>
      prev.includes(nome) ? prev.filter((item) => item !== nome) : [...prev, nome]
    );
    setFormError(null);
  };

  const selectAllIndustrias = () => {
    setSelectedIndustrias(industrias.map((item) => item.Nome));
    setFormError(null);
  };

  const clearIndustrias = () => {
    setSelectedIndustrias([]);
  };

  const handleSubmit = () => {
    if (
      !form.tipo ||
      !form.loja ||
      !selectedLoja ||
      !form.secoes.trim() ||
      selectedIndustrias.length === 0 ||
      !form.usuarioId ||
      !form.dataInicio ||
      !form.dataFim
    ) {
      setFormError(
        !selectedLoja && form.loja
          ? 'Selecione a loja na lista (digite o código ou o nome).'
          : 'Preencha todos os campos e selecione ao menos uma indústria.',
      );
      return;
    }

    if (form.dataFim < form.dataInicio) {
      setFormError('A data fim deve ser igual ou posterior à data início.');
      return;
    }

    setFormError(null);
    const usuario = usuarios.find((u) => String(u.id) === form.usuarioId);

    onSubmit({
      tipo: form.tipo,
      loja: selectedLoja.Nome,
      secoes: form.secoes.trim(),
      industrias: selectedIndustrias,
      usuarioId: Number(form.usuarioId),
      usuarioNome: usuario?.nome ?? '',
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
    });
  };

  return (
    <ModalShell onClose={onClose} className="atividade-modal">
      <div className="atividade-modal-header">
        <h2>Adicionar Atividades</h2>
        <p>Adicione suas atividades</p>
      </div>

      {loading ? (
        <p className="atividade-loading">Carregando opções...</p>
      ) : (
        <div className="atividade-form">
          <label className="atividade-field">
            <span>Tipo de atividade</span>
            <div className="atividade-select-wrap">
              <select value={form.tipo} onChange={(e) => updateField('tipo', e.target.value)}>
                <option value="">Selecionar tipo de atividade</option>
                {TIPOS_ATIVIDADE.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <div className="atividade-field" ref={lojaWrapRef}>
            <span>Supermercado</span>
            <input
              type="search"
              value={lojaQuery}
              onChange={(e) => {
                const next = e.target.value;
                setLojaQuery(next);
                setLojaOpen(true);
                if (selectedLoja && next !== formatLojaNome(selectedLoja)) {
                  setLojaId('');
                  updateField('loja', '');
                }
              }}
              onFocus={() => setLojaOpen(true)}
              placeholder="Digite o nome ou número da loja"
              autoComplete="off"
            />
            {lojaOpen && (
              <ul className="atividade-loja-list" role="listbox">
                {lojasFiltradas.map((loja) => (
                  <li key={loja.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={String(loja.id) === lojaId}
                      className={String(loja.id) === lojaId ? 'is-selected' : undefined}
                      onClick={() => selectLoja(loja)}
                    >
                      {formatLojaNome(loja)}
                    </button>
                  </li>
                ))}
                {lojasFiltradas.length === 0 && (
                  <li className="atividade-loja-empty">Nenhuma loja encontrada.</li>
                )}
              </ul>
            )}
            {selectedLoja && (
              <small className="atividade-loja-hint">
                Selecionada: {formatLojaNome(selectedLoja)}
              </small>
            )}
          </div>

          <label className="atividade-field">
            <span>Seções</span>
            <input
              type="text"
              value={form.secoes}
              onChange={(e) => updateField('secoes', e.target.value)}
              placeholder="Ex.: Padaria, Hortifruti, Mercearia"
              autoComplete="off"
            />
            <small className="atividade-loja-hint">
              Informe as seções que o promotor deve postar / trabalhar nesta loja.
            </small>
          </label>

          <div className="atividade-field">
            <div className="atividade-industrias-head">
              <span>Indústrias</span>
              <div className="atividade-industrias-actions">
                <button type="button" onClick={selectAllIndustrias}>
                  Todas
                </button>
                <button type="button" onClick={clearIndustrias}>
                  Limpar
                </button>
              </div>
            </div>
            <div className="atividade-industrias-panel">
              {industrias.length === 0 ? (
                <p className="atividade-industrias-empty">Nenhuma indústria cadastrada.</p>
              ) : (
                industrias.map((ind) => {
                  const checked = selectedIndustrias.includes(ind.Nome);
                  return (
                    <label
                      key={ind.id}
                      className={`atividade-industria-option ${checked ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIndustria(ind.Nome)}
                      />
                      <span>{ind.Nome}</span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="atividade-industrias-hint">
              {selectedIndustrias.length === 0
                ? 'Selecione uma ou mais indústrias'
                : `${selectedIndustrias.length} indústria(s) selecionada(s), será criada uma atividade para cada`}
            </p>
          </div>

          <label className="atividade-field">
            <span>Promotor</span>
            <div className="atividade-select-wrap">
              <select value={form.usuarioId} onChange={(e) => updateField('usuarioId', e.target.value)}>
                <option value="">Selecionar promotor</option>
                {usuarios.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nome}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="atividade-field">
            <span>Início da rota</span>
            <input
              type="date"
              value={form.dataInicio}
              onChange={(e) => updateField('dataInicio', e.target.value)}
            />
          </label>

          <label className="atividade-field">
            <span>Fim da rota</span>
            <input
              type="date"
              value={form.dataFim}
              onChange={(e) => updateField('dataFim', e.target.value)}
              min={form.dataInicio || undefined}
            />
          </label>
        </div>
      )}

      {(formError || error) && <p className="atividade-error">{formError || error}</p>}

      <button
        type="button"
        className="atividade-btn-submit"
        onClick={handleSubmit}
        disabled={loading}
      >
        Adicionar Atividades
      </button>
    </ModalShell>
  );
}
