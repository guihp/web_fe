export const PORTAL_MODULE_IDS = [
  'merchandising',
  'vendas',
  'financeiro',
  'administrador',
] as const;

export type PortalModuleId = (typeof PORTAL_MODULE_IDS)[number];

/** Módulos liberados para todos os usuários autenticados (não dependem de nível_acesso). */
export const ALWAYS_AVAILABLE_MODULE_IDS: readonly PortalModuleId[] = [];

export const ALWAYS_AVAILABLE_SECTION_IDS = ['validades.home'] as const;

/** IDs antigos de módulo → seções (compatível com nivel_acesso legado). */
const LEGACY_MODULE_SECTIONS: Record<string, string[]> = {
  treinamentos: ['treinamentos.home'],
  atividades: ['atividades.home'],
  validades: ['validades.home'],
};

export type PortalSectionDef = {
  id: string;
  title: string;
  path: string;
  icon?: string;
};

export type PortalModuleDef = {
  id: PortalModuleId;
  title: string;
  description: string;
  badge: string;
  icon: string;
  path: string;
  sections: PortalSectionDef[];
};

export const PORTAL_MODULES: PortalModuleDef[] = [
  {
    id: 'merchandising',
    title: 'Merchandising',
    description: 'Treinamentos, atividades, validades e Price.',
    badge: 'Operação',
    icon: '🛍️',
    path: '/merchandising',
    sections: [
      { id: 'merchandising.hub', title: 'Hub Merchandising', path: '/merchandising', icon: '🛍️' },
      { id: 'treinamentos.home', title: 'Treinamentos', path: '/treinamento', icon: '💼' },
      { id: 'atividades.home', title: 'Atividades', path: '/atividades', icon: '📋' },
      { id: 'validades.home', title: 'Validades', path: '/validades', icon: '📅' },
      { id: 'merchandising.price', title: 'Price', path: '/administrador/price', icon: '🏷️' },
    ],
  },
  {
    id: 'vendas',
    title: 'Vendas',
    description: 'Gestão completa de vendas, clientes e metas comerciais.',
    badge: 'Comercial',
    icon: '🛒',
    path: '/vendas',
    sections: [
      { id: 'vendas.relatorios', title: 'Relatórios', path: '/relatorios', icon: '📊' },
      { id: 'vendas.projecao-metas', title: 'Projeção de metas', path: '/projecao-metas', icon: '🎯' },
      { id: 'vendas.comissao', title: 'Comissão', path: '/comissao', icon: '💵' },
      { id: 'vendas.dashboard', title: 'Vendas', path: '/vendas', icon: '🛒' },
      { id: 'vendas.lancamento', title: 'Lançamento de vendas', path: '/lancamento', icon: '💰' },
      { id: 'vendas.clientes', title: 'Cadastro de clientes', path: '/clientes', icon: '🏢' },
      { id: 'vendas.base-clientes', title: 'Base de clientes', path: '/base-clientes', icon: '📋' },
      { id: 'vendas.base-vendas', title: 'Base de dados', path: '/base-vendas', icon: '🗃️' },
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Gestão de comissões e relatórios financeiros.',
    badge: 'Financeiro',
    icon: '💵',
    path: '/financeiro',
    sections: [
      { id: 'financeiro.home', title: 'Financeiro', path: '/financeiro', icon: '💵' },
    ],
  },
  {
    id: 'administrador',
    title: 'Administrador',
    description: 'Gestão de usuários, empresas, regionais e indústrias.',
    badge: 'Admin',
    icon: '🛡️',
    path: '/administrador',
    sections: [
      { id: 'administrador.hub', title: 'Hub Administrador', path: '/administrador', icon: '🛡️' },
      { id: 'administrador.usuarios', title: 'Usuários', path: '/administrador/usuarios', icon: '👤' },
      {
        id: 'administrador.sucesso',
        title: 'Sucesso do cliente',
        path: '/administrador/perfis',
        icon: '✅',
      },
      {
        id: 'administrador.price',
        title: 'Price',
        path: '/administrador/price',
        icon: '💼',
      },
      { id: 'administrador.empresa', title: 'Empresa', path: '/administrador/empresa', icon: '🏢' },
      {
        id: 'administrador.regionais',
        title: 'Regionais',
        path: '/administrador/regionais',
        icon: '📍',
      },
      { id: 'administrador.filiais', title: 'Filiais', path: '/administrador/filiais', icon: '🏪' },
      {
        id: 'administrador.industrias',
        title: 'Indústrias',
        path: '/administrador/industrias',
        icon: '🏭',
      },
      {
        id: 'administrador.clientes',
        title: 'Clientes',
        path: '/administrador/clientes',
        icon: '🪪',
      },
      { id: 'administrador.metas', title: 'Metas', path: '/administrador/metas', icon: '🎯' },
      {
        id: 'administrador.colaboradores',
        title: 'Colaboradores',
        path: '/colaboradores',
        icon: '👥',
      },
    ],
  },
];

export const ALL_SECTION_IDS = PORTAL_MODULES.flatMap((m) => m.sections.map((s) => s.id));

/** Cargos que podem gerenciar usuários e ver o balão Administrador. */
export const USER_MANAGER_CARGOS = ['Gerente'] as const;

export const USER_FORM_CARGOS = [
  'Gerente',
  'Supervisor',
  'Financeiro',
  'RH',
  'Analista admin',
  'Vendedor',
  'Promotor',
  'Demonstradora',
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

export function sectionsOfModule(moduleId: PortalModuleId): PortalSectionDef[] {
  return PORTAL_MODULES.find((m) => m.id === moduleId)?.sections ?? [];
}

export function moduleIdFromSection(sectionId: string): PortalModuleId | null {
  const mod = PORTAL_MODULES.find((m) => m.sections.some((s) => s.id === sectionId));
  return mod?.id ?? null;
}

export function defaultSecoesForCargo(cargo: string): string[] {
  if (canManageUsers(cargo)) {
    return [...ALL_SECTION_IDS];
  }
  return PORTAL_MODULES.filter((m) => m.id !== 'administrador').flatMap((m) =>
    m.sections.map((s) => s.id),
  );
}

/** @deprecated use defaultSecoesForCargo — mantido para compat. */
export function defaultModulosForCargo(cargo: string): PortalModuleId[] {
  if (canManageUsers(cargo)) return [...PORTAL_MODULE_IDS];
  return PORTAL_MODULE_IDS.filter((id) => id !== 'administrador');
}

export function sanitizeSecoes(cargo: string, secoes: string[] | null | undefined): string[] {
  const allowed = new Set(ALL_SECTION_IDS);
  const picked = [...new Set((secoes ?? []).map((s) => s.trim()).filter((s) => allowed.has(s)))];

  let next = picked;
  if (!canManageUsers(cargo)) {
    next = next.filter((id) => !id.startsWith('administrador.'));
  }

  // Sempre inclui módulos liberados para todos
  for (const id of ALWAYS_AVAILABLE_SECTION_IDS) {
    if (!next.includes(id)) next = [...next, id];
  }

  if (next.length === 0) {
    return defaultSecoesForCargo(cargo);
  }
  return next;
}

export function modulosFromSecoes(secoes: string[]): PortalModuleId[] {
  const set = new Set<PortalModuleId>();
  for (const sectionId of secoes) {
    const mod = moduleIdFromSection(sectionId);
    if (mod) set.add(mod);
  }
  return PORTAL_MODULE_IDS.filter((id) => set.has(id));
}

/** Expande legado (só módulos) para todas as seções desses módulos. */
export function expandModulosToSecoes(modulos: string[]): string[] {
  const set = new Set<string>();
  for (const raw of modulos) {
    const id = raw.trim().toLowerCase();
    const legacy = LEGACY_MODULE_SECTIONS[id];
    if (legacy) {
      for (const section of legacy) set.add(section);
      continue;
    }
    if ((PORTAL_MODULE_IDS as readonly string[]).includes(id)) {
      for (const section of sectionsOfModule(id as PortalModuleId)) set.add(section.id);
    } else if (ALL_SECTION_IDS.includes(raw.trim())) {
      set.add(raw.trim());
    }
  }
  return [...set];
}

export function sanitizeModulos(
  cargo: string,
  modulos: string[] | null | undefined,
): PortalModuleId[] {
  const secoes = sanitizeSecoes(cargo, expandModulosToSecoes(modulos ?? []));
  return modulosFromSecoes(secoes);
}

type NivelAcessoJson = {
  perfil?: string;
  modulos?: string[];
  secoes?: string[];
};

export function nivelAcessoLabelPorCargo(cargo: string) {
  if (canManageUsers(cargo)) return 'Tela Padrão Gerente';
  if (normalizeCargoKey(cargo) === 'promotor') return 'Tela Padrão Promotor';
  return 'Tela Padrão Promotor';
}

export type AcessoParsed = {
  modulos: PortalModuleId[];
  secoes: string[];
};

/** Persiste perfil + seções (e módulos derivados) no campo nivel_acesso. */
export function encodeNivelAcesso(cargo: string, secoesOrModulos: string[]): string {
  const looksLikeSections = secoesOrModulos.some((s) => s.includes('.'));
  const secoes = sanitizeSecoes(
    cargo,
    looksLikeSections ? secoesOrModulos : expandModulosToSecoes(secoesOrModulos),
  );
  const modulos = modulosFromSecoes(secoes);
  return JSON.stringify({
    perfil: nivelAcessoLabelPorCargo(cargo),
    modulos,
    secoes,
  } satisfies NivelAcessoJson);
}

export function parseAcessoFromNivelAcesso(
  nivelAcesso: string | null | undefined,
  cargo: string,
): AcessoParsed {
  if (!nivelAcesso?.trim()) {
    const secoes = defaultSecoesForCargo(cargo);
    return { secoes, modulos: modulosFromSecoes(secoes) };
  }

  const raw = nivelAcesso.trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as NivelAcessoJson;
      if (Array.isArray(parsed.secoes) && parsed.secoes.length > 0) {
        const secoes = sanitizeSecoes(cargo, parsed.secoes);
        return { secoes, modulos: modulosFromSecoes(secoes) };
      }
      if (Array.isArray(parsed.modulos) && parsed.modulos.length > 0) {
        const secoes = sanitizeSecoes(cargo, expandModulosToSecoes(parsed.modulos));
        return { secoes, modulos: modulosFromSecoes(secoes) };
      }
    } catch {
      /* legado */
    }
  }

  const secoes = defaultSecoesForCargo(cargo);
  return { secoes, modulos: modulosFromSecoes(secoes) };
}

