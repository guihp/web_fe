import ModalShell from '../colaboradores/ModalShell';
import type { IndustriaAdmin } from '../../services/industriasAdminService';

type InativarIndustriaModalProps = {
  industria: IndustriaAdmin;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function InativarIndustriaModal({
  industria,
  saving,
  onClose,
  onConfirm,
}: InativarIndustriaModalProps) {
  const isAtivo = (industria.status || 'Ativo') === 'Ativo';

  return (
    <ModalShell onClose={onClose} className="filiais-modal filiais-confirm-modal">
      <div className="filiais-modal-header">
        <div>
          <h2>{isAtivo ? 'Inativar indústria?' : 'Ativar indústria?'}</h2>
          <p>
            {isAtivo ? (
              <>
                A indústria <strong>{industria.Nome}</strong> será marcada como{' '}
                <strong>Inativo</strong>. Você poderá ativá-la novamente depois.
              </>
            ) : (
              <>
                A indústria <strong>{industria.Nome}</strong> voltará a aparecer como{' '}
                <strong>Ativo</strong>.
              </>
            )}
          </p>
        </div>
        <button type="button" className="filiais-modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="filiais-modal-actions">
        <button type="button" className="filiais-btn-outline" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button
          type="button"
          className={isAtivo ? 'filiais-btn-danger' : 'filiais-btn-primary'}
          onClick={onConfirm}
          disabled={saving}
        >
          {saving ? 'Salvando...' : isAtivo ? 'Inativar' : 'Ativar'}
        </button>
      </div>
    </ModalShell>
  );
}
