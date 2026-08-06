import { supabase } from '../lib/supabase';

export type Empresa = {
  id: number;
  cnpj: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
};

export type EmpresaFilial = {
  id: number;
  empresa_id: number;
  cnpj: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
};

export type EmpresaFormInput = {
  cnpj?: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
};

export type FilialFormInput = {
  cnpj?: string;
  razao_social: string;
  nome_fantasia?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  status?: string;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCnpjInput(value: string): string {
  const d = digitsOnly(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatCnpjDisplay(cnpj: string | null | undefined): string {
  const d = digitsOnly(cnpj ?? '');
  if (d.length !== 14) return cnpj?.trim() || '—';
  return formatCnpjInput(d);
}

function normalizeCnpj(value?: string): string | null {
  const d = digitsOnly(value ?? '');
  return d ? d.padStart(14, '0').slice(-14) : null;
}

function emptyToNull(value?: string): string | null {
  const v = value?.trim() ?? '';
  return v || null;
}

const ESTADOS_UF = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const ESTADOS_EMPRESA = [...ESTADOS_UF];

export async function fetchEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Empresa[];
}

export async function fetchEmpresaPrincipal(): Promise<Empresa | null> {
  const list = await fetchEmpresas();
  return list[0] ?? null;
}

export async function upsertEmpresa(
  input: EmpresaFormInput,
  existingId?: number | null,
): Promise<Empresa> {
  const razao = input.razao_social.trim();
  if (!razao) throw new Error('Informe a razão social da empresa.');

  const payload = {
    cnpj: normalizeCnpj(input.cnpj),
    razao_social: razao,
    nome_fantasia: emptyToNull(input.nome_fantasia),
    inscricao_estadual: emptyToNull(input.inscricao_estadual),
    endereco: emptyToNull(input.endereco),
    cidade: emptyToNull(input.cidade),
    estado: emptyToNull(input.estado)?.toUpperCase().slice(0, 2) ?? null,
    cep: digitsOnly(input.cep ?? '') || null,
    telefone: digitsOnly(input.telefone ?? '') || null,
    email: emptyToNull(input.email),
    status: 'Ativo',
    updated_at: new Date().toISOString(),
  };

  if (existingId) {
    const { data, error } = await supabase
      .from('empresas')
      .update(payload)
      .eq('id', existingId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Empresa;
  }

  const { data, error } = await supabase.from('empresas').insert([payload]).select('*').single();
  if (error) throw new Error(error.message);
  return data as Empresa;
}

export async function fetchFiliaisByEmpresa(empresaId: number): Promise<EmpresaFilial[]> {
  const { data, error } = await supabase
    .from('filiais')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as EmpresaFilial[];
}

export async function createFilial(
  empresaId: number,
  input: FilialFormInput,
): Promise<EmpresaFilial> {
  const razao = input.razao_social.trim();
  if (!razao) throw new Error('Informe a razão social da filial.');
  if (!empresaId) throw new Error('Salve a empresa matriz antes de cadastrar filiais.');

  const payload = {
    empresa_id: empresaId,
    cnpj: normalizeCnpj(input.cnpj),
    razao_social: razao,
    nome_fantasia: emptyToNull(input.nome_fantasia),
    endereco: emptyToNull(input.endereco),
    cidade: emptyToNull(input.cidade),
    estado: emptyToNull(input.estado)?.toUpperCase().slice(0, 2) ?? null,
    cep: digitsOnly(input.cep ?? '') || null,
    telefone: digitsOnly(input.telefone ?? '') || null,
    email: emptyToNull(input.email),
    status: input.status?.trim() || 'Ativo',
  };

  const { data, error } = await supabase.from('filiais').insert([payload]).select('*').single();
  if (error) throw new Error(error.message);
  return data as EmpresaFilial;
}

export async function updateFilial(
  filialId: number,
  input: FilialFormInput,
): Promise<EmpresaFilial> {
  const razao = input.razao_social.trim();
  if (!razao) throw new Error('Informe a razão social da filial.');

  const payload = {
    cnpj: normalizeCnpj(input.cnpj),
    razao_social: razao,
    nome_fantasia: emptyToNull(input.nome_fantasia),
    endereco: emptyToNull(input.endereco),
    cidade: emptyToNull(input.cidade),
    estado: emptyToNull(input.estado)?.toUpperCase().slice(0, 2) ?? null,
    cep: digitsOnly(input.cep ?? '') || null,
    telefone: digitsOnly(input.telefone ?? '') || null,
    email: emptyToNull(input.email),
    status: input.status?.trim() || 'Ativo',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('filiais')
    .update(payload)
    .eq('id', filialId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as EmpresaFilial;
}

export async function deleteFilial(filialId: number): Promise<void> {
  const { error } = await supabase.from('filiais').delete().eq('id', filialId);
  if (error) throw new Error(error.message);
}

export function empresaToForm(empresa: Empresa | null): EmpresaFormInput {
  if (!empresa) {
    return {
      cnpj: '',
      razao_social: '',
      nome_fantasia: '',
      inscricao_estadual: '',
      endereco: '',
      cidade: '',
      estado: 'MA',
      cep: '',
      telefone: '',
      email: '',
    };
  }

  return {
    cnpj: formatCnpjDisplay(empresa.cnpj).replace('—', ''),
    razao_social: empresa.razao_social,
    nome_fantasia: empresa.nome_fantasia ?? '',
    inscricao_estadual: empresa.inscricao_estadual ?? '',
    endereco: empresa.endereco ?? '',
    cidade: empresa.cidade ?? '',
    estado: empresa.estado ?? 'MA',
    cep: empresa.cep ?? '',
    telefone: empresa.telefone ?? '',
    email: empresa.email ?? '',
  };
}

export function filialToForm(filial: EmpresaFilial): FilialFormInput {
  return {
    cnpj: formatCnpjDisplay(filial.cnpj).replace('—', ''),
    razao_social: filial.razao_social,
    nome_fantasia: filial.nome_fantasia ?? '',
    endereco: filial.endereco ?? '',
    cidade: filial.cidade ?? '',
    estado: filial.estado ?? 'MA',
    cep: filial.cep ?? '',
    telefone: filial.telefone ?? '',
    email: filial.email ?? '',
    status: filial.status || 'Ativo',
  };
}
