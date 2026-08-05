import ModalShell from '../colaboradores/ModalShell';
import { formatLojaNome, type Loja } from '../../services/lojasService';

type ExcluirFilialModalProps = {
  loja: Loja;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ExcluirFilialModal({
  loja,
  deleting,
  onClose,
  onConfirm,
}: ExcluirFilialModalProps) {
  return (
    <ModalShell onClose={onClose} className="filiais-modal filiais-confirm-modal">
      <div className="filiais-modal-header">
        <div>
          <h2>Excluir filial?</h2>
          <p>
            Esta ação não pode ser desfeita. A filial{' '}
            <strong>{formatLojaNome(loja)}</strong> será removida permanentemente do banco de dados.
          </p>
        </div>
        <button type="button" className="filiais-modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="filiais-modal-actions">
        <button type="button" className="filiais-btn-outline" onClick={onClose} disabled={deleting}>
          Cancelar
        </button>
        <button
          type="button"
          className="filiais-btn-danger"
          onClick={onConfirm}
          disabled={deleting}
        >
          {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
        </button>
      </div>
    </ModalShell>
  );
}