export function parseModulosFromNivelAcesso(
  nivelAcesso: string | null | undefined,
  cargo: string,
): PortalModuleId[] {
  return parseAcessoFromNivelAcesso(nivelAcesso, cargo).modulos;
}

export function parseSecoesFromNivelAcesso(
  nivelAcesso: string | null | undefined,
  cargo: string,
): string[] {
  return parseAcessoFromNivelAcesso(nivelAcesso, cargo).secoes;
}

export function firstPathForModule(
  moduleId: PortalModuleId,
  secoes: string[] | null | undefined,
): string {
  const mod = PORTAL_MODULES.find((m) => m.id === moduleId);
  if (!mod) return '/';
  // Hubs abrem a página central do módulo
  if (moduleId === 'merchandising' || moduleId === 'administrador') {
    return mod.path;
  }
  if (ALWAYS_AVAILABLE_MODULE_IDS.includes(moduleId)) {
    return mod.path;
  }
  const granted = new Set(secoes ?? []);
  const hit = mod.sections.find((s) => granted.has(s.id));
  return hit?.path ?? mod.path;
}

/** Mapeia rota atual para o id da seção. */
/** Price existe nos hubs Merchandising e Administrador — qualquer uma das seções libera. */
const PRICE_SECTION_IDS = ['merchandising.price', 'administrador.price'] as const;

