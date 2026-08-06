import * as XLSX from 'xlsx';
import type { ClienteForm } from '../data/clientesData';
import type { BaseCliente, BaseVenda } from '../utils/vendasDomain';
import { formatCdc, mesAnoFromDate, MESES_PT, VENDEDORES } from '../utils/vendasDomain';

export type VendaImportRow = {
  data: string;
  cdc: string;
  numero_pedido: string;
  valor: number;
  industria: string;
  categoria?: string;
  vendedor: string;
  cliente?: string;
  cnpj?: string;
  cidade?: string;
  estado?: string;
  mes?: string;
  ano?: string;
};

/** Colunas alinhadas à tabela public."baseVendas" (exceto id/created_at). */
export const VENDA_SHEET_HEADERS = [
  'data',
  'cdc',
  'numero_pedido',
  'valor',
  'industria',
  'categoria',
  'vendedor',
  'cliente',
  'cnpj',
  'cidade',
  'estado',
  'mes',
  'ano',
] as const;

const VENDA_EXAMPLE_ROW: VendaImportRow = {
  data: '2025-03-15',
  cdc: '1102',
  numero_pedido: 'PED-2025-0001',
  valor: 1850.75,
  industria: 'Haribo Brasil',
  categoria: 'FEIJÃO',
  vendedor: 'JOAO ANTONIO',
  cliente: '141 - SENDAS - TURU',
  cnpj: '06057223014100',
  cidade: 'SAO LUIS',
  estado: 'MARANHAO',
  mes: 'MARÇO',
  ano: '2025',
};

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  const lowerMap = new Map(
    Object.entries(row).map(([k, v]) => [
      k.toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''),
      v,
    ]),
  );
  for (const key of keys) {
    const normalized = key.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const value = lowerMap.get(normalized);
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function excelDateToISO(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }

  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const br = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const asDate = new Date(raw);
  if (!Number.isNaN(asDate.getTime())) {
    return excelDateToISO(asDate);
  }

  return raw.slice(0, 10);
}

