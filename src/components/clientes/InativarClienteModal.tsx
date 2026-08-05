import ModalShell from '../colaboradores/ModalShell';
import type { BaseCliente } from '../../utils/vendasDomain';

type InativarClienteModalProps = {
  cliente: BaseCliente;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function InativarClienteModal({
  cliente,
  saving,
  onClose,
  onConfirm,
}: InativarClienteModalProps) {
  const isAtivo = (cliente.status || 'Ativo') === 'Ativo';
  const nome = cliente.nome_fantasia?.trim() || cliente.razao_social?.trim() || cliente.cdc;

  return (
    <ModalShell onClose={onClose}>
      <div className="colab-modal-header">
        <h2>{isAtivo ? 'Inativar cliente?' : 'Ativar cliente?'}</h2>
        <p>
          {isAtivo ? (
            <>
              O cliente <strong>{nome}</strong> (CDC {cliente.cdc}) será marcado como{' '}
              <strong>Inativo</strong>. Você poderá ativá-lo novamente depois.
            </>
          ) : (
            <>
              O cliente <strong>{nome}</strong> (CDC {cliente.cdc}) voltará a aparecer como{' '}
              <strong>Ativo</strong>.
            </>
          )}
        </p>
      </div>
      <div className="colab-actions">
        <button
          type="button"
          className={isAtivo ? 'colab-btn danger' : 'colab-btn primary'}
          disabled={saving}
          onClick={onConfirm}
        >
          {saving ? 'Salvando...' : isAtivo ? 'Inativar' : 'Ativar'}
        </button>
        <button type="button" className="colab-btn outline" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </ModalShell>
  );
}
