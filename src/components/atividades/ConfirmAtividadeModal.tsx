import ModalShell from '../colaboradores/ModalShell';
import type { AtividadeFormData } from '../../services/atividadesService';
import { formatPeriodo } from '../../utils/atividadesDomain';
import './AtividadeModals.css';

type ConfirmAtividadeModalProps = {
  pending: AtividadeFormData;
  onClose: () => void;
  onConfirm: () => void;
  saving?: boolean;
};

export default function ConfirmAtividadeModal({
  pending,
  onClose,
  onConfirm,
  saving = false,
}: ConfirmAtividadeModalProps) {
  const count = pending.industrias.length;

  return (
    <ModalShell onClose={onClose} className="atividade-confirm-modal">
      <div className="atividade-confirm-header">
        <h2>Confirme {count > 1 ? 'essas atividades' : 'essa atividade'}</h2>
        <button type="button" className="atividade-confirm-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <p className="atividade-confirm-message">
        Será{count > 1 ? 'ão' : ''} criada{count > 1 ? 's' : ''}{' '}
        <strong>{count} atividade{count > 1 ? 's' : ''}</strong> para{' '}
        <strong>{pending.usuarioNome}</strong> com os mesmos dados abaixo:
      </p>

      <div className="atividade-confirm-summary">
        <p>
          <strong>Tipo:</strong> {pending.tipo}
        </p>
        <p>
          <strong>Loja:</strong> {pending.loja}
        </p>
        <p>
          <strong>Seções:</strong> {pending.secoes}
        </p>
        <p>
          <strong>Período:</strong> {formatPeriodo(pending.dataInicio, pending.dataFim)}
        </p>
        <div>
          <strong>Indústrias:</strong>
          <ul className="atividade-confirm-industrias">
            {pending.industrias.map((industria) => (
              <li key={industria}>{industria}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="atividade-confirm-actions">
        <button type="button" className="atividade-btn-confirm" onClick={onConfirm} disabled={saving}>
          {saving ? 'Salvando...' : 'Confirmar'}
        </button>
        <button type="button" className="atividade-btn-cancel" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </ModalShell>
  );
}
