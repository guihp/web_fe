import type { Usuario } from '../../utils/format';
import ModalShell from './ModalShell';

type DeleteColaboradorModalProps = {
  user: Usuario;
  onClose: () => void;
  onConfirm: () => void;
  deleting?: boolean;
};

export default function DeleteColaboradorModal({
  user,
  onClose,
  onConfirm,
  deleting = false,
}: DeleteColaboradorModalProps) {
  return (
    <ModalShell onClose={onClose} className="delete-modal">
      <div className="colab-delete-header">
        <h2>Excluir Colaborador</h2>
        <button type="button" className="colab-delete-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <p className="colab-delete-message">Você deseja excluir este colaborador?</p>
      <p className="colab-delete-user">{user.nome}</p>

      <div className="colab-modal-actions">
        <button type="button" className="colab-btn-save" onClick={onConfirm} disabled={deleting}>
          {deleting ? 'Excluindo...' : 'Sim, quero excluir'}
        </button>
        <button type="button" className="colab-btn-cancel" onClick={onClose} disabled={deleting}>
          Não, quero cancelar
        </button>
      </div>
    </ModalShell>
  );
}
