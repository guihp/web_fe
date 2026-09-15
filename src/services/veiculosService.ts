import { supabase } from '../lib/supabase';
import {
  canAccessGestaoVeiculos,
  canManageVeiculoFrota,
  VEICULO_GESTAO_CARGOS,
} from '../data/portalModules';

const BUCKET = 'veiculo-anexos';
const MAX_FILE = 10 * 1024 * 1024;
const ACTIVE_RESP = ['programado', 'em_uso', 'aguardando_aprovacao'] as const;
const OPEN_PRESTACAO = [
  'rascunho',
  'veiculo_retirado',
  'entrega_registrada',
  'aguardando_aprovacao',
  'correcao_solicitada',
  'rejeitado',
] as const;

export type VeiculoTipo = 'carro' | 'moto';
export type VeiculoSituacao = 'disponivel' | 'em_uso' | 'manutencao' | 'inativo';
export type RespStatus =
  | 'programado'
  | 'em_uso'
  | 'entregue'
  | 'aguardando_aprovacao'
  | 'finalizado';
export type EntregaStatus =
  | 'rascunho'
  | 'veiculo_retirado'
  | 'entrega_registrada'
  | 'aguardando_aprovacao'
  | 'correcao_solicitada'
  | 'rejeitado'
  | 'aprovado'
  | 'finalizado';

export type Veiculo = {
  id: string;
  tipo: VeiculoTipo;
  marca: string;
  modelo: string;
  placa: string;
  ano: number | null;
  cor: string | null;
  consumo_medio_km_l: number | null;
  foto_url: string | null;
  situacao: VeiculoSituacao;
  created_at?: string;
  updated_at?: string;
};

export type VeiculoResponsabilidade = {
  id: string;
  usuario_id: number;
  veiculo_id: string;
  inicio_em: string;
  devolucao_prevista_em: string | null;
  observacoes: string | null;
  status: RespStatus;
  veiculos?: Veiculo | null;
  usuario_nome?: string;
};

export type VeiculoManutencao = {
  id: string;
  veiculo_id: string;
  data_inicio: string;
  data_fim: string | null;
  descricao: string | null;
  oficina: string | null;
  valor: number | null;
  comprovante_url: string | null;
  status: 'aberta' | 'concluida' | 'cancelada';
  criado_por: number | null;
  veiculos?: Veiculo | null;
};

export type VeiculoRetirada = {
  id: string;
  responsabilidade_id: string;
  usuario_id: number;
  veiculo_id: string;
  retirada_em: string;
  foto_hodometro_url: string;
  km_ia: number | null;
  km_confirmado: number;
  confianca_ia: number | null;
  combustivel_nivel: string | null;
  conservacao: string | null;
  observacoes: string | null;
};

export type VeiculoEntrega = {
  id: string;
  retirada_id: string;
  responsabilidade_id: string;
  usuario_id: number;
  veiculo_id: string;
  entrega_em: string;
  foto_hodometro_url: string;
  km_ia: number | null;
  km_confirmado: number;
  confianca_ia: number | null;
  combustivel_nivel: string | null;
  lavado: boolean;
  preco_combustivel: number;
  km_rodados: number | null;
  valor_combustivel_calculado: number | null;
  valor_abastecido_notas: number | null;
  valor_lavagem: number | null;
  valor_outros: number | null;
  total_estimado: number | null;
  observacoes: string | null;
  status: EntregaStatus;
  motivo_correcao: string | null;
  veiculos?: Veiculo | null;
  retirada?: VeiculoRetirada | null;
};

export type VeiculoAbastecimento = {
  id?: string;
  entrega_id?: string;
  data: string;
  valor: number;
  preco_litro?: number | null;
  litros?: number | null;
  posto?: string | null;
  nota_url?: string | null;
  observacao?: string | null;
};

export type VeiculoConfig = {
  id: number;
  formula_combustivel: 'km_x_preco' | 'km_div_consumo_x_litro';
  preco_padrao: number | null;
};

export type VeiculoInput = {
  tipo: VeiculoTipo;
  marca: string;
  modelo: string;
  placa: string;
  ano?: number | null;
  cor?: string | null;
  consumo_medio_km_l?: number | null;
  foto_url?: string | null;
  situacao?: VeiculoSituacao;
};

function normalizePlaca(placa: string) {
  return placa.trim().toUpperCase().replace(/\s+/g, '');
}

function assertFrotaManager(cargo: string) {
  if (!canManageVeiculoFrota(cargo)) {
    throw new Error('Somente Gerente ou Financeiro podem gerenciar a frota.');
  }
}

async function audit(params: {
  entidade: string;
  entidade_id: string;
  usuario_id?: number | null;
  acao: string;
  payload_antes?: unknown;
  payload_depois?: unknown;
  justificativa?: string | null;
}) {
  await supabase.from('veiculo_auditoria').insert({
    entidade: params.entidade,
    entidade_id: params.entidade_id,
    usuario_id: params.usuario_id ?? null,
    acao: params.acao,
    payload_antes: params.payload_antes ?? null,
    payload_depois: params.payload_depois ?? null,
    justificativa: params.justificativa ?? null,
  });
}

