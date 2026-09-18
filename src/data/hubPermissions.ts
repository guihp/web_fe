/** Catálogo e seções do Hub Grupo Fé (permissões em hub_usuario_*). */

export const HUB_SISTEMA_IDS = ['fe', 'finance', 'imobi', 'daily'] as const;
export type HubSistemaId = (typeof HUB_SISTEMA_IDS)[number];

export type HubSecaoDef = {
  id: string;
  title: string;
  sistemaId: HubSistemaId;
};

export type HubSistemaDef = {
  id: HubSistemaId;
  nome: string;
  descricao: string;
  secoes: HubSecaoDef[];
};

export const HUB_SISTEMAS: HubSistemaDef[] = [
  {
    id: 'fe',
    nome: 'Fé Merchandising',
    descricao: 'Operação e vendas do App Fé',
    secoes: [
      { id: 'fe.resumo', title: 'Resumo', sistemaId: 'fe' },
      { id: 'fe.usuarios', title: 'Usuários ativos', sistemaId: 'fe' },
      { id: 'fe.vendas', title: 'Vendas do mês', sistemaId: 'fe' },
      { id: 'fe.kanban', title: 'Pedidos kanban', sistemaId: 'fe' },
    ],
  },
  {
    id: 'finance',
    nome: 'IAFÉ Finance',
    descricao: 'Assinaturas e finanças pessoais',
    secoes: [
      { id: 'finance.resumo', title: 'Resumo', sistemaId: 'finance' },
      { id: 'finance.clientes', title: 'Clientes / usuários', sistemaId: 'finance' },
      { id: 'finance.assinaturas', title: 'Assinaturas ativas', sistemaId: 'finance' },
      { id: 'finance.transacoes', title: 'Transações do mês', sistemaId: 'finance' },
    ],
  },
  {
    id: 'imobi',
    nome: 'IAFÉ Imobi',
    descricao: 'CRM imobiliário e leads',
    secoes: [
      { id: 'imobi.resumo', title: 'Resumo', sistemaId: 'imobi' },
      { id: 'imobi.empresas', title: 'Empresas', sistemaId: 'imobi' },
      { id: 'imobi.usuarios', title: 'Usuários ativos', sistemaId: 'imobi' },
      { id: 'imobi.leads', title: 'Leads', sistemaId: 'imobi' },
      { id: 'imobi.imoveis', title: 'Imóveis', sistemaId: 'imobi' },
    ],
  },
  {
    id: 'daily',
    nome: 'Daily',
    descricao: 'Demandas e sprints de desenvolvimento',
    secoes: [
      { id: 'daily.resumo', title: 'Resumo', sistemaId: 'daily' },
      { id: 'daily.usuarios', title: 'Usuários', sistemaId: 'daily' },
      { id: 'daily.clientes', title: 'Clientes / projetos', sistemaId: 'daily' },
      { id: 'daily.semana', title: 'Demandas da semana', sistemaId: 'daily' },
    ],
  },
];

export const HUB_SECAO_IDS = HUB_SISTEMAS.flatMap((s) => s.secoes.map((sec) => sec.id));

export const GRUPO_FE_HUB_SECTION = 'grupo-fe.hub';

export function isHubSistemaId(value: string): value is HubSistemaId {
  return (HUB_SISTEMA_IDS as readonly string[]).includes(value);
}

export function userHasHubAccess(
  isSuperAdmin: boolean | null | undefined,
  sistemas: string[] | null | undefined,
): boolean {
  if (isSuperAdmin) return true;
  return (sistemas ?? []).some((id) => isHubSistemaId(id));
}

export function userHasHubSistema(
  isSuperAdmin: boolean | null | undefined,
  sistemas: string[] | null | undefined,
  sistemaId: HubSistemaId,
): boolean {
  if (isSuperAdmin) return true;
  return (sistemas ?? []).includes(sistemaId);
}

export function userHasHubSecao(
  isSuperAdmin: boolean | null | undefined,
  secoes: string[] | null | undefined,
  secaoId: string,
  sistemas?: string[] | null,
): boolean {
  if (isSuperAdmin) return true;
  if ((secoes ?? []).includes(secaoId)) return true;
  // Sem seções explícitas: acesso ao sistema libera todas as seções daquele sistema
  if (sistemas && secaoId.includes('.')) {
    const sistemaId = secaoId.split('.')[0];
    if (sistemaId && isHubSistemaId(sistemaId) && sistemas.includes(sistemaId)) {
      return (secoes ?? []).length === 0;
    }
  }
  return false;
}

export function defaultHubSecoesForSistemas(sistemas: string[]): string[] {
  return HUB_SISTEMAS.filter((s) => sistemas.includes(s.id)).flatMap((s) =>
    s.secoes.map((sec) => sec.id),
  );
}
