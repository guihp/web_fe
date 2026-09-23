import { supabase } from '../lib/supabase';
import type { HubSistemaId } from '../data/hubPermissions';

export type HubSistemaMetricsResult = {
  sistema: HubSistemaId;
  ok: boolean;
  error?: string;
  metrics?: Record<string, unknown>;
};

export type HubMetricsResponse = {
  generated_at: string;
  is_super_admin: boolean;
  sistemas: HubSistemaMetricsResult[];
};

export type HubImobiResumo = {
  empresas_total: number;
  empresas_ativas: number;
  empresas_trial: number;
  empresas_bloqueadas: number;
  usuarios_ativos: number;
  leads: number;
  imoveis: number;
};

export type HubImobiVisitas = {
  total: number;
  futuras: number;
  por_status: { status: string; n: number }[];
  recentes: {
    id: string;
    company_id: string | null;
    start_at: string | null;
    status: string | null;
    lead_id: string | null;
  }[];
};

export type HubImobiAtendimentos = {
  mensagens_7d: number;
  mensagens_30d: number;
  conversas_distintas: number;
  mensagens_total: number;
};

export type HubImobiEmpresaAtiva = {
  id: string;
  name: string;
  leads: number;
  visitas: number;
  msgs: number;
  subscription_status: string | null;
};

export type HubImobiDetailResponse = {
  generated_at: string;
  is_super_admin: boolean;
  detail: 'imobi';
  resumo: HubImobiResumo;
  visitas: HubImobiVisitas;
  atendimentos: HubImobiAtendimentos;
  leads_por_stage: { stage: string; n: number }[];
  empresas_ativas: HubImobiEmpresaAtiva[];
};

function assertNoFunctionError(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') {
    throw new Error(fallback);
  }
  if ('error' in data && typeof (data as { error: unknown }).error === 'string') {
    throw new Error((data as { error: string }).error);
  }
}

export async function fetchHubMetrics(usuarioId: number): Promise<HubMetricsResponse> {
  const { data, error } = await supabase.functions.invoke('hub-metrics', {
    body: { usuario_id: usuarioId },
    headers: {
      'x-usuario-id': String(usuarioId),
    },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar métricas do Grupo Fé.');
  }

  assertNoFunctionError(data, 'Resposta inválida da função hub-metrics.');
  return data as HubMetricsResponse;
}

export async function fetchHubImobiDetail(usuarioId: number): Promise<HubImobiDetailResponse> {
  const { data, error } = await supabase.functions.invoke('hub-metrics', {
    body: { usuario_id: usuarioId, detail: 'imobi' },
    headers: {
      'x-usuario-id': String(usuarioId),
    },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar detalhe do Imobi.');
  }

  assertNoFunctionError(data, 'Resposta inválida do detalhe Imobi.');

  const payload = data as HubImobiDetailResponse;
  if (payload.detail !== 'imobi' || !payload.resumo || !payload.visitas || !payload.atendimentos) {
    throw new Error('Payload de detalhe Imobi incompleto.');
  }

  return payload;
}

export type HubFinanceResumo = {
  clientes: number;
  assinaturas_ativas: number;
  assinaturas_trial: number;
  assinantes_faturando: number;
  assinaturas_overdue?: number;
  assinaturas_cancelled?: number;
  ticket_medio_assinante: number;
  mrr_estimado: number;
  preco_plano: number;
};

export type HubFinancePagamentos = {
  recebidos_count: number;
  recebidos_soma: number;
  recentes: {
    amount: number;
    status: string | null;
    paid_at: string | null;
    payment_method: string | null;
  }[];
};

export type HubFinanceTransacoesMes = {
  total: number;
  receitas: number;
  despesas: number;
  por_tipo: { type: string; n: number; soma: number }[];
};

export type HubFinanceFunil = {
  pending_registrations: number;
  partial_leads: number;
  desistentes: number;
};

export type HubFinanceDetailResponse = {
  generated_at: string;
  is_super_admin: boolean;
  detail: 'finance';
  resumo: HubFinanceResumo;
  assinaturas_por_status: { status: string; is_trial: boolean; n: number }[];
  pagamentos: HubFinancePagamentos;
  transacoes_mes: HubFinanceTransacoesMes;
  funil: HubFinanceFunil;
  clientes_recentes: {
    full_name: string | null;
    email: string | null;
    created_at: string | null;
  }[];
};

export async function fetchHubFinanceDetail(usuarioId: number): Promise<HubFinanceDetailResponse> {
  const { data, error } = await supabase.functions.invoke('hub-metrics', {
    body: { usuario_id: usuarioId, detail: 'finance' },
    headers: {
      'x-usuario-id': String(usuarioId),
    },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar detalhe do Finance.');
  }

  assertNoFunctionError(data, 'Resposta inválida do detalhe Finance.');

  const payload = data as HubFinanceDetailResponse;
  if (
    payload.detail !== 'finance' ||
    !payload.resumo ||
    !payload.pagamentos ||
    !payload.transacoes_mes ||
    !payload.funil
  ) {
    throw new Error('Payload de detalhe Finance incompleto.');
  }

  return payload;
}

export type HubDailyResumo = {
  usuarios: number;
  clientes: number;
  semana: { start: string; end: string };
  demandas_semana: {
    total: number;
    todo: number;
    doing: number;
    done: number;
  };
  tarefas_atrasadas: number;
  artes_pendentes: number;
  tarefas_daily: number;
};

export type HubDailyDetailResponse = {
  generated_at: string;
  is_super_admin: boolean;
  detail: 'daily';
  resumo: HubDailyResumo;
  demandas_por_status: { status: string; n: number }[];
  demandas_por_cliente: { cliente: string; total: number }[];
  tarefas_recentes: {
    title: string;
    status: string;
    due_date: string | null;
    client_name: string | null;
    assignee_name: string | null;
    updated_at: string | null;
  }[];
  projetos: {
    name: string;
    status: string | null;
    week_priority: number | null;
    tarefas_abertas: number;
  }[];
  artes: {
    pendentes: number;
    recentes: {
      title: string | null;
      status: string;
      created_at: string | null;
    }[];
  };
  atividade_recente: {
    action: string;
    created_at: string | null;
    client_name: string | null;
  }[];
};

export async function fetchHubDailyDetail(usuarioId: number): Promise<HubDailyDetailResponse> {
  const { data, error } = await supabase.functions.invoke('hub-metrics', {
    body: { usuario_id: usuarioId, detail: 'daily' },
    headers: {
      'x-usuario-id': String(usuarioId),
    },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar detalhe do Daily.');
  }

  assertNoFunctionError(data, 'Resposta inválida do detalhe Daily.');

  const payload = data as HubDailyDetailResponse;
  if (
    payload.detail !== 'daily' ||
    !payload.resumo ||
    !payload.demandas_por_status ||
    !payload.projetos ||
    !payload.artes
  ) {
    throw new Error('Payload de detalhe Daily incompleto.');
  }

  return payload;
}
