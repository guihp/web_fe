export const PORTAL_MODULE_IDS = [
  'treinamentos',
  'atividades',
  'vendas',
  'financeiro',
  'administrador',
] as const;

export type PortalModuleId = (typeof PORTAL_MODULE_IDS)[number];

export type PortalModuleDef = {
  id: PortalModuleId;
  title: string;
  description: string;
  badge: string;
  icon: string;
  path: string;
};

export const PORTAL_MODULES: PortalModuleDef[] = [
  {
    id: 'treinamentos',
    title: 'Treinamentos',
    description: 'Materiais, vídeos e capacitação da equipe.',
    badge: 'Capacitação',
    icon: '💼',
    path: '/treinamento',
  },
  {
    id: 'atividades',
    title: 'Atividade',
    description: 'Controle de visitas e ações de merchandising em PDVs.',
    badge: 'Operação',
    icon: '📋',
    path: '/atividades',
  },
  {
    id: 'vendas',
    title: 'Vendas',
    description: 'Gestão completa de vendas, clientes e metas comerciais.',
    badge: 'Comercial',
    icon: '🛒',
    path: '/vendas',
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Gestão de comissões e relatórios financeiros.',
    badge: 'Financeiro',
    icon: '💵',
    path: '/financeiro',
  },
  {
    id: 'administrador',
    title: 'Administrador',
    description: 'Gestão de usuários, empresas, regionais e indústrias.',
    badge: 'Admin',
    icon: '🛡️',
    path: '/administrador',
  },
];

/** Cargos que podem gerenciar usuários e ver o balão Administrador. */
export const USER_MANAGER_CARGOS = ['Gerente', 'CEO', 'Presidente', 'Dono'] as const;

export const USER_FORM_CARGOS = [
  'Dono',
  'Presidente',
  'CEO',
  'Gerente',
  'Vendedor',
  'Promotor',
  'Degustação',
] as const;

function normalizeCargoKey(cargo: string) {
  return cargo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function canManageUsers(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const key = normalizeCargoKey(cargo);
  return USER_MANAGER_CARGOS.some((c) => normalizeCargoKey(c) === key);
}

export function defaultModulosForCargo(cargo: string): PortalModuleId[] {
  if (canManageUsers(cargo)) {
    return [...PORTAL_MODULE_IDS];
  }
  return PORTAL_MODULE_IDS.filter((id) => id !== 'administrador');
}

export function sanitizeModulos(
  cargo: string,
  modulos: string[] | null | undefined,
): PortalModuleId[] {
  const allowed = new Set<string>(PORTAL_MODULE_IDS);
  const picked = (modulos ?? [])
    .map((m) => m.trim().toLowerCase())
    .filter((m): m is PortalModuleId => allowed.has(m));

  const unique = [...new Set(picked)];
  if (unique.length === 0) {
    return defaultModulosForCargo(cargo);
  }

  if (!canManageUsers(cargo)) {
    return unique.filter((id) => id !== 'administrador');
  }

  return unique;
}

type NivelAcessoJson = {
  perfil?: string;
  modulos?: string[];
};

export function nivelAcessoLabelPorCargo(cargo: string) {
  if (canManageUsers(cargo)) return 'Tela Padrão Gerente';
  if (normalizeCargoKey(cargo) === 'promotor') return 'Tela Padrão Promotor';
  return 'Tela Padrão Promotor';
}

/** Persiste perfil + módulos no campo texto nivel_acesso (JSON). */
export function encodeNivelAcesso(cargo: string, modulos: string[]): string {
  const clean = sanitizeModulos(cargo, modulos);
  return JSON.stringify({
    perfil: nivelAcessoLabelPorCargo(cargo),
    modulos: clean,
  } satisfies NivelAcessoJson);
}

export function parseModulosFromNivelAcesso(
  nivelAcesso: string | null | undefined,
  cargo: string,
): PortalModuleId[] {
  if (!nivelAcesso?.trim()) {
    return defaultModulosForCargo(cargo);
  }

  const raw = nivelAcesso.trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as NivelAcessoJson;
      if (Array.isArray(parsed.modulos)) {
        return sanitizeModulos(cargo, parsed.modulos);
      }
    } catch {
      /* legado */
    }
  }

  return defaultModulosForCargo(cargo);
}

/** Mapeia rotas do app para o balão do portal. */
export function moduleIdForPath(pathname: string): PortalModuleId | 'home' | null {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/treinamento')) return 'treinamentos';
  if (pathname.startsWith('/atividades')) return 'atividades';
  if (pathname.startsWith('/financeiro')) return 'financeiro';
  if (pathname.startsWith('/administrador') || pathname.startsWith('/colaboradores')) {
    return 'administrador';
  }
  if (
    pathname.startsWith('/vendas') ||
    pathname.startsWith('/lancamento') ||
    pathname.startsWith('/clientes') ||
    pathname.startsWith('/base-') ||
    pathname.startsWith('/relatorios') ||
    pathname.startsWith('/projecao-metas') ||
    pathname.startsWith('/comissao')
  ) {
    return 'vendas';
  }
  return null;
}

export function userHasModuleAccess(
  cargo: string,
  modulos: string[] | null | undefined,
  moduleId: PortalModuleId,
): boolean {
  if (moduleId === 'administrador' && !canManageUsers(cargo)) {
    return false;
  }
  const resolved = sanitizeModulos(cargo, modulos?.length ? modulos : defaultModulosForCargo(cargo));
  return resolved.includes(moduleId);
}
