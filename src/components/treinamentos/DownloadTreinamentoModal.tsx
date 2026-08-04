import ModalShell from '../colaboradores/ModalShell';
import './TreinamentoModals.css';

type DownloadTreinamentoModalProps = {
  titulo: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DownloadTreinamentoModal({
  titulo,
  onClose,
  onConfirm,
}: DownloadTreinamentoModalProps) {
  return (
    <ModalShell onClose={onClose} className="treinamento-download-modal">
      <div className="treinamento-download-header">
        <h2>Baixar Arquivo</h2>
        <button type="button" className="treinamento-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <p className="treinamento-download-message">Você deseja baixar esse arquivo?</p>
      <p className="treinamento-download-title">{titulo}</p>

      <div className="treinamento-modal-actions">
        <button type="button" className="treinamento-btn-save" onClick={onConfirm}>
          Sim, quero baixar
        </button>
        <button type="button" className="treinamento-btn-cancel" onClick={onClose}>
          Não, quero cancelar
        </button>
      </div>
    </ModalShell>
  );
}
