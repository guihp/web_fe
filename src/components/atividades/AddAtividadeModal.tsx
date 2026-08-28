import { useEffect, useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import {
  fetchLojas,
  fetchPromotores,
  type AtividadeFormData,
  type Loja,
} from '../../services/atividadesService';
import { fetchIndustriasAtivas, type Industria } from '../../services/industriaService';
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
  usuarioId: '',
  dataInicio: '',
  dataFim: '',
};

export default function AddAtividadeModal({ onClose, onSubmit, error }: AddAtividadeModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [selectedIndustrias, setSelectedIndustrias] = useState<string[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [industrias, setIndustrias] = useState<Industria[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchLojas(), fetchIndustriasAtivas(), fetchPromotores()])
      .then(([lojasData, industriasData, usuariosData]) => {
        setLojas(lojasData);
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

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      selectedIndustrias.length === 0 ||
      !form.usuarioId ||
      !form.dataInicio ||
      !form.dataFim
    ) {
      setFormError('Preencha todos os campos e selecione ao menos uma indústria.');
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
      loja: form.loja,
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

          <label className="atividade-field">
            <span>Supermercado</span>
            <div className="atividade-select-wrap">
              <select value={form.loja} onChange={(e) => updateField('loja', e.target.value)}>
                <option value="">Selecionar supermercado</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.Nome}>
                    {loja.Nome}
                  </option>
                ))}
              </select>
            </div>
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
                : `${selectedIndustrias.length} indústria(s) selecionada(s) — será criada uma atividade para cada`}
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