export async function uploadVeiculoAnexo(
  usuarioId: number,
  kind: string,
  file: File,
): Promise<string> {
  const okImage = file.type.startsWith('image/');
  const okPdf = file.type === 'application/pdf';
  if (!okImage && !okPdf) throw new Error('Aceito apenas JPG, PNG ou PDF.');
  if (file.size > MAX_FILE) throw new Error('Arquivo deve ter no máximo 10 MB.');

  let ext = 'jpg';
  if (file.type === 'image/png') ext = 'png';
  else if (file.type === 'image/webp') ext = 'webp';
  else if (okPdf) ext = 'pdf';

  const path = `${usuarioId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function fetchVeiculos(opts?: {
  situacao?: VeiculoSituacao | 'all';
}): Promise<Veiculo[]> {
  let q = supabase.from('veiculos').select('*').order('placa');
  if (opts?.situacao && opts.situacao !== 'all') {
    q = q.eq('situacao', opts.situacao);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Veiculo[];
}

export async function createVeiculo(
  input: VeiculoInput,
  actor: { id: number; cargo: string },
): Promise<Veiculo> {
  assertFrotaManager(actor.cargo);
  const placa = normalizePlaca(input.placa);
  if (!placa) throw new Error('Informe a placa.');
  if (!input.marca.trim() || !input.modelo.trim()) {
    throw new Error('Marca e modelo são obrigatórios.');
  }
  const row = {
    tipo: input.tipo,
    marca: input.marca.trim(),
    modelo: input.modelo.trim(),
    placa,
    ano: input.ano ?? null,
    cor: input.cor?.trim() || null,
    consumo_medio_km_l: input.consumo_medio_km_l ?? null,
    foto_url: input.foto_url ?? null,
    situacao: input.situacao ?? 'disponivel',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('veiculos').insert(row).select('*').single();
  if (error) {
    if (error.message.toLowerCase().includes('veiculos_placa') || error.code === '23505') {
      throw new Error('Já existe um veículo com esta placa.');
    }
    throw new Error(error.message);
  }
  const veiculo = data as Veiculo;
  await audit({
    entidade: 'veiculos',
    entidade_id: veiculo.id,
    usuario_id: actor.id,
    acao: 'create',
    payload_depois: veiculo,
  });
  return veiculo;
}

export async function updateVeiculo(
  id: string,
  input: Partial<VeiculoInput>,
  actor: { id: number; cargo: string },
): Promise<Veiculo> {
  assertFrotaManager(actor.cargo);
  const { data: before } = await supabase.from('veiculos').select('*').eq('id', id).maybeSingle();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.tipo) patch.tipo = input.tipo;
  if (input.marca != null) patch.marca = input.marca.trim();
  if (input.modelo != null) patch.modelo = input.modelo.trim();
  if (input.placa != null) patch.placa = normalizePlaca(input.placa);
  if (input.ano !== undefined) patch.ano = input.ano;
  if (input.cor !== undefined) patch.cor = input.cor?.trim() || null;
  if (input.consumo_medio_km_l !== undefined) patch.consumo_medio_km_l = input.consumo_medio_km_l;
  if (input.foto_url !== undefined) patch.foto_url = input.foto_url;
  if (input.situacao) patch.situacao = input.situacao;

  const { data, error } = await supabase
    .from('veiculos')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (error.message.toLowerCase().includes('veiculos_placa') || error.code === '23505') {
      throw new Error('Já existe um veículo com esta placa.');
    }
    throw new Error(error.message);
  }
  const veiculo = data as Veiculo;

  // Frota e responsabilidade precisam bater: disponível/inativo/manutenção encerra vínculo ativo
  if (
    input.situacao === 'disponivel' ||
    input.situacao === 'inativo' ||
    input.situacao === 'manutencao'
  ) {
    await encerrarResponsabilidadesAtivas(id, actor.id, `situacao_${input.situacao}`);
  }

  await audit({
    entidade: 'veiculos',
    entidade_id: id,
    usuario_id: actor.id,
    acao: 'update',
    payload_antes: before,
    payload_depois: veiculo,
  });
  return veiculo;
}

async function encerrarResponsabilidadesAtivas(
  veiculoId: string,
  actorId: number,
  motivo: string,
): Promise<void> {
  const { data: ativos, error } = await supabase
    .from('veiculo_responsabilidades')
    .select('id, status')
    .eq('veiculo_id', veiculoId)
    .in('status', [...ACTIVE_RESP]);
  if (error) throw new Error(error.message);
  if (!ativos?.length) return;

  const { error: uErr } = await supabase
    .from('veiculo_responsabilidades')
    .update({ status: 'finalizado', updated_at: new Date().toISOString() })
    .eq('veiculo_id', veiculoId)
    .in('status', [...ACTIVE_RESP]);
  if (uErr) throw new Error(uErr.message);

  for (const row of ativos) {
    await audit({
      entidade: 'veiculo_responsabilidades',
      entidade_id: row.id,
      usuario_id: actorId,
      acao: 'encerrar_por_frota',
      payload_antes: row,
      payload_depois: { status: 'finalizado', motivo },
      justificativa: `Vínculo encerrado ao marcar veículo como ${motivo.replace('situacao_', '')}.`,
    });
  }
}

export async function deleteVeiculo(
  id: string,
  actor: { id: number; cargo: string },
): Promise<void> {
  assertFrotaManager(actor.cargo);
  const { data: openEnt } = await supabase
    .from('veiculo_entregas')
    .select('id')
    .eq('veiculo_id', id)
    .in('status', [...OPEN_PRESTACAO])
    .limit(1);
  if (openEnt?.length) {
    throw new Error('Não é possível excluir: há prestação em andamento. Prefira inativar.');
  }
  const { data: before } = await supabase.from('veiculos').select('*').eq('id', id).maybeSingle();
  const { count } = await supabase
    .from('veiculo_responsabilidades')
    .select('id', { count: 'exact', head: true })
    .eq('veiculo_id', id);
  if ((count ?? 0) > 0) {
    // Inativa e encerra vínculos ativos (via updateVeiculo)
    await updateVeiculo(id, { situacao: 'inativo' }, actor);
    return;
  }
  const { data: activeResp } = await supabase
    .from('veiculo_responsabilidades')
    .select('id')
    .eq('veiculo_id', id)
    .in('status', [...ACTIVE_RESP])
    .limit(1);
  if (activeResp?.length) {
    await updateVeiculo(id, { situacao: 'inativo' }, actor);
    return;
  }
  const { error } = await supabase.from('veiculos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await audit({
    entidade: 'veiculos',
    entidade_id: id,
    usuario_id: actor.id,
    acao: 'delete',
    payload_antes: before,
  });
}

export async function fetchUsuariosVeiculoElegiveis(): Promise<
  { id: number; nome: string; cargo: string }[]
> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, cargo, tipo_usuario, status')
    .eq('status', true)
    .eq('tipo_usuario', 'interno')
    .order('nome');
  if (error) throw new Error(error.message);
  const allowed = new Set(VEICULO_GESTAO_CARGOS.map((c) => c.toLowerCase()));
  return (data ?? [])
    .filter((u) => allowed.has(String(u.cargo ?? '').trim().toLowerCase()))
    .map((u) => ({ id: Number(u.id), nome: String(u.nome ?? ''), cargo: String(u.cargo ?? '') }));
}

export async function fetchResponsabilidades(opts?: {
  usuarioId?: number;
  onlyActive?: boolean;
}): Promise<VeiculoResponsabilidade[]> {
  let q = supabase
    .from('veiculo_responsabilidades')
    .select('*, veiculos(*)')
    .order('inicio_em', { ascending: false });
  if (opts?.usuarioId != null) q = q.eq('usuario_id', opts.usuarioId);
  if (opts?.onlyActive) q = q.in('status', [...ACTIVE_RESP]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as VeiculoResponsabilidade[];
  const userIds = [...new Set(rows.map((r) => r.usuario_id))];
  if (userIds.length) {
    const { data: users } = await supabase.from('usuarios').select('id, nome').in('id', userIds);
    const map = new Map((users ?? []).map((u) => [Number(u.id), String(u.nome ?? '')]));
    for (const r of rows) r.usuario_nome = map.get(r.usuario_id) ?? `Usuário #${r.usuario_id}`;
  }
  return rows;
}

