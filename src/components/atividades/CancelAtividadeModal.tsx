import { useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import { cancelAtividade, type AtividadeRow } from '../../services/atividadesService';
import './AtividadeModals.css';

type CancelAtividadeModalProps = {
  atividade: AtividadeRow;
  onClose: () => void;
  onSuccess: () => void;
};

export default function CancelAtividadeModal({
  atividade,
  onClose,
  onSuccess,
}: CancelAtividadeModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setSaving(true);
    setError(null);

    try {
      await cancelAtividade(atividade.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar atividade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="atividade-confirm-modal">
      <div className="atividade-confirm-header">
        <h2>Cancelar atividade</h2>
      </div>
      <p className="atividade-confirm-message">
        Deseja cancelar a atividade <strong>{atividade.tipo}</strong> de{' '}
        <strong>{atividade.responsavelNome}</strong>? O registro permanecerá no histórico com status
        Cancelado.
      </p>
      {error && <p className="atividade-error">{error}</p>}
      <div className="atividade-confirm-actions">
        <button
          type="button"
          className="atividade-btn-cancel"
          onClick={handleCancel}
          disabled={saving}
        >
          {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
        </button>
        <button type="button" className="atividade-btn-confirm" onClick={onClose} disabled={saving}>
          Voltar
        </button>
      </div>
    </ModalShell>
  );
}
