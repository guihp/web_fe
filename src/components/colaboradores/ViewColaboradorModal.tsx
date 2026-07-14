import type { Usuario } from '../../utils/format';
import { formatCpf, formatPhone, getEstadoNome } from '../../utils/format';
import ModalShell from './ModalShell';

type ViewColaboradorModalProps = {
  user: Usuario;
  onClose: () => void;
};

function ReadonlyField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <label className={`colab-field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      <input type="text" value={value} readOnly />
    </label>
  );
}

export default function ViewColaboradorModal({ user, onClose }: ViewColaboradorModalProps) {
  return (
    <ModalShell onClose={onClose} className="view-modal">
      <div className="colab-modal-header">
        <h2>Detalhes do Colaborador</h2>
        <p>Detalhes das informações de seus colaboradores</p>
      </div>

      <div className="colab-form">
        <ReadonlyField label="Nome completo" value={user.nome} full />

        <div className="colab-row">
          <ReadonlyField label="E-mail" value={user.email || '—'} />
          <ReadonlyField label="Telefone" value={formatPhone(user.telefone)} />
        </div>

        <div className="colab-row">
          <ReadonlyField label="CPF" value={formatCpf(user.cpf)} />
          <ReadonlyField label="Cargo" value={user.cargo} />
        </div>

        <div className="colab-row">
          <ReadonlyField label="Cidade" value={user.cidade || '—'} />
          <ReadonlyField label="Estado" value={getEstadoNome(user.estado_id)} />
        </div>
      </div>

      <button type="button" className="colab-btn-outline" onClick={onClose}>
        Fechar
      </button>
    </ModalShell>
  );
}
