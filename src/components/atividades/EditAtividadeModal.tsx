import { useEffect, useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import {
  fetchPromotores,
  updateAtividade,
  type AtividadeRow,
} from '../../services/atividadesService';
import type { Usuario } from '../../utils/format';
import './AtividadeModals.css';

type EditAtividadeModalProps = {
  atividade: AtividadeRow;
  onClose: () => void;
  onSuccess: () => void;
};

export default function EditAtividadeModal({ atividade, onClose, onSuccess }: EditAtividadeModalProps) {
  const [promotores, setPromotores] = useState<Usuario[]>([]);
  const [usuarioId, setUsuarioId] = useState(String(atividade.usuario_responsavel));
  const [dataInicio, setDataInicio] = useState(atividade.data_inicio);
  const [dataFim, setDataFim] = useState(atividade.data_fim);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPromotores()
      .then(setPromotores)
      .catch(() => setPromotores([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!usuarioId || !dataInicio || !dataFim) {
      setError('Preencha todos os campos.');
      return;
    }
    if (dataFim < dataInicio) {
      setError('A data fim deve ser igual ou posterior à data início.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateAtividade(atividade.id, {
        usuario_responsavel: Number(usuarioId),
        data_inicio: dataInicio,
        data_fim: dataFim,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar atividade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="atividade-modal">
      <div className="atividade-modal-header">
        <h2>Editar atividade</h2>
        <p>Altere o promotor ou o período da rota</p>
      </div>

      {loading ? (
        <p className="atividade-loading">Carregando promotores...</p>
      ) : (
        <div className="atividade-form">
          <label className="atividade-field">
            <span>Promotor</span>
            <div className="atividade-select-wrap">
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                <option value="">Selecionar promotor</option>
                {promotores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="atividade-field">
            <span>Início da rota</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </label>

          <label className="atividade-field">
            <span>Fim da rota</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </label>
        </div>
      )}

      {error && <p className="atividade-error">{error}</p>}

      <div className="atividade-detail-actions">
        <button
          type="button"
          className="atividade-btn-submit"
          onClick={handleSave}
          disabled={loading || saving}
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <button type="button" className="atividade-btn-outline" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </ModalShell>
  );
}
