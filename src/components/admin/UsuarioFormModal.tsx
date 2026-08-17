import { useEffect, useMemo, useState } from 'react';
import { maskCpfInput, maskPhoneInput } from '../../lib/cpf';
import {
  ALWAYS_AVAILABLE_SECTION_IDS,
  PORTAL_MODULES,
  USER_FORM_CARGOS,
  canManageUsers,
  defaultSecoesForCargo,
  parseSecoesFromNivelAcesso,
  sectionsOfModule,
  type PortalModuleId,
} from '../../data/portalModules';
import { saveUser, updateUser } from '../../services/userService';
import { supabase } from '../../lib/supabase';
import type { Usuario } from '../../utils/format';
import { formatCpf } from '../../utils/format';
import {
  isExternalTipo,
  maskCnpjInput,
  normalizeClienteGrupo,
  type TipoUsuario,
} from '../../utils/externalAccess';
import { toIndustriaPadrao } from '../../utils/vendasDomain';
import AppIcon from '../icons/AppIcon';
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

type IndustriaOpt = { id: number; nome: string };

export default function UsuarioFormModal({ user, onClose, onSuccess }: UsuarioFormModalProps) {
  const isEdit = Boolean(user);
  const initialTipo: TipoUsuario =
    user?.tipo_usuario === 'industria' || user?.tipo_usuario === 'cliente'
      ? user.tipo_usuario
      : 'interno';
  const initialCargo = user?.cargo ?? '';
  const initialSecoes = user
    ? parseSecoesFromNivelAcesso(user.nivel_acesso, user.cargo)
    : defaultSecoesForCargo('Gerente');

  const [tipo, setTipo] = useState<TipoUsuario>(initialTipo);
  const [form, setForm] = useState({
    nome: user?.nome ?? '',
    email: user?.email ?? '',
    telefone: user?.telefone ? maskPhoneInput(user.telefone) : '',
    cpf: user?.cpf ? formatCpf(user.cpf) : '',
    endereco: user ? buildEndereco(user) : '',
    cargo: initialCargo,
    senha: '',
    industriaId: user?.industria_id ? String(user.industria_id) : '',
    clienteGrupo: user?.cliente_grupo ?? '',
    loginCnpj: user?.login_cnpj ? maskCnpjInput(user.login_cnpj) : '',
  });
  const [industrias, setIndustrias] = useState<IndustriaOpt[]>([]);
  const [secoes, setSecoes] = useState<string[]>(initialSecoes);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const externo = isExternalTipo(tipo);
  const managerCargo = canManageUsers(form.cargo);

  useEffect(() => {
    void supabase
      .from('industrias')
      .select('id, "Nome"')
      .order('Nome')
      .then(({ data }) => {
        setIndustrias(
          (data ?? [])
            .map((row) => ({
              id: Number(row.id),
              nome: toIndustriaPadrao(String((row as { Nome?: string }).Nome ?? '')),
            }))
            .filter((r) => r.nome),
        );
      });
  }, []);

  const moduleOptions = useMemo(
    () => PORTAL_MODULES.filter((mod) => mod.id !== 'administrador' || managerCargo),
    [managerCargo],
  );

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTipoChange = (next: TipoUsuario) => {
    setTipo(next);
    setError(null);
    if (next === 'cliente' && !form.clienteGrupo && form.nome) {
      updateField('clienteGrupo', normalizeClienteGrupo(form.nome));
    }
  };

  const handleCargoChange = (cargo: string) => {
    updateField('cargo', cargo);
    setSecoes((prev) => {
      const next = prev.length ? prev : defaultSecoesForCargo(cargo);
      if (!canManageUsers(cargo)) {
        return next.filter((id) => !id.startsWith('administrador.'));
      }
      return next;
    });
  };

  const sectionIdsOf = (moduleId: PortalModuleId) =>
    sectionsOfModule(moduleId)
      .filter((s) => !s.id.endsWith('.hub'))
      .map((s) => s.id);

  const isAlwaysSection = (sectionId: string) =>
    (ALWAYS_AVAILABLE_SECTION_IDS as readonly string[]).includes(sectionId);

  const isModuleChecked = (moduleId: PortalModuleId) => {
    const ids = sectionIdsOf(moduleId);
    return ids.length > 0 && ids.every((id) => secoes.includes(id) || isAlwaysSection(id));
  };

  const isModulePartial = (moduleId: PortalModuleId) => {
    const ids = sectionIdsOf(moduleId);
    const count = ids.filter((id) => secoes.includes(id) || isAlwaysSection(id)).length;
    return count > 0 && count < ids.length;
  };

  const toggleModule = (moduleId: PortalModuleId) => {
    const ids = sectionIdsOf(moduleId).filter((id) => !isAlwaysSection(id));
    if (ids.length === 0) return;
    setSecoes((prev) => {
      const allOn = ids.every((id) => prev.includes(id));
      if (allOn) {
        return prev.filter((id) => !ids.includes(id));
      }
      return [...new Set([...prev, ...ids])];
    });
    setExpanded((prev) => ({ ...prev, [moduleId]: true }));
  };

  const toggleSection = (sectionId: string) => {
    if (isAlwaysSection(sectionId)) return;
    setSecoes((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  const generatePassword = () => {
    updateField('senha', Math.random().toString(36).substring(2, 10));
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      setError('Informe o nome.');
      return;
    }
    if (!isEdit && !form.senha.trim()) {
      setError('Informe ou gere uma senha para o novo usuário.');
      return;
    }

    if (tipo === 'interno') {
      if (!form.cpf.trim() || !form.cargo) {
        setError('Preencha CPF e cargo para usuário interno.');
        return;
      }
      if (secoes.length === 0) {
        setError('Selecione ao menos uma seção de acesso.');
        return;
      }
    }
    if (tipo === 'industria' && !form.industriaId) {
      setError('Selecione a indústria.');
      return;
    }
    if (tipo === 'cliente') {
      if (!form.loginCnpj.trim()) {
        setError('Informe o CNPJ de login do cliente.');
        return;
      }
      if (!normalizeClienteGrupo(form.clienteGrupo || form.nome)) {
        setError('Informe o grupo (ex.: MATEUS).');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        cpf: form.cpf,
        cargo: form.cargo,
        endereco: form.endereco,
        secoes,
        tipo_usuario: tipo,
        industria_id: tipo === 'industria' ? Number(form.industriaId) : null,
        cliente_grupo:
          tipo === 'cliente' ? normalizeClienteGrupo(form.clienteGrupo || form.nome) : null,
        login_cnpj: tipo === 'cliente' ? form.loginCnpj : null,
      };

      if (isEdit && user) {
        await updateUser(user.id, {
          ...payload,
          senha: form.senha.trim() || undefined,
        });
      } else {
        await saveUser({
          ...payload,
          senha: form.senha,
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
        <p>
          Internos usam CPF. Externos: indústria (login pelo nome) ou cliente (login pelo CNPJ) —
          só Validades e Sucesso do cliente, em modo visualização.
        </p>
      </div>

      <div className="colab-form">
        <label className="colab-field full">
          <span>Tipo de usuário</span>
          <div className="colab-select-wrap">
            <select
              value={tipo}
              onChange={(e) => handleTipoChange(e.target.value as TipoUsuario)}
              disabled={isEdit}
            >
              <option value="interno">Interno (equipe)</option>
              <option value="industria">Externo — Indústria</option>
              <option value="cliente">Externo — Cliente</option>
            </select>
          </div>
        </label>

        <label className="colab-field full">
          <span>Nome {tipo === 'cliente' ? '/ identificação' : 'completo'}</span>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => {
              updateField('nome', e.target.value);
              if (tipo === 'cliente' && !form.clienteGrupo) {
                updateField('clienteGrupo', normalizeClienteGrupo(e.target.value));
              }
            }}
            placeholder={tipo === 'cliente' ? 'Ex.: ARMAZÉM MATEUS CD 116' : 'Nome completo'}
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

        {tipo === 'interno' && (
          <>
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
                  <option value="" disabled>
                    Selecionar o cargo
                  </option>
                  {USER_FORM_CARGOS.map((cargo) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </>
        )}

        {tipo === 'industria' && (
          <label className="colab-field full">
            <span>Indústria (login pelo nome)</span>
            <div className="colab-select-wrap">
              <select
                value={form.industriaId}
                onChange={(e) => updateField('industriaId', e.target.value)}
              >
                <option value="">Selecione</option>
                {industrias.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.nome}
                  </option>
                ))}
              </select>
            </div>
          </label>
        )}

        {tipo === 'cliente' && (
          <>
            <label className="colab-field full">
              <span>Grupo de lojas (filtro por nome)</span>
              <input
                type="text"
                value={form.clienteGrupo}
                onChange={(e) => updateField('clienteGrupo', e.target.value.toUpperCase())}
                placeholder="Ex.: MATEUS"
              />
              <small className="usuario-modulos-hint">
                Verá validades e pedidos cujo nome de loja/cliente contém este grupo (todas as lojas
                Mateus, por exemplo).
              </small>
            </label>
            <label className="colab-field full">
              <span>CNPJ de login</span>
              <input
                type="text"
                value={form.loginCnpj}
                onChange={(e) => updateField('loginCnpj', maskCnpjInput(e.target.value))}
                placeholder="00.000.000/0000-00"
              />
            </label>
          </>
        )}

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

        {!externo && (
          <fieldset className="colab-field full usuario-modulos-field">
            <legend>Balões / seções de acesso</legend>
            <p className="usuario-modulos-hint">
              Externos recebem automaticamente só Validades e Sucesso do cliente (somente leitura).
            </p>
            <div className="usuario-modulos-grid">
              {moduleOptions.map((mod) => {
                const checked = isModuleChecked(mod.id);
                const partial = isModulePartial(mod.id);
                const isOpen = expanded[mod.id] ?? (partial || checked);
                const visibleSections = mod.sections.filter((s) => !s.id.endsWith('.hub'));
                const hasManySections = visibleSections.length > 1;

                return (
                  <div
                    key={mod.id}
                    className={`usuario-modulo-block ${checked || partial ? 'active' : ''}`}
                  >
                    <div className="usuario-modulo-chip-row">
                      <label className="usuario-modulo-chip">
                        <input
                          type="checkbox"
                          checked={checked}
                          ref={(el) => {
                            if (el) el.indeterminate = partial && !checked;
                          }}
                          onChange={() => toggleModule(mod.id)}
                        />
                        <span className="usuario-modulo-icon" aria-hidden>
                          <AppIcon name={mod.icon} size={18} />
                        </span>
                        <span>
                          <strong>{mod.title}</strong>
                          <small>{mod.description}</small>
                        </span>
                      </label>
                      {hasManySections && (
                        <button
                          type="button"
                          className="usuario-modulo-expand"
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [mod.id]: !isOpen }))
                          }
                          aria-expanded={isOpen}
                        >
                          {isOpen ? '▾' : '▸'} Seções
                        </button>
                      )}
                    </div>

                    {hasManySections && isOpen && (
                      <div className="usuario-secoes-grid">
                        {visibleSections.map((section) => {
                          const alwaysSection = isAlwaysSection(section.id);
                          const sectionOn = alwaysSection || secoes.includes(section.id);
                          return (
                            <label
                              key={section.id}
                              className={`usuario-secao-chip ${sectionOn ? 'active' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={sectionOn}
                                disabled={alwaysSection}
                                onChange={() => toggleSection(section.id)}
                              />
                              <span aria-hidden>
                                <AppIcon name={section.icon ?? 'clipboard'} size={16} />
                              </span>
                              <span>
                                {section.title}
                                {alwaysSection ? ' (todos)' : ''}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        {externo && (
          <p className="usuario-modulos-hint">
            Acesso fixo: <strong>Validades</strong> + <strong>Sucesso do cliente</strong> (somente
            visualização do que for desta indústria/cliente).
          </p>
        )}
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
