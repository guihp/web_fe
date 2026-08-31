import { supabase } from '../lib/supabase';

export type AvisoTipo = 'salario' | 'feriado' | 'folha';

export type Aviso = {
  id: number;
  tipo: AvisoTipo;
  titulo: string;
  corpo: string;
  criado_por: number | null;
  created_at: string;
};

export const AVISO_TEMPLATES: Record<
  'salario' | 'feriado',
  { titulo: string; corpo: string }
> = {
  salario: {
    titulo: 'Ótimo Dia Time!',
    corpo:
      'Passando para informar los que para honra e glória de Deus pagando antecipadamente o salário de todos já está na conta!\nVamos que vamos!\nPra Ribaaaaa …',
  },
  feriado: {
    titulo: 'Aviso de feriado',
    corpo:
      'Ótimo dia, time!\n\nPassamos para lembrar que no dia [DATA] não haverá expediente em razão do feriado de [NOME DO FERIADO].\n\nOrganizem suas rotinas e o registro de ponto conforme as orientações da gestão.\n\nBons descansos e que Deus abençoe a todos!',
  },
};

export async function fetchAvisos(limit = 30): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from('avisos')
    .select('id, tipo, titulo, corpo, criado_por, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Aviso[];
}

export async function enviarAviso(params: {
  tipo: 'salario' | 'feriado';
  titulo: string;
  corpo: string;
  criadoPor: number | null;
}): Promise<Aviso> {
  const { data, error } = await supabase.rpc('enviar_aviso', {
    p_tipo: params.tipo,
    p_titulo: params.titulo,
    p_corpo: params.corpo,
    p_criado_por: params.criadoPor,
  });

  if (error) throw new Error(error.message);
  return data as Aviso;
}