function parseMoneyCell(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (raw.includes(',') && raw.includes('.')) {
    return Number(raw.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (raw.includes(',')) {
    return Number(raw.replace(',', '.')) || 0;
  }
  return Number(raw) || 0;
}

function normalizeVendedorCell(value: string): string {
  const raw = value.trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  const match = VENDEDORES.find(
    (nome) => nome.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '') === raw,
  );
  return match ?? 'JOAO ANTONIO';
}

function normalizeMes(value: string, dataIso: string): string {
  const upper = value.trim().toUpperCase();
  if ((MESES_PT as readonly string[]).includes(upper)) return upper;
  if (dataIso) return mesAnoFromDate(dataIso).mes;
  return upper;
}

function sheetFromVendaRows(rows: Record<string, string | number>[], sheetName: string) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...VENDA_SHEET_HEADERS] });
  ws['!cols'] = VENDA_SHEET_HEADERS.map((h) => ({
    wch: Math.max(14, h.length + 2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/** Colunas alinhadas à tabela public."baseCliente" (exceto id/created_at). */
export const CLIENTE_SHEET_HEADERS = [
  'cdc',
  'cnpj',
  'nome_fantasia',
  'razao_social',
  'cidade',
  'estado',
  'status',
] as const;

const CLIENTE_EXAMPLE_ROW = {
  cdc: '1102',
  cnpj: '06057223014100',
  nome_fantasia: '141 - SENDAS - TURU',
  razao_social: 'SENDAS DISTRIBUIDORA S/A',
  cidade: 'SAO LUIS',
  estado: 'MARANHAO',
  status: 'Ativo',
};

function sheetFromClienteRows(rows: Record<string, string>[], sheetName: string) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...CLIENTE_SHEET_HEADERS] });
  ws['!cols'] = CLIENTE_SHEET_HEADERS.map((h) => ({
    wch: Math.max(14, h.length + 2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

function normalizeStatusCliente(value: string): 'Ativo' | 'Inativo' {
  const raw = value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (raw === 'inativo' || raw === 'inactive' || raw === '0' || raw === 'nao' || raw === 'não') {
    return 'Inativo';
  }
  return 'Ativo';
}

export function exportClientesXlsx(clientes: BaseCliente[]) {
  if (clientes.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[...CLIENTE_SHEET_HEADERS]]);
    ws['!cols'] = CLIENTE_SHEET_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `base-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }

  const rows = clientes.map((c) => ({
    cdc: c.cdc,
    cnpj: c.cnpj ?? '',
    nome_fantasia: c.nome_fantasia ?? '',
    razao_social: c.razao_social ?? '',
    cidade: c.cidade ?? '',
    estado: c.estado ?? '',
    status: c.status || 'Ativo',
  }));

  const wb = sheetFromClienteRows(rows, 'Clientes');
  XLSX.writeFile(wb, `base-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadClienteTemplate() {
  const wb = sheetFromClienteRows([{ ...CLIENTE_EXAMPLE_ROW }], 'Modelo');

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Instruções para importar clientes'],
    [''],
    ['1. Use a aba "Modelo" como referência (1 linha de exemplo completa).'],
    ['2. Mantenha os nomes das colunas exatamente iguais ao cabeçalho.'],
    ['3. cdc: 4 dígitos (chave única — se já existir, o cadastro é atualizado).'],
    ['4. cnpj: pode ir com ou sem pontuação (14 dígitos).'],
    ['5. estado: ex. MARANHAO, PIAUI, PARA (ou com acento).'],
    ['6. status: Ativo ou Inativo (padrão Ativo se vazio).'],
    ['7. Salve como .xlsx ou .csv e use "Importar Excel" na Base de Clientes.'],
    [''],
    ['Colunas (compatíveis com a tabela baseCliente no Supabase):'],
    [CLIENTE_SHEET_HEADERS.join(' | ')],
  ]);
  XLSX.utils.book_append_sheet(wb, instructions, 'Instrucoes');
  XLSX.writeFile(wb, 'modelo-clientes.xlsx');
}

export function parseClientesXlsx(file: File): Promise<ClienteForm[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName =
          wb.SheetNames.find((name) => name.toLowerCase() !== 'instrucoes') ?? wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        const clientes: ClienteForm[] = rows.map((row) => ({
          cdc: formatCdc(cell(row, 'cdc', 'CDC')),
          cnpj: cell(row, 'cnpj', 'CNPJ').replace(/\D/g, '') || cell(row, 'cnpj', 'CNPJ'),
          nomeFantasia: cell(
            row,
            'nome_fantasia',
            'nome fantasia',
            'Nome Fantasia',
            'nomeFantasia',
          ),
          razaoSocial: cell(
            row,
            'razao_social',
            'razao social',
            'Razão Social',
            'Razao Social',
            'razaoSocial',
          ),
          cidade: cell(row, 'cidade', 'Cidade'),
          estado: cell(row, 'estado', 'Estado') || 'MARANHAO',
          status: normalizeStatusCliente(cell(row, 'status', 'Status')),
        }));

        const valid = clientes.filter((c) => c.cdc && c.nomeFantasia);
        if (valid.length === 0) {
          reject(
            new Error(
              'Nenhum cliente válido encontrado. Verifique o modelo (cdc e nome_fantasia são obrigatórios).',
            ),
          );
          return;
        }
        resolve(valid);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao ler arquivo de clientes.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportVendasXlsx(vendas: BaseVenda[]) {
  if (vendas.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[...VENDA_SHEET_HEADERS]]);
    ws['!cols'] = VENDA_SHEET_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
    XLSX.writeFile(wb, `base-vendas-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }

  const rows = vendas.map((v) => ({
    data: v.data,
    cdc: v.cdc,
    numero_pedido: v.numero_pedido,
    valor: v.valor,
    industria: v.industria ?? '',
    categoria: v.categoria ?? '',
    vendedor: v.vendedor ?? '',
    cliente: v.cliente ?? '',
    cnpj: v.cnpj ?? '',
    cidade: v.cidade ?? '',
    estado: v.estado ?? '',
    mes: v.mes ?? '',
    ano: v.ano ?? '',
  }));

  const wb = sheetFromVendaRows(rows, 'Vendas');
  XLSX.writeFile(wb, `base-vendas-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadVendaTemplate() {
  const row = {
    data: VENDA_EXAMPLE_ROW.data,
    cdc: VENDA_EXAMPLE_ROW.cdc,
    numero_pedido: VENDA_EXAMPLE_ROW.numero_pedido,
    valor: VENDA_EXAMPLE_ROW.valor,
    industria: VENDA_EXAMPLE_ROW.industria,
    categoria: VENDA_EXAMPLE_ROW.categoria ?? '',
    vendedor: VENDA_EXAMPLE_ROW.vendedor,
    cliente: VENDA_EXAMPLE_ROW.cliente ?? '',
    cnpj: VENDA_EXAMPLE_ROW.cnpj ?? '',
    cidade: VENDA_EXAMPLE_ROW.cidade ?? '',
    estado: VENDA_EXAMPLE_ROW.estado ?? '',
    mes: VENDA_EXAMPLE_ROW.mes ?? '',
    ano: VENDA_EXAMPLE_ROW.ano ?? '',
  };

  const wb = sheetFromVendaRows([row], 'Modelo');

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Instruções para importar vendas'],
    [''],
    ['1. Use a aba "Modelo" como referência (1 linha de exemplo completa).'],
    ['2. Mantenha os nomes das colunas exatamente iguais ao cabeçalho.'],
    ['3. data: use AAAA-MM-DD ou DD/MM/AAAA (Excel também aceita data nativa).'],
    ['4. cdc: 4 dígitos do cliente (busca dados em baseCliente quando existir).'],
    ['5. valor: use número (1500.75) ou formato BR (1.500,75).'],
    ['6. vendedor: SOMENTE um destes: JOAO ANTONIO | PAULO FREITAS | GEREMIAS SOUSA'],
    ['7. mes/ano: opcionais — se vazios, são calculados a partir da data.'],
    ['8. Salve como .xlsx ou .csv e use "Importar Excel" na Base de Vendas.'],
    [''],
    ['Colunas (compatíveis com a tabela baseVendas no Supabase):'],
    [VENDA_SHEET_HEADERS.join(' | ')],
  ]);
  XLSX.utils.book_append_sheet(wb, instructions, 'Instrucoes');

  XLSX.writeFile(wb, 'modelo-vendas.xlsx');
}

export function parseVendasXlsx(file: File): Promise<VendaImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName =
          wb.SheetNames.find((name) => name.toLowerCase() !== 'instrucoes') ?? wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        const vendas: VendaImportRow[] = rows.map((row) => {
          const dataIso = excelDateToISO(
            row.data ?? row.Data ?? row.DATA ?? row['Data da Venda'] ?? '',
          );
          const mesRaw = cell(row, 'mes', 'Mes', 'Mês', 'MES');
          const anoRaw = cell(row, 'ano', 'Ano', 'ANO');
          const derived = dataIso ? mesAnoFromDate(dataIso) : { mes: '', ano: '' };

          return {
            data: dataIso,
            cdc: formatCdc(cell(row, 'cdc', 'CDC')),
            numero_pedido: cell(
              row,
              'numero_pedido',
              'numero pedido',
              'Numero Pedido',
              'pedido',
              'Pedido',
            ),
            valor: parseMoneyCell(row.valor ?? row.Valor ?? row.VALOR),
            industria: cell(row, 'industria', 'Indústria', 'Industria'),
            categoria: cell(row, 'categoria', 'Categoria') || undefined,
            vendedor: normalizeVendedorCell(cell(row, 'vendedor', 'Vendedor')),
            cliente: cell(row, 'cliente', 'Cliente') || undefined,
            cnpj: cell(row, 'cnpj', 'CNPJ') || undefined,
            cidade: cell(row, 'cidade', 'Cidade') || undefined,
            estado: cell(row, 'estado', 'Estado') || undefined,
            mes: normalizeMes(mesRaw, dataIso) || derived.mes || undefined,
            ano: anoRaw || derived.ano || undefined,
          };
        });

        const valid = vendas.filter((v) => v.data && v.cdc && v.numero_pedido && v.valor > 0);
        if (valid.length === 0) {
          reject(
            new Error(
              'Nenhuma venda válida encontrada. Verifique o modelo (data, cdc, numero_pedido e valor).',
            ),
          );
          return;
        }
        resolve(valid);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao ler arquivo de vendas.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}
