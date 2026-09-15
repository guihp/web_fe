import ModalShell from '../colaboradores/ModalShell';
import type { Veiculo } from '../../services/veiculosService';
import './ExcluirVeiculoModal.css';

type ExcluirVeiculoModalProps = {
  veiculo: Veiculo;
  deleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ExcluirVeiculoModal({
  veiculo,
  deleting = false,
  onClose,
  onConfirm,
}: ExcluirVeiculoModalProps) {
  return (
    <ModalShell onClose={onClose} className="gv-confirm-modal">
      <div className="gv-confirm-header">
        <div>
          <h2>Excluir veículo?</h2>
          <p>
            Tem certeza de que deseja excluir{' '}
            <strong>
              {veiculo.placa} — {veiculo.marca} {veiculo.modelo}
            </strong>
            ?
          </p>
          <p className="gv-confirm-warn">
            Esta ação é <strong>irreversível</strong>. O registro será removido permanentemente (ou
            inativado se houver histórico vinculado).
          </p>
        </div>
        <button type="button" className="gv-confirm-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="gv-confirm-actions">
        <button type="button" className="gv-confirm-cancel" onClick={onClose} disabled={deleting}>
          Cancelar
        </button>
        <button
          type="button"
          className="gv-confirm-danger"
          onClick={onConfirm}
          disabled={deleting}
        >
          {deleting ? 'Excluindo…' : 'Sim, excluir permanentemente'}
        </button>
      </div>
    </ModalShell>
  );
}
