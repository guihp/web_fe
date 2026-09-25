import { useEffect, useMemo, useState } from 'react';
import {
  brDateToIso,
  isoDateToBr,
  maskCpfInput,
  maskDateBrInput,
  maskPhoneInput,
} from '../../lib/cpf';
import {
  ALWAYS_AVAILABLE_SECTION_IDS,
  PORTAL_MODULES,
  USER_FORM_CARGOS,
  canManageUsers,
  defaultSecoesForCargo,
  isCampoMerchCargo,
  parseSecoesFromNivelAcesso,
  sectionsOfModule,
  type PortalModuleId,
} from '../../data/portalModules';
import {
  HUB_SISTEMAS,
  defaultHubSecoesForSistemas,
  type HubSistemaId,
} from '../../data/hubPermissions';
import { useAuth } from '../../context/AuthContext';
import { saveUser, updateUser } from '../../services/userService';
import { fetchHubPermissions } from '../../services/hubPermissionsService';
import { fetchIndustrias, fetchIndustriasAtivas } from '../../services/industriaService';
import { fetchLojas, type Loja } from '../../services/lojasService';
import {
  MAX_USUARIO_LOJAS,
  fetchUsuarioLojaIds,
  formatUsuarioLojaLabel,
} from '../../services/usuarioLojasService';
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
  const { user: currentUser } = useAuth();
  const canEditHub = Boolean(currentUser?.is_super_admin);
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
    dataNascimento: isoDateToBr(user?.data_nascimento),
  });
  const [industrias, setIndustrias] = useState<IndustriaOpt[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaIds, setLojaIds] = useState<number[]>([]);
  const [lojaSearch, setLojaSearch] = useState('');
  const [secoes, setSecoes] = useState<string[]>(initialSecoes);
  const [isSuperAdmin, setIsSuperAdmin] = useState(Boolean(user?.is_super_admin));
  const [hubSistemas, setHubSistemas] = useState<HubSistemaId[]>([]);
  const [hubSecoes, setHubSecoes] = useState<string[]>([]);
  const [hubExpanded, setHubExpanded] = useState<Record<string, boolean>>({});
  const [hubLoading, setHubLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const externo = isExternalTipo(tipo);
  const managerCargo = canManageUsers(form.cargo);
  const campoMerch = !externo && isCampoMerchCargo(form.cargo);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchIndustriasAtivas();
        const list = data
          .map((row) => ({
            id: row.id,
            nome: toIndustriaPadrao(row.Nome ?? ''),
          }))
          .filter((r) => r.nome);

        const currentId = user?.industria_id;
        if (currentId && !list.some((r) => r.id === currentId)) {
          const all = await fetchIndustrias();
          const current = all.find((r) => r.id === currentId);
          if (current?.Nome) {
            list.push({ id: current.id, nome: toIndustriaPadrao(current.Nome) });
            list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          }
        }

        setIndustrias(list);
      } catch {
        setIndustrias([]);
      }
    })();
  }, [user?.industria_id]);

  useEffect(() => {
    if (!campoMerch) return;
    void fetchLojas()
      .then((rows) => setLojas(rows.filter((l) => !l.status || l.status === 'Ativo')))
      .catch(() => setLojas([]));
  }, [campoMerch]);

  useEffect(() => {
    if (!isEdit || !user?.id || !isCampoMerchCargo(user.cargo)) return;
    void fetchUsuarioLojaIds(user.id)
      .then(setLojaIds)
      .catch(() => setLojaIds([]));
  }, [isEdit, user?.id, user?.cargo]);

  useEffect(() => {
    if (!user?.id || !canEditHub) return;
    setHubLoading(true);
    void (async () => {
      try {
        const perms = await fetchHubPermissions(user.id);
        setHubSistemas(perms.sistemas);
        setHubSecoes(
          perms.secoes.length ? perms.secoes : defaultHubSecoesForSistemas(perms.sistemas),
        );
      } catch {
        setHubSistemas([]);
        setHubSecoes([]);
      } finally {
        setHubLoading(false);
      }
    })();
  }, [user?.id, canEditHub]);

  const lojasFiltradas = useMemo(() => {
    const q = lojaSearch.trim().toLowerCase();
    const available = lojas.filter((l) => !lojaIds.includes(l.id));
    if (!q) return available.slice(0, 40);
    return available
      .filter((l) => {
        const label = formatUsuarioLojaLabel(l).toLowerCase();
        return label.includes(q);
      })
      .slice(0, 40);
  }, [lojas, lojaIds, lojaSearch]);

  const lojasSelecionadas = useMemo(
    () => lojas.filter((l) => lojaIds.includes(l.id)),
    [lojas, lojaIds],
  );

  const toggleLoja = (id: number) => {
    setLojaIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_USUARIO_LOJAS) {
        setError(`Máximo de ${MAX_USUARIO_LOJAS} lojas por promotor/demonstradora.`);
        return prev;
      }
      setError(null);
      return [...prev, id];
    });
  };

  const moduleOptions = useMemo(
    () =>
      PORTAL_MODULES.filter(
        (mod) => mod.id !== 'grupo-fe' && (mod.id !== 'administrador' || managerCargo),
      ),
    [managerCargo],
  );

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTipoChange = (next: TipoUsuario) => {
    setTipo(next);
    setError(null);
    if (next !== 'interno') {
      setIsSuperAdmin(false);
      setHubSistemas([]);
      setHubSecoes([]);
    }
    if (next === 'cliente' && !form.clienteGrupo && form.nome) {
      updateField('clienteGrupo', normalizeClienteGrupo(form.nome));
    }
  };

  const handleCargoChange = (cargo: string) => {
    updateField('cargo', cargo);
    if (!isCampoMerchCargo(cargo)) {
      setLojaIds([]);
      setLojaSearch('');
    }
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
    const hubId = `${moduleId}.hub`;
    if (ids.length === 0) return;
    setSecoes((prev) => {
      // Qualquer seção ou o hub órfão: um clique apaga o balão inteiro.
      const anyOn = prev.includes(hubId) || ids.some((id) => prev.includes(id));
      if (anyOn) return prev.filter((id) => id !== hubId && !ids.includes(id));
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

  const toggleHubSistema = (sistemaId: HubSistemaId) => {
    setHubSistemas((prev) => {
      const on = prev.includes(sistemaId);
      const next = on ? prev.filter((id) => id !== sistemaId) : [...prev, sistemaId];
      const sistemaSecoes =
        HUB_SISTEMAS.find((s) => s.id === sistemaId)?.secoes.map((s) => s.id) ?? [];
      setHubSecoes((prevSecoes) => {
        if (on) return prevSecoes.filter((id) => !sistemaSecoes.includes(id));
        return [...new Set([...prevSecoes, ...sistemaSecoes])];
      });
      if (!on) setHubExpanded((prevExp) => ({ ...prevExp, [sistemaId]: true }));
      return next;
    });
  };

  const toggleHubSecao = (secaoId: string, sistemaId: HubSistemaId) => {
    setHubSecoes((prev) => {
      const on = prev.includes(secaoId);
      const next = on ? prev.filter((id) => id !== secaoId) : [...prev, secaoId];
      if (!on) {
        setHubSistemas((prevSys) =>
          prevSys.includes(sistemaId) ? prevSys : [...prevSys, sistemaId],
        );
      }
      return next;
    });
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
    if (!form.dataNascimento.trim()) {
      setError('Informe a data de nascimento.');
      return;
    }
    const dataNascimentoIso = brDateToIso(form.dataNascimento);
    if (!dataNascimentoIso) {
      setError('Data de nascimento inválida. Use DD/MM/AAAA.');
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
      if (isCampoMerchCargo(form.cargo) && lojaIds.length === 0) {
        setError('Selecione ao menos uma loja para Promotor/Demonstradora.');
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
        data_nascimento: dataNascimentoIso,
        lojaIds: isCampoMerchCargo(form.cargo) ? lojaIds : [],
        ...(canEditHub && tipo === 'interno'
          ? {
              is_super_admin: isSuperAdmin,
              hub_sistemas: isSuperAdmin ? [] : hubSistemas,
              hub_secoes: isSuperAdmin ? [] : hubSecoes,
            }
          : {}),
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
          Internos usam CPF. Externos: indústria (login pelo nome) ou cliente (login pelo CNPJ),
          Merchandising (Validades + Atividades) e Fé Representações (Price + Sucesso), em modo
          visualização, só da própria empresa.
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
              <option value="industria">Externo: Indústria</option>
              <option value="cliente">Externo: Cliente</option>
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

        <label className="colab-field full">
          <span>Data de nascimento</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.dataNascimento}
            onChange={(e) => updateField('dataNascimento', maskDateBrInput(e.target.value))}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            required
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

            {campoMerch && (
              <fieldset className="colab-field full usuario-lojas-field">
                <legend>
                  Lojas do roteiro ({lojaIds.length}/{MAX_USUARIO_LOJAS})
                </legend>
                <p className="usuario-modulos-hint">
                  Escolha até {MAX_USUARIO_LOJAS} PDVs. Cidade e estado vêm da tabela de lojas no
                  check-in (sem GPS por enquanto).
                </p>
                {lojasSelecionadas.length > 0 && (
                  <ul className="usuario-lojas-chips">
                    {lojasSelecionadas.map((loja) => (
                      <li key={loja.id}>
                        <button type="button" onClick={() => toggleLoja(loja.id)}>
                          {formatUsuarioLojaLabel(loja)} ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {lojaIds.length < MAX_USUARIO_LOJAS && (
                  <>
                    <input
                      type="search"
                      value={lojaSearch}
                      onChange={(e) => setLojaSearch(e.target.value)}
                      placeholder="Buscar loja por nome, código ou cidade"
                    />
                    <ul className="usuario-lojas-options">
                      {lojasFiltradas.map((loja) => (
                        <li key={loja.id}>
                          <button type="button" onClick={() => toggleLoja(loja.id)}>
                            {formatUsuarioLojaLabel(loja)}
                          </button>
                        </li>
                      ))}
                      {lojasFiltradas.length === 0 && (
                        <li className="usuario-lojas-empty">Nenhuma loja encontrada.</li>
                      )}
                    </ul>
                  </>
                )}
              </fieldset>
            )}
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
            <button
              type="button"
              className="colab-generate-btn"
              onClick={generatePassword}
              aria-label="Gerar senha"
            >
              ↻
            </button>
          </div>
        </label>

        {canEditHub && tipo === 'interno' && (
          <fieldset className="colab-field full usuario-modulos-field">
            <legend>Grupo Fé (hub multi-sistema)</legend>
            <p className="usuario-modulos-hint">
              Só admin supremo edita estas opções. Admin supremo vê todos os sistemas; demais
              usuários só os liberados abaixo.
            </p>
            <label className="usuario-modulo-chip" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={isSuperAdmin}
                onChange={(e) => setIsSuperAdmin(e.target.checked)}
              />
              <span>
                <strong>Admin supremo</strong>
                <small>Acesso total ao Hub Grupo Fé e à liberação de sistemas</small>
              </span>
            </label>

            {!isSuperAdmin &&
              (hubLoading ? (
                <p className="usuario-modulos-hint">Carregando permissões do hub…</p>
              ) : (
                <div className="usuario-modulos-grid">
                  {HUB_SISTEMAS.map((sistema) => {
                    const checked = hubSistemas.includes(sistema.id);
                    const sistemaSecoes = sistema.secoes.map((s) => s.id);
                    const partial =
                      !checked &&
                      sistemaSecoes.some((id) => hubSecoes.includes(id)) &&
                      !sistemaSecoes.every((id) => hubSecoes.includes(id));
                    const isOpen = hubExpanded[sistema.id] ?? (checked || partial);

                    return (
                      <div
                        key={sistema.id}
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
                              onChange={() => toggleHubSistema(sistema.id)}
                            />
                            <span>
                              <strong>{sistema.nome}</strong>
                              <small>{sistema.descricao}</small>
                            </span>
                          </label>
                          <button
                            type="button"
                            className="usuario-modulo-expand"
                            onClick={() =>
                              setHubExpanded((prev) => ({
                                ...prev,
                                [sistema.id]: !isOpen,
                              }))
                            }
                            aria-expanded={isOpen}
                          >
                            {isOpen ? '▾' : '▸'} Seções
                          </button>
                        </div>
                        {isOpen && (
                          <div className="usuario-secoes-grid">
                            {sistema.secoes.map((secao) => {
                              const sectionOn = hubSecoes.includes(secao.id);
                              return (
                                <label
                                  key={secao.id}
                                  className={`usuario-secao-chip ${sectionOn ? 'active' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={sectionOn}
                                    onChange={() => toggleHubSecao(secao.id, sistema.id)}
                                  />
                                  <span>{secao.title}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
          </fieldset>
        )}

        {!externo && (
          <fieldset className="colab-field full usuario-modulos-field">
            <legend>Balões / seções de acesso</legend>
            <p className="usuario-modulos-hint">
              Em <strong>Fé Representações</strong>, abra <em>Seções</em> para liberar só Price e
              Sucesso, ou marcar telas de Vendas uma a uma. Externos (ao salvar como indústria/cliente)
              recebem automaticamente Merchandising (Validades + Atividades) e Fé Representações (Price
              + Sucesso), somente leitura, sem Vendas.
            </p>
            <div className="usuario-modulos-grid">
              {moduleOptions.map((mod) => {
                const checked = isModuleChecked(mod.id);
                const partial = isModulePartial(mod.id);
                const isOpen = expanded[mod.id] ?? (partial || checked);
                const visibleSections = mod.sections.filter(
                  (s) => !s.id.endsWith('.hub') && s.id !== 'fe-representacoes.avisos',
                );
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
            Acesso fixo: <strong>Validades</strong> + <strong>Atividades</strong> (Merchandising) e{' '}
            <strong>Price</strong> + <strong>Sucesso do cliente</strong> (Fé Representações), somente
            visualização do que for desta indústria/cliente.
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
