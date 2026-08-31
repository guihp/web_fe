import { supabase } from '../lib/supabase';
import { todayISO } from '../utils/atividadesDomain';
import type { Loja } from './lojasService';

const BUCKET = 'atividade-fotos';
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function extensionForFile(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

async function uploadAtividadeFoto(
  usuarioId: number,
  kind: 'antes' | 'depois',
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione uma imagem (JPG, PNG ou WebP).');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('A imagem deve ter no máximo 8 MB.');
  }

  const ext = extensionForFile(file);
  const stamp = Date.now();
  const path = `${usuarioId}/${todayISO()}/${kind}-${stamp}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export type PromotorExecucaoInput = {
  usuarioId: number;
  loja: Loja;
  industria: string;
  fotoAntes: File;
  fotoDepois: File;
};

/** Check-in + envio Antes/Depois (sem GPS). Cria atividade do dia e atividade_dia. */
export async function submitPromotorAntesDepois(
  input: PromotorExecucaoInput,
): Promise<{ atividadeId: number }> {
  const industria = input.industria.trim();
  if (!industria) throw new Error('Selecione a indústria.');
  if (!input.loja?.Nome) throw new Error('Selecione a loja.');

  const hoje = todayISO();
  const lojaNome = input.loja.Nome.trim();

  const { data: atividade, error: atError } = await supabase
    .from('atividades')
    .insert({
      tipo: 'Antes e Depois',
      usuario_responsavel: input.usuarioId,
      loja: lojaNome,
      industria,
      data_inicio: hoje,
      data_fim: hoje,
      status: 'Completo',
      sincronizado: true,
      criado_por: input.usuarioId,
    })
    .select('id')
    .single();

  if (atError) throw new Error(atError.message);
  const atividadeId = Number(atividade.id);

  const [fotoAntesUrl, fotoDepoisUrl] = await Promise.all([
    uploadAtividadeFoto(input.usuarioId, 'antes', input.fotoAntes),
    uploadAtividadeFoto(input.usuarioId, 'depois', input.fotoDepois),
  ]);

  const { error: diaError } = await supabase.from('atividade_dia').insert({
    atividade_id: atividadeId,
    data: hoje,
    status: 'Completo',
    foto_antes_url: fotoAntesUrl,
    foto_depois_url: fotoDepoisUrl,
  });

  if (diaError) throw new Error(diaError.message);

  return { atividadeId };
}

export async function fetchMinhasAtividadesHoje(usuarioId: number) {
  const hoje = todayISO();
  const { data, error } = await supabase
    .from('atividades')
    .select('id, tipo, loja, industria, data_inicio, data_fim, status, sincronizado')
    .eq('usuario_responsavel', usuarioId)
    .lte('data_inicio', hoje)
    .gte('data_fim', hoje)
    .order('id', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