export async function createResponsabilidade(
  input: {
    usuario_id: number;
    veiculo_id: string;
    inicio_em?: string;
    devolucao_prevista_em?: string | null;
    observacoes?: string | null;
  },
  actor: { id: number; cargo: string },
): Promise<VeiculoResponsabilidade> {
  if (!canAccessGestaoVeiculos(actor.cargo, 'interno') && !canManageVeiculoFrota(actor.cargo)) {
    throw new Error('Sem permissão para vincular responsável.');
  }
  const { data: veiculo } = await supabase
    .from('veiculos')
    .select('*')
    .eq('id', input.veiculo_id)
    .maybeSingle();
  if (!veiculo) throw new Error('Veículo não encontrado.');
  if (veiculo.situacao === 'manutencao') {
    throw new Error('Veículo em manutenção — conclua a manutenção antes de atribuir.');
  }
  if (veiculo.situacao === 'inativo') throw new Error('Veículo inativo.');

  const { data: conflict } = await supabase
    .from('veiculo_responsabilidades')
    .select('id')
    .eq('veiculo_id', input.veiculo_id)
    .in('status', [...ACTIVE_RESP])
    .limit(1);
  if (conflict?.length) {
    throw new Error('Este veículo já está atribuído a outro responsável.');
  }

  const { data, error } = await supabase
    .from('veiculo_responsabilidades')
    .insert({
      usuario_id: input.usuario_id,
      veiculo_id: input.veiculo_id,
      inicio_em: input.inicio_em ?? new Date().toISOString(),
      devolucao_prevista_em: input.devolucao_prevista_em ?? null,
      observacoes: input.observacoes ?? null,
      status: 'programado',
      updated_at: new Date().toISOString(),
    })
    .select('*, veiculos(*)')
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from('veiculos')
    .update({ situacao: 'em_uso', updated_at: new Date().toISOString() })
    .eq('id', input.veiculo_id);

  await audit({
    entidade: 'veiculo_responsabilidades',
    entidade_id: data.id,
    usuario_id: actor.id,
    acao: 'create',
    payload_depois: data,
  });
  return data as VeiculoResponsabilidade;
}