export function sectionIdForPath(pathname: string): string | 'home' | null {
  if (pathname === '/' || pathname === '') return 'home';

  const normalized = pathname.replace(/\/$/, '') || '/';

  // Mesma rota nos dois hubs; usa a seção operacional (não exige Gerente).
  if (normalized === '/administrador/price') {
    return 'merchandising.price';
  }

  if (
    normalized === '/administrador/perfis' ||
    normalized === '/administrador/sucesso-cliente'
  ) {
    return 'administrador.sucesso';
  }

  // Mais específico primeiro
  const allSections = PORTAL_MODULES.flatMap((m) => m.sections).sort(
    (a, b) => b.path.length - a.path.length,
  );

  for (const section of allSections) {
    if (normalized === section.path || normalized.startsWith(`${section.path}/`)) {
      return section.id;
    }
  }

  if (normalized.startsWith('/administrador')) return 'administrador.hub';
  return null;
}

/** @deprecated prefer sectionIdForPath */
export function moduleIdForPath(pathname: string): PortalModuleId | 'home' | null {
  const section = sectionIdForPath(pathname);
  if (section === 'home' || section == null) return section;
  return moduleIdFromSection(section);
}

export function userHasSectionAccess(
  cargo: string,
  secoes: string[] | null | undefined,
  sectionId: string,
): boolean {
  if ((ALWAYS_AVAILABLE_SECTION_IDS as readonly string[]).includes(sectionId)) {
    return true;
  }

  const resolved = sanitizeSecoes(
    cargo,
    secoes?.length ? secoes : defaultSecoesForCargo(cargo),
  );

  // Price: liberado se marcado em Merchandising ou em Administrador (antes do gate de Admin)
  if ((PRICE_SECTION_IDS as readonly string[]).includes(sectionId)) {
    return PRICE_SECTION_IDS.some((id) => resolved.includes(id));
  }

  if (sectionId.startsWith('administrador.') && !canManageUsers(cargo)) {
    return false;
  }

  // Hub Merchandising: acesso se tiver qualquer seção do módulo
  if (sectionId === 'merchandising.hub') {
    return sectionsOfModule('merchandising').some(
      (s) => s.id !== 'merchandising.hub' && resolved.includes(s.id),
    );
  }

  return resolved.includes(sectionId);
}

export function userHasModuleAccess(
  cargo: string,
  modulosOrSecoes: string[] | null | undefined,
  moduleId: PortalModuleId,
  secoes?: string[] | null,
): boolean {
  if (ALWAYS_AVAILABLE_MODULE_IDS.includes(moduleId)) {
    return true;
  }
  if (moduleId === 'administrador' && !canManageUsers(cargo)) {
    return false;
  }

  const resolvedSecoes =
    secoes && secoes.length > 0
      ? sanitizeSecoes(cargo, secoes)
      : sanitizeSecoes(
          cargo,
          (modulosOrSecoes ?? []).some((s) => s.includes('.'))
            ? modulosOrSecoes
            : expandModulosToSecoes(modulosOrSecoes ?? defaultModulosForCargo(cargo)),
        );

  // Merchandising sempre visível porque Validades é liberada para todos
  if (moduleId === 'merchandising') {
    return sectionsOfModule(moduleId).some(
      (s) =>
        resolvedSecoes.includes(s.id) ||
        (ALWAYS_AVAILABLE_SECTION_IDS as readonly string[]).includes(s.id),
    );
  }

  return sectionsOfModule(moduleId).some((s) => resolvedSecoes.includes(s.id));
}
