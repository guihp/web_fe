import { useState } from 'react';
import { deleteCliente } from '../../services/clienteService';
import type { BaseCliente } from '../../utils/vendasDomain';
import ModalShell from '../colaboradores/ModalShell';

type DeleteClienteModalProps = {
  cliente: BaseCliente;
  onClose: () => void;
  onSuccess: () => void;
};

export default function DeleteClienteModal({ cliente, onClose, onSuccess }: DeleteClienteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await deleteCliente(cliente.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir cliente.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="colab-modal-header">
        <h2>Excluir Cliente</h2>
        <p>
          Tem certeza que deseja excluir <strong>{cliente.nome_fantasia?.trim()}</strong> (CDC {cliente.cdc})?
        </p>
      </div>
      {error && <p className="colab-error">{error}</p>}
      <div className="colab-actions">
        <button type="button" className="colab-btn danger" disabled={deleting} onClick={handleDelete}>
          {deleting ? 'Excluindo...' : 'Excluir'}
        </button>
        <button type="button" className="colab-btn outline" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </ModalShell>
  );
}