export async function fetchQuemEstaComVeiculo(): Promise<
  {
    veiculo: Veiculo;
    responsavel: string | null;
    status: string;
    inicio_em: string | null;
    devolucao_prevista_em: string | null;
  }[]
> {
  const veiculos = await fetchVeiculos();
  const resps = await fetchResponsabilidades({ onlyActive: true });
  const byVeiculo = new Map(resps.map((r) => [r.veiculo_id, r]));
  return veiculos.map((v) => {
    const livre = v.situacao === 'disponivel' || v.situacao === 'inativo';
    const r = livre ? undefined : byVeiculo.get(v.id);
    // Se frota diz disponível mas ainda há vínculo ativo órfão, não exibir responsável
    if (livre) {
      return {
        veiculo: v,
        responsavel: null,
        status: v.situacao,
        inicio_em: null,
        devolucao_prevista_em: null,
      };
    }
    return {
      veiculo: v,
      responsavel: r?.usuario_nome ?? null,
      status: r?.status ?? v.situacao,
      inicio_em: r?.inicio_em ?? null,
      devolucao_prevista_em: r?.devolucao_prevista_em ?? null,
    };
  });
}

export async function fetchManutencoes(veiculoId?: string): Promise<VeiculoManutencao[]> {
  let q = supabase
    .from('veiculo_manutencoes')
    .select('*, veiculos(*)')
    .order('data_inicio', { ascending: false });
  if (veiculoId) q = q.eq('veiculo_id', veiculoId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as VeiculoManutencao[];
}

export async function abrirManutencao(
  input: {
    veiculo_id: string;
    descricao?: string;
    oficina?: string;
    valor?: number | null;
    comprovante_url?: string | null;
  },
  actor: { id: number; cargo: string },
): Promise<VeiculoManutencao> {
  assertFrotaManager(actor.cargo);
  const { data: conflict } = await supabase
    .from('veiculo_responsabilidades')
    .select('id')
    .eq('veiculo_id', input.veiculo_id)
    .in('status', [...ACTIVE_RESP])
    .limit(1);
  if (conflict?.length) {
    throw new Error('Finalize a responsabilidade ativa antes de abrir manutenção.');
  }
  const { data, error } = await supabase
    .from('veiculo_manutencoes')
    .insert({
      veiculo_id: input.veiculo_id,
      descricao: input.descricao ?? null,
      oficina: input.oficina ?? null,
      valor: input.valor ?? null,
      comprovante_url: input.comprovante_url ?? null,
      status: 'aberta',
      criado_por: actor.id,
      updated_at: new Date().toISOString(),
    })
    .select('*, veiculos(*)')
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from('veiculos')
    .update({ situacao: 'manutencao', updated_at: new Date().toISOString() })
    .eq('id', input.veiculo_id);
  await audit({
    entidade: 'veiculo_manutencoes',
    entidade_id: data.id,
    usuario_id: actor.id,
    acao: 'abrir',
    payload_depois: data,
  });
  return data as VeiculoManutencao;
}

export async function concluirManutencao(
  id: string,
  actor: { id: number; cargo: string },
  status: 'concluida' | 'cancelada' = 'concluida',
): Promise<void> {
  assertFrotaManager(actor.cargo);
  const { data: row, error } = await supabase
    .from('veiculo_manutencoes')
    .update({
      status,
      data_fim: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from('veiculos')
    .update({ situacao: 'disponivel', updated_at: new Date().toISOString() })
    .eq('id', row.veiculo_id);
  await audit({
    entidade: 'veiculo_manutencoes',
    entidade_id: id,
    usuario_id: actor.id,
    acao: status,
    payload_depois: row,
  });
}

export async function fetchConfigVeiculo(): Promise<VeiculoConfig> {
  const { data, error } = await supabase.from('veiculo_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  return (
    (data as VeiculoConfig) ?? {
      id: 1,
      formula_combustivel: 'km_x_preco',
      preco_padrao: null,
    }
  );
}

export async function updateConfigVeiculo(
  patch: Partial<Pick<VeiculoConfig, 'formula_combustivel' | 'preco_padrao'>>,
  actor: { id: number; cargo: string },
): Promise<VeiculoConfig> {
  assertFrotaManager(actor.cargo);
  const { data, error } = await supabase
    .from('veiculo_config')
    .upsert({
      id: 1,
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  await audit({
    entidade: 'veiculo_config',
    entidade_id: '1',
    usuario_id: actor.id,
    acao: 'update',
    payload_depois: data,
  });
  return data as VeiculoConfig;
}

export function calcCombustivel(opts: {
  kmRodados: number;
  preco: number;
  formula: VeiculoConfig['formula_combustivel'];
  consumoMedio?: number | null;
}): number {
  if (opts.kmRodados < 0 || opts.preco < 0) return 0;
  if (opts.formula === 'km_div_consumo_x_litro') {
    const cons = opts.consumoMedio && opts.consumoMedio > 0 ? opts.consumoMedio : 0;
    if (!cons) return opts.kmRodados * opts.preco;
    return (opts.kmRodados / cons) * opts.preco;
  }
  return opts.kmRodados * opts.preco;
}

export async function registrarRetirada(
  input: {
    responsabilidade_id: string;
    foto_hodometro_url: string;
    km_confirmado: number;
    km_ia?: number | null;
    confianca_ia?: number | null;
    combustivel_nivel?: string;
    conservacao?: string;
    observacoes?: string;
    retirada_em?: string;
    fotosExtrasUrls?: string[];
  },
  actor: { id: number; cargo: string },
): Promise<VeiculoRetirada> {
  if (!input.foto_hodometro_url) throw new Error('Foto do hodômetro é obrigatória.');
  if (!(input.km_confirmado >= 0)) throw new Error('Informe a quilometragem inicial.');

  const { data: resp, error: rErr } = await supabase
    .from('veiculo_responsabilidades')
    .select('*, veiculos(*)')
    .eq('id', input.responsabilidade_id)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!resp) throw new Error('Responsabilidade não encontrada.');
  if (resp.usuario_id !== actor.id && !canManageVeiculoFrota(actor.cargo)) {
    throw new Error('Você só pode registrar retirada dos seus veículos.');
  }
  if (!ACTIVE_RESP.includes(resp.status as (typeof ACTIVE_RESP)[number]) && resp.status !== 'programado') {
    // allow programado and em_uso
  }

  const { data: existing } = await supabase
    .from('veiculo_retiradas')
    .select('id')
    .eq('responsabilidade_id', input.responsabilidade_id)
    .maybeSingle();
  if (existing) throw new Error('Já existe retirada para este vínculo.');

  const { data, error } = await supabase
    .from('veiculo_retiradas')
    .insert({
      responsabilidade_id: input.responsabilidade_id,
      usuario_id: resp.usuario_id,
      veiculo_id: resp.veiculo_id,
      retirada_em: input.retirada_em ?? new Date().toISOString(),
      foto_hodometro_url: input.foto_hodometro_url,
      km_confirmado: input.km_confirmado,
      km_ia: input.km_ia ?? null,
      confianca_ia: input.confianca_ia ?? null,
      combustivel_nivel: input.combustivel_nivel ?? null,
      conservacao: input.conservacao ?? null,
      observacoes: input.observacoes ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from('veiculo_responsabilidades')
    .update({ status: 'em_uso', updated_at: new Date().toISOString() })
    .eq('id', input.responsabilidade_id);

  await supabase.from('veiculo_fotos').insert({
    veiculo_id: resp.veiculo_id,
    retirada_id: data.id,
    tipo: 'hodometro_inicial',
    url: input.foto_hodometro_url,
    usuario_id: actor.id,
  });
  for (const url of input.fotosExtrasUrls ?? []) {
    await supabase.from('veiculo_fotos').insert({
      veiculo_id: resp.veiculo_id,
      retirada_id: data.id,
      tipo: 'veiculo',
      url,
      usuario_id: actor.id,
    });
  }

  await audit({
    entidade: 'veiculo_retiradas',
    entidade_id: data.id,
    usuario_id: actor.id,
    acao: 'create',
    payload_depois: data,
  });
  return data as VeiculoRetirada;
}

export async function registrarEntrega(
  input: {
    responsabilidade_id: string;
    foto_hodometro_url: string;
    km_confirmado: number;
    km_ia?: number | null;
    confianca_ia?: number | null;
    combustivel_nivel?: string;
    lavado: boolean;
    preco_combustivel: number;
    observacoes?: string;
    entrega_em?: string;
    enviarAprovacao?: boolean;
    lavagem?: {
      valor: number;
      data: string;
      estabelecimento?: string;
      comprovante_url?: string;
      observacoes?: string;
    } | null;
    abastecimentos?: VeiculoAbastecimento[];
    outros?: { valor: number; descricao?: string; comprovante_url?: string }[];
  },
  actor: { id: number; cargo: string },
): Promise<VeiculoEntrega> {
  if (!input.foto_hodometro_url) throw new Error('Foto final do hodômetro é obrigatória.');

  const { data: resp } = await supabase
    .from('veiculo_responsabilidades')
    .select('*, veiculos(*)')
    .eq('id', input.responsabilidade_id)
    .maybeSingle();
  if (!resp) throw new Error('Responsabilidade não encontrada.');
  if (resp.usuario_id !== actor.id && !canManageVeiculoFrota(actor.cargo)) {
    throw new Error('Você só pode registrar entrega dos seus veículos.');
  }

  const { data: retirada } = await supabase
    .from('veiculo_retiradas')
    .select('*')
    .eq('responsabilidade_id', input.responsabilidade_id)
    .maybeSingle();
  if (!retirada) throw new Error('Registre a retirada antes da entrega.');
  if (input.km_confirmado < Number(retirada.km_confirmado)) {
    throw new Error('A quilometragem final não pode ser menor que a inicial.');
  }

  const { data: existente } = await supabase
    .from('veiculo_entregas')
    .select('id, status')
    .eq('retirada_id', retirada.id)
    .maybeSingle();
  if (
    existente &&
    !['rascunho', 'correcao_solicitada', 'rejeitado'].includes(existente.status)
  ) {
    throw new Error('Já existe entrega registrada para esta retirada.');
  }

  const config = await fetchConfigVeiculo();
  const kmRodados = Number(input.km_confirmado) - Number(retirada.km_confirmado);
  const valorComb = calcCombustivel({
    kmRodados,
    preco: input.preco_combustivel,
    formula: config.formula_combustivel,
    consumoMedio: (resp.veiculos as Veiculo | null)?.consumo_medio_km_l,
  });
  const abasts = input.abastecimentos ?? [];
  const valorAbast = abasts.reduce((s, a) => s + Number(a.valor || 0), 0);
  const valorLav = input.lavado && input.lavagem ? Number(input.lavagem.valor || 0) : 0;
  const outros = input.outros ?? [];
  const valorOutros = outros.reduce((s, o) => s + Number(o.valor || 0), 0);
  const total = valorComb + valorLav + valorOutros;
  // Plan: total estimado a debitar uses calculated fuel; notes are separate display

  const status: EntregaStatus = input.enviarAprovacao
    ? 'aguardando_aprovacao'
    : 'entrega_registrada';

  const payload = {
    retirada_id: retirada.id,
    responsabilidade_id: input.responsabilidade_id,
    usuario_id: resp.usuario_id,
    veiculo_id: resp.veiculo_id,
    entrega_em: input.entrega_em ?? new Date().toISOString(),
    foto_hodometro_url: input.foto_hodometro_url,
    km_confirmado: input.km_confirmado,
    km_ia: input.km_ia ?? null,
    confianca_ia: input.confianca_ia ?? null,
    combustivel_nivel: input.combustivel_nivel ?? null,
    lavado: input.lavado,
    preco_combustivel: input.preco_combustivel,
    km_rodados: kmRodados,
    valor_combustivel_calculado: Number(valorComb.toFixed(2)),
    valor_abastecido_notas: Number(valorAbast.toFixed(2)),
    valor_lavagem: Number(valorLav.toFixed(2)),
    valor_outros: Number(valorOutros.toFixed(2)),
    total_estimado: Number(total.toFixed(2)),
    observacoes: input.observacoes ?? null,
    status,
    motivo_correcao: null,
    updated_at: new Date().toISOString(),
  };

  let entrega: VeiculoEntrega;
  if (existente) {
    const { data, error } = await supabase
      .from('veiculo_entregas')
      .update(payload)
      .eq('id', existente.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    entrega = data as VeiculoEntrega;
    await supabase.from('veiculo_abastecimentos').delete().eq('entrega_id', entrega.id);
    await supabase.from('veiculo_lavagens').delete().eq('entrega_id', entrega.id);
    await supabase.from('veiculo_despesas').delete().eq('entrega_id', entrega.id);
  } else {
    const { data, error } = await supabase
      .from('veiculo_entregas')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    entrega = data as VeiculoEntrega;
  }

  if (abasts.length) {
    const { error } = await supabase.from('veiculo_abastecimentos').insert(
      abasts.map((a) => ({
        entrega_id: entrega.id,
        data: a.data,
        valor: a.valor,
        preco_litro: a.preco_litro ?? null,
        litros: a.litros ?? null,
        posto: a.posto ?? null,
        nota_url: a.nota_url ?? null,
        observacao: a.observacao ?? null,
      })),
    );
    if (error) throw new Error(error.message);
  }

  if (input.lavado && input.lavagem) {
    const { error } = await supabase.from('veiculo_lavagens').insert({
      entrega_id: entrega.id,
      valor: input.lavagem.valor,
      data: input.lavagem.data,
      estabelecimento: input.lavagem.estabelecimento ?? null,
      comprovante_url: input.lavagem.comprovante_url ?? null,
      observacoes: input.lavagem.observacoes ?? null,
    });
    if (error) throw new Error(error.message);
  }

  if (outros.length) {
    const { error } = await supabase.from('veiculo_despesas').insert(
      outros.map((o) => ({
        entrega_id: entrega.id,
        tipo: 'outro',
        valor: o.valor,
        descricao: o.descricao ?? null,
        comprovante_url: o.comprovante_url ?? null,
      })),
    );
    if (error) throw new Error(error.message);
  }

  await supabase.from('veiculo_fotos').insert({
    veiculo_id: resp.veiculo_id,
    entrega_id: entrega.id,
    tipo: 'hodometro_final',
    url: input.foto_hodometro_url,
    usuario_id: actor.id,
  });

  if (status === 'aguardando_aprovacao') {
    await supabase
      .from('veiculo_responsabilidades')
      .update({ status: 'aguardando_aprovacao', updated_at: new Date().toISOString() })
      .eq('id', input.responsabilidade_id);
  }

  await audit({
    entidade: 'veiculo_entregas',
    entidade_id: entrega.id,
    usuario_id: actor.id,
    acao: input.enviarAprovacao ? 'enviar_aprovacao' : 'registrar',
    payload_depois: entrega,
  });
  return entrega;
}

export async function fetchEntregas(opts?: {
  usuarioId?: number;
  status?: EntregaStatus | EntregaStatus[];
}): Promise<VeiculoEntrega[]> {
  let q = supabase
    .from('veiculo_entregas')
    .select('*, veiculos(*)')
    .order('entrega_em', { ascending: false });
  if (opts?.usuarioId != null) q = q.eq('usuario_id', opts.usuarioId);
  if (opts?.status) {
    const st = Array.isArray(opts.status) ? opts.status : [opts.status];
    q = q.in('status', st);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as VeiculoEntrega[];
}

export async function fetchEntregaDetalhe(id: string): Promise<{
  entrega: VeiculoEntrega;
  retirada: VeiculoRetirada | null;
  abastecimentos: VeiculoAbastecimento[];
  lavagem: Record<string, unknown> | null;
  despesas: Record<string, unknown>[];
}> {
  const { data: entrega, error } = await supabase
    .from('veiculo_entregas')
    .select('*, veiculos(*)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  const { data: retirada } = await supabase
    .from('veiculo_retiradas')
    .select('*')
    .eq('id', entrega.retirada_id)
    .maybeSingle();
  const { data: abastecimentos } = await supabase
    .from('veiculo_abastecimentos')
    .select('*')
    .eq('entrega_id', id);
  const { data: lavagem } = await supabase
    .from('veiculo_lavagens')
    .select('*')
    .eq('entrega_id', id)
    .maybeSingle();
  const { data: despesas } = await supabase
    .from('veiculo_despesas')
    .select('*')
    .eq('entrega_id', id);
  return {
    entrega: entrega as VeiculoEntrega,
    retirada: (retirada as VeiculoRetirada) ?? null,
    abastecimentos: (abastecimentos ?? []) as VeiculoAbastecimento[],
    lavagem: lavagem ?? null,
    despesas: despesas ?? [],
  };
}

export async function acaoAprovacao(
  input: {
    entrega_id: string;
    acao: 'aprovar' | 'rejeitar' | 'solicitar_correcao' | 'ajustar_valor' | 'observacao' | 'confirmar_debito';
    justificativa?: string;
    valor_novo?: number;
  },
  actor: { id: number; cargo: string },
): Promise<void> {
  if (!canManageVeiculoFrota(actor.cargo)) {
    throw new Error('Somente Gerente ou Financeiro podem aprovar ou rejeitar.');
  }
  if (
    ['rejeitar', 'solicitar_correcao', 'ajustar_valor'].includes(input.acao) &&
    !input.justificativa?.trim()
  ) {
    throw new Error('Informe a justificativa.');
  }

  const { data: entrega, error } = await supabase
    .from('veiculo_entregas')
    .select('*')
    .eq('id', input.entrega_id)
    .single();
  if (error) throw new Error(error.message);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.acao === 'aprovar') {
    patch.status = 'aprovado';
  } else if (input.acao === 'rejeitar') {
    patch.status = 'rejeitado';
    patch.motivo_correcao = input.justificativa;
  } else if (input.acao === 'solicitar_correcao') {
    patch.status = 'correcao_solicitada';
    patch.motivo_correcao = input.justificativa;
  } else if (input.acao === 'ajustar_valor' && input.valor_novo != null) {
    patch.total_estimado = input.valor_novo;
  } else if (input.acao === 'confirmar_debito') {
    patch.status = 'finalizado';
  }

  const { error: uErr } = await supabase
    .from('veiculo_entregas')
    .update(patch)
    .eq('id', input.entrega_id);
  if (uErr) throw new Error(uErr.message);

  await supabase.from('veiculo_aprovacoes').insert({
    entrega_id: input.entrega_id,
    acao: input.acao,
    valor_anterior: entrega.total_estimado,
    valor_novo: input.valor_novo ?? null,
    justificativa: input.justificativa ?? null,
    actor_usuario_id: actor.id,
  });

  if (input.acao === 'aprovar' || input.acao === 'confirmar_debito') {
    await supabase
      .from('veiculo_responsabilidades')
      .update({
        status: input.acao === 'confirmar_debito' ? 'finalizado' : 'entregue',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entrega.responsabilidade_id);
    if (input.acao === 'confirmar_debito') {
      await supabase
        .from('veiculos')
        .update({ situacao: 'disponivel', updated_at: new Date().toISOString() })
        .eq('id', entrega.veiculo_id);
    }
  }

  await audit({
    entidade: 'veiculo_entregas',
    entidade_id: input.entrega_id,
    usuario_id: actor.id,
    acao: input.acao,
    payload_antes: entrega,
    payload_depois: patch,
    justificativa: input.justificativa,
  });
}

export async function fetchDashboardVeiculos(): Promise<{
  disponiveis: number;
  emUso: number;
  manutencao: number;
  aguardando: number;
  rejeitadas: number;
  kmTotal: number;
  gastoCombustivel: number;
  gastoLavagem: number;
  totalDebito: number;
  porFuncionario: { usuario_id: number; nome: string; total: number }[];
  porVeiculo: { veiculo_id: string; placa: string; total: number }[];
}> {
  const veiculos = await fetchVeiculos();
  const entregas = await fetchEntregas();
  const disponiveis = veiculos.filter((v) => v.situacao === 'disponivel').length;
  const emUso = veiculos.filter((v) => v.situacao === 'em_uso').length;
  const manutencao = veiculos.filter((v) => v.situacao === 'manutencao').length;
  const aguardando = entregas.filter((e) => e.status === 'aguardando_aprovacao').length;
  const rejeitadas = entregas.filter((e) => e.status === 'rejeitado').length;
  const relevant = entregas.filter((e) =>
    ['aguardando_aprovacao', 'aprovado', 'finalizado'].includes(e.status),
  );
  const kmTotal = relevant.reduce((s, e) => s + Number(e.km_rodados || 0), 0);
  const gastoCombustivel = relevant.reduce(
    (s, e) => s + Number(e.valor_combustivel_calculado || 0),
    0,
  );
  const gastoLavagem = relevant.reduce((s, e) => s + Number(e.valor_lavagem || 0), 0);
  const totalDebito = relevant.reduce((s, e) => s + Number(e.total_estimado || 0), 0);

  const byUser = new Map<number, number>();
  const byVeic = new Map<string, { placa: string; total: number }>();
  for (const e of relevant) {
    byUser.set(e.usuario_id, (byUser.get(e.usuario_id) ?? 0) + Number(e.total_estimado || 0));
    const placa = e.veiculos?.placa ?? e.veiculo_id;
    const cur = byVeic.get(e.veiculo_id) ?? { placa, total: 0 };
    cur.total += Number(e.total_estimado || 0);
    byVeic.set(e.veiculo_id, cur);
  }
  const userIds = [...byUser.keys()];
  const nomeMap = new Map<number, string>();
  if (userIds.length) {
    const { data: users } = await supabase.from('usuarios').select('id, nome').in('id', userIds);
    for (const u of users ?? []) nomeMap.set(Number(u.id), String(u.nome ?? ''));
  }

  return {
    disponiveis,
    emUso,
    manutencao,
    aguardando,
    rejeitadas,
    kmTotal,
    gastoCombustivel,
    gastoLavagem,
    totalDebito,
    porFuncionario: [...byUser.entries()].map(([usuario_id, total]) => ({
      usuario_id,
      nome: nomeMap.get(usuario_id) ?? `#${usuario_id}`,
      total,
    })),
    porVeiculo: [...byVeic.entries()].map(([veiculo_id, v]) => ({
      veiculo_id,
      placa: v.placa,
      total: v.total,
    })),
  };
}

export async function fetchAuditoria(limit = 100) {
  const { data, error } = await supabase
    .from('veiculo_auditoria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchRetiradaByResp(responsabilidadeId: string) {
  const { data, error } = await supabase
    .from('veiculo_retiradas')
    .select('*')
    .eq('responsabilidade_id', responsabilidadeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as VeiculoRetirada | null;
}

export function formatMoneyBR(n: number | null | undefined) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
