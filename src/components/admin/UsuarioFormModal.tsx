import { useMemo, useState } from 'react';
import { maskCpfInput, maskPhoneInput } from '../../lib/cpf';
import {
  PORTAL_MODULES,
  USER_FORM_CARGOS,
  canManageUsers,
  defaultModulosForCargo,
  parseModulosFromNivelAcesso,
  type PortalModuleId,
} from '../../data/portalModules';
import { saveUser, updateUser } from '../../services/userService';
import type { Usuario } from '../../utils/format';
import { formatCpf } from '../../utils/format';
import ModalShell from '../colaboradores/ModalShell';

type UsuarioFormModalProps = {
  user?: Usuario | null;
  onClose: () => void;
  onSuccess: () => void;
};

function buildEndereco(user: Usuario) {
  if (user.cidade && user.estado_id) return `${user.cidade}, ${user.estado_id}`;
  return user.cidade || '';
}

export default function UsuarioFormModal({ user, onClose, onSuccess }: UsuarioFormModalProps) {
  const isEdit = Boolean(user);
  const initialCargo = user?.cargo ?? '';
  const initialModulos = user
    ? parseModulosFromNivelAcesso(user.nivel_acesso, user.cargo)
    : defaultModulosForCargo('Gerente');

  const [form, setForm] = useState({
    nome: user?.nome ?? '',
    email: user?.email ?? '',
    telefone: user?.telefone ? maskPhoneInput(user.telefone) : '',
    cpf: user ? formatCpf(user.cpf) : '',
    endereco: user ? buildEndereco(user) : '',
    cargo: initialCargo,
    senha: '',
  });
  const [modulos, setModulos] = useState<PortalModuleId[]>(initialModulos);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const managerCargo = canManageUsers(form.cargo);

  const moduleOptions = useMemo(
    () => PORTAL_MODULES.filter((mod) => mod.id !== 'administrador' || managerCargo),
    [managerCargo],
  );

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCargoChange = (cargo: string) => {
    updateField('cargo', cargo);
    setModulos((prev) => {
      const next = prev.length ? prev : defaultModulosForCargo(cargo);
      if (!canManageUsers(cargo)) {
        return next.filter((id) => id !== 'administrador');
      }
      return next;
    });
  };

  const toggleModulo = (id: PortalModuleId) => {
    setModulos((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const generatePassword = () => {
    updateField('senha', Math.random().toString(36).substring(2, 10));
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.cpf.trim() || !form.cargo) {
      setError('Preencha nome, CPF e cargo.');
      return;
    }
    if (!isEdit && !form.senha.trim()) {
      setError('Informe ou gere uma senha para o novo usuário.');
      return;
    }
    if (modulos.length === 0) {
      setError('Selecione ao menos um balão/módulo de acesso.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit && user) {
        await updateUser(user.id, {
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
          cpf: form.cpf,
          cargo: form.cargo,
          endereco: form.endereco,
          senha: form.senha.trim() || undefined,
          modulos,
        });
      } else {
        await saveUser({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
          cpf: form.cpf,
          senha: form.senha,
          cargo: form.cargo,
          endereco: form.endereco,
          modulos,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="form-modal usuario-form-modal">
      <div className="colab-modal-header">
        <h2>{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h2>
        <p>Cadastre dados e escolha os balões que este usuário poderá acessar</p>
      </div>

      <div className="colab-form">
        <label className="colab-field full">
          <span>Nome completo</span>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => updateField('nome', e.target.value)}
            placeholder="Nome completo"
          />
        </label>

        <label className="colab-field full">
          <span>E-mail</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="E-mail"
          />
        </label>

        <label className="colab-field full">
          <span>Telefone</span>
          <input
            type="text"
            value={form.telefone}
            onChange={(e) => updateField('telefone', maskPhoneInput(e.target.value))}
            placeholder="Telefone"
          />
        </label>

        <label className="colab-field full">
          <span>CPF</span>
          <input
            type="text"
            value={form.cpf}
            onChange={(e) => updateField('cpf', maskCpfInput(e.target.value))}
            placeholder="CPF"
          />
        </label>

        <label className="colab-field full">
          <span>Endereço</span>
          <input
            type="text"
            value={form.endereco}
            onChange={(e) => updateField('endereco', e.target.value)}
            placeholder="Cidade, UF"
          />
        </label>

        <label className="colab-field full">
          <span>Cargo</span>
          <div className="colab-select-wrap">
            <select value={form.cargo} onChange={(e) => handleCargoChange(e.target.value)}>
              <option value="">Selecionar o cargo</option>
              {USER_FORM_CARGOS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="colab-field full">
          <span>{isEdit ? 'Nova senha (opcional)' : 'Senha'}</span>
          <div className="colab-password-wrap">
            <input
              type="text"
              placeholder={isEdit ? 'Deixe em branco para manter' : 'Senha ou clique para gerar'}
              value={form.senha}
              onChange={(e) => updateField('senha', e.target.value)}
            />
            <button type="button" className="colab-generate-btn" onClick={generatePassword} aria-label="Gerar senha">
              ↻
            </button>
          </div>
        </label>

        <fieldset className="colab-field full usuario-modulos-field">
          <legend>Balões / seções de acesso</legend>
          <p className="usuario-modulos-hint">
            Marque os módulos do portal que este usuário poderá ver.
            {managerCargo
              ? ' Administrador fica disponível para Gerente, CEO, Presidente e Dono.'
              : ' O balão Administrador só pode ser liberado para Gerente, CEO ou Presidente.'}
          </p>
          <div className="usuario-modulos-grid">
            {moduleOptions.map((mod) => {
              const checked = modulos.includes(mod.id);
              return (
                <label key={mod.id} className={`usuario-modulo-chip ${checked ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModulo(mod.id)}
                  />
                  <span className="usuario-modulo-icon" aria-hidden>
                    {mod.icon}
                  </span>
                  <span>
                    <strong>{mod.title}</strong>
                    <small>{mod.description}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      {error && <p className="colab-form-error">{error}</p>}

      <div className="colab-modal-actions">
        <button type="button" className="colab-btn-save" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
        </button>
        <button type="button" className="colab-btn-cancel" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </ModalShell>
  );
}
