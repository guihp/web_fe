export type Usuario = {
  id: number;
  nome: string;
  telefone: string | null;
  cpf: string;
  cargo: string;
  cidade: string | null;
  estado_id: string | null;
  status: boolean | null;
  nivel_acesso: string | null;
  email: string | null;
};

const ESTADOS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

export function formatLocal(cidade?: string | null, estadoId?: string | null) {
  const cidadeStr = cidade?.trim() || '';
  const estado = estadoId?.trim()
    ? ESTADOS[estadoId.trim().toUpperCase()] || estadoId.trim()
    : '';

  if (cidadeStr && estado) return `${cidadeStr}/${estado}`;
  return cidadeStr || estado || '—';
}

export function formatCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatPhone(phone?: string | null) {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

export function getEstadoNome(estadoId?: string | null) {
  if (!estadoId?.trim()) return '—';
  return ESTADOS[estadoId.trim().toUpperCase()] || estadoId.trim();
}
