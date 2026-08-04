import { useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import { deleteAtividade, type AtividadeRow } from '../../services/atividadesService';
import './AtividadeModals.css';

type DeleteAtividadeModalProps = {
  atividade: AtividadeRow;
  onClose: () => void;
  onSuccess: () => void;
};

export default function DeleteAtividadeModal({
  atividade,
  onClose,
  onSuccess,
}: DeleteAtividadeModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await deleteAtividade(atividade.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir atividade.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="atividade-confirm-modal">
      <div className="atividade-confirm-header">
        <h2>Excluir atividade</h2>
      </div>
      <p className="atividade-confirm-message">
        Tem certeza que deseja excluir permanentemente a atividade{' '}
        <strong>{atividade.tipo}</strong> ({atividade.loja})? Esta ação não pode ser desfeita.
      </p>
      {error && <p className="atividade-error">{error}</p>}
      <div className="atividade-confirm-actions">
        <button type="button" className="atividade-btn-cancel" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
        </button>
        <button type="button" className="atividade-btn-confirm" onClick={onClose} disabled={deleting}>
          Voltar
        </button>
      </div>
    </ModalShell>
  );
}
