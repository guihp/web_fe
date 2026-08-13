import { useState } from 'react';
import { USER_FORM_CARGOS } from '../../data/portalModules';
import { maskCpfInput, maskPhoneInput } from '../../lib/cpf';
import type { Usuario } from '../../utils/format';
import { formatCpf } from '../../utils/format';
import { updateUser } from '../../services/userService';
import ModalShell from './ModalShell';

const CARGOS = [...USER_FORM_CARGOS];

type EditColaboradorModalProps = {
  user: Usuario;
  onClose: () => void;
  onSuccess: () => void;
};

function buildEndereco(user: Usuario) {
  if (user.cidade && user.estado_id) {
    return `${user.cidade}, ${user.estado_id}`;
  }
  return user.cidade || '';
}

export default function EditColaboradorModal({ user, onClose, onSuccess }: EditColaboradorModalProps) {
  const [form, setForm] = useState({
    nome: user.nome,
    email: user.email || '',
    telefone: user.telefone ? maskPhoneInput(user.telefone) : '',
    cpf: formatCpf(user.cpf),
    endereco: buildEndereco(user),
    cargo: user.cargo,
    senha: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const generatePassword = () => {
    updateField('senha', Math.random().toString(36).substring(2, 10));
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.cpf.trim() || !form.cargo) {
      setError('Preencha nome, CPF e cargo.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateUser(user.id, {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        cpf: form.cpf,
        cargo: form.cargo,
        endereco: form.endereco,
        senha: form.senha.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar colaborador.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="form-modal">
      <div className="colab-modal-header">
        <h2>Editar Colaborador</h2>
        <p>Edite as informações de seus colaboradores</p>
      </div>

      <div className="colab-form">
        <label className="colab-field full">
          <span>Nome completo</span>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => updateField('nome', e.target.value)}
          />
        </label>

        <label className="colab-field full">
          <span>E-mail</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </label>

        <label className="colab-field full">
          <span>Telefone</span>
          <input
            type="text"
            value={form.telefone}
            onChange={(e) => updateField('telefone', maskPhoneInput(e.target.value))}
          />
        </label>

        <label className="colab-field full">
          <span>CPF</span>
          <input
            type="text"
            value={form.cpf}
            onChange={(e) => updateField('cpf', maskCpfInput(e.target.value))}
          />
        </label>

        <label className="colab-field full">
          <span>Endereço</span>
          <input
            type="text"
            value={form.endereco}
            onChange={(e) => updateField('endereco', e.target.value)}
          />
        </label>

        <label className="colab-field full">
          <span>Cargo</span>
          <div className="colab-select-wrap">
            <select value={form.cargo} onChange={(e) => updateField('cargo', e.target.value)}>
              <option value="" disabled>
                Selecionar o cargo
              </option>
              {CARGOS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="colab-field full">
          <span>Senha</span>
          <div className="colab-password-wrap">
            <input
              type="password"
              placeholder="Deixe em branco para manter a senha atual"
              value={form.senha}
              onChange={(e) => updateField('senha', e.target.value)}
            />
            <button type="button" className="colab-generate-btn" onClick={generatePassword} aria-label="Gerar senha">
              ↻
            </button>
          </div>
        </label>
      </div>

      {error && <p className="colab-form-error">{error}</p>}

      <div className="colab-modal-actions">
        <button type="button" className="colab-btn-save" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando...' : 'Editar'}
        </button>
        <button type="button" className="colab-btn-cancel" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </ModalShell>
  );
}
