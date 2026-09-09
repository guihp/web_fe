import * as XLSX from 'xlsx';
import type { ClienteForm } from '../data/clientesData';
import type { PesquisaItem } from '../services/priceService';
import type {
  EncarteAviso,
  EncarteEscopo,
  EncarteImportRow,
  EncarteTipo,
} from '../services/encarteService';
import { formatEncarteDateBr, normalizeEncarteDate } from '../services/encarteService';
import type { Validade } from '../services/validadeService';
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
    ['3. cdc: 4 dígitos (chave única, se já existir, o cadastro é atualizado).'],
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
    ['7. mes/ano: opcionais, se vazios, são calculados a partir da data.'],
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

/** Colunas alinhadas à tabela public.validades (exceto id/created_at). */
export const VALIDADE_SHEET_HEADERS = [
  'promotor',
  'lojas',
  'uf',
  'industria',
  'codigo',
  'descricao',
  'preco',
  'qtde_unit',
  'lote',
  'data_vencimento',
] as const;

export function exportValidadesXlsx(validades: Validade[]) {
  if (validades.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[...VALIDADE_SHEET_HEADERS]]);
    ws['!cols'] = VALIDADE_SHEET_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Validades');
    XLSX.writeFile(wb, `validades-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }

  const rows = validades.map((v) => ({
    promotor: v.promotor ?? '',
    lojas: v.lojas ?? '',
    uf: v.uf ?? '',
    industria: v.industria ?? '',
    codigo: v.codigo ?? '',
    descricao: v.descricao ?? '',
    preco: v.preco ?? '',
    qtde_unit: v.qtde_unit ?? '',
    lote: v.lote ?? '',
    data_vencimento: (() => {
      if (!v.data_vencimento) return '';
      const [y, m, d] = v.data_vencimento.slice(0, 10).split('-');
      return y && m && d ? `${d}/${m}/${y}` : v.data_vencimento.slice(0, 10);
    })(),
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: [...VALIDADE_SHEET_HEADERS] });
  ws['!cols'] = VALIDADE_SHEET_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Validades');
  XLSX.writeFile(wb, `validades-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const PRICE_EXTERN_HEADERS = [
  'id',
  'descricao',
  'industria',
  'loja',
  'uf',
  'promotor',
  'preco_varejo',
  'preco_atacado',
  'mes',
  'tipo_pesquisa',
] as const;

const PRICE_INTERN_HEADERS = [
  'id',
  'descricao',
  'industria',
  'loja',
  'uf',
  'promotor',
  'preco_varejo',
  'preco_atacado',
  'preco_custo',
  'mes',
  'tipo_pesquisa',
] as const;

/** Exporta pesquisas. Internas: coluna preco_custo vazia para o usuário preencher e reimportar. */
export function exportPesquisasXlsx(items: PesquisaItem[], tipo: 'interna' | 'externa') {
  const date = new Date().toISOString().slice(0, 10);

  if (tipo === 'externa') {
    const headers = [...PRICE_EXTERN_HEADERS];
    if (items.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pesquisas');
      XLSX.writeFile(wb, `price-externas-${date}.xlsx`);
      return;
    }
    const rows = items.map((p) => ({
      id: p.id,
      descricao: p.descricao,
      industria: p.industria,
      loja: p.loja ?? '',
      uf: p.uf ?? '',
      promotor: p.promotor ?? '',
      preco_varejo: p.preco_varejo ?? '',
      preco_atacado: p.preco_atacado ?? '',
      mes: p.mes ?? '',
      tipo_pesquisa: p.tipo_pesquisa,
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pesquisas');
    XLSX.writeFile(wb, `price-externas-${date}.xlsx`);
    return;
  }

  const headers = [...PRICE_INTERN_HEADERS];
  if (items.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pesquisas');
    XLSX.writeFile(wb, `price-internas-custos-${date}.xlsx`);
    return;
  }

  // preco_custo sempre vazio no export (usuário preenche e reimporta)
  const rows = items.map((p) => ({
    id: p.id,
    descricao: p.descricao,
    industria: p.industria,
    loja: p.loja ?? '',
    uf: p.uf ?? '',
    promotor: p.promotor ?? '',
    preco_varejo: p.preco_varejo ?? '',
    preco_atacado: p.preco_atacado ?? '',
    preco_custo: '',
    mes: p.mes ?? '',
    tipo_pesquisa: p.tipo_pesquisa,
  }));
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pesquisas');
  XLSX.writeFile(wb, `price-internas-custos-${date}.xlsx`);
}

export type PesquisaCustoImportRow = {
  id: number;
  preco_custo: number;
};

/**
 * Lê planilha de custos (export internas).
 * Exige colunas id + preco_custo preenchido; linhas sem custo são ignoradas.
 */
export function parsePesquisasCustoXlsx(file: File): Promise<PesquisaCustoImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName =
          wb.SheetNames.find((name) => name.toLowerCase() !== 'instrucoes') ?? wb.SheetNames[0];
        if (!sheetName) {
          reject(new Error('Planilha sem abas.'));
          return;
        }
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        const out: PesquisaCustoImportRow[] = [];
        const seen = new Set<number>();

        for (const row of rows) {
          const idRaw = row.id ?? row.Id ?? row.ID ?? cell(row, 'id');
          const idNum =
            typeof idRaw === 'number' ? idRaw : Number(String(idRaw ?? '').trim().replace(/\D/g, ''));
          if (!Number.isFinite(idNum) || idNum <= 0) continue;

          const custoRaw =
            row.preco_custo ??
            row['preco_custo'] ??
            row['Preco Custo'] ??
            row['preço_custo'] ??
            row['Preço Custo'] ??
            cell(row, 'preco_custo', 'preço_custo', 'custo', 'pc');

          if (custoRaw === '' || custoRaw == null) continue;

          let custo: number | null = null;
          if (typeof custoRaw === 'number' && Number.isFinite(custoRaw)) {
            custo = custoRaw;
          } else {
            const raw = String(custoRaw).trim();
            if (!raw) continue;
            const normalized = raw.includes(',')
              ? raw.replace(/\./g, '').replace(',', '.')
              : raw.replace(/[^\d.-]/g, '');
            const n = Number(normalized);
            custo = Number.isFinite(n) ? n : null;
          }
          if (custo == null || custo < 0) continue;

          if (seen.has(idNum)) continue;
          seen.add(idNum);
          out.push({ id: idNum, preco_custo: custo });
        }

        if (out.length === 0) {
          reject(
            new Error(
              'Nenhuma linha com id e preco_custo válida. Preencha a coluna preco_custo e tente de novo.',
            ),
          );
          return;
        }

        resolve(out);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Falha ao ler a planilha.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

/** Colunas do modelo de encartes / promoções. */
export const ENCARTE_SHEET_HEADERS = [
  'marca',
  'produto',
  'preco',
  'codigo',
  'tipo',
  'escopo_cliente',
  'lojas',
  'dataPromocao',
  'dataFim',
  'nomeGrupo',
] as const;

const ENCARTE_TIPOS: EncarteTipo[] = ['ENCARTE GERAL', 'ENCARTE INTERNO', 'UNICO'];

const ENCARTE_EXAMPLE_ROW = {
  marca: 'RUPPERS',
  produto: 'BATATA PALHA RUPPERS 800G',
  preco: 22.99,
  codigo: 438577,
  tipo: 'ENCARTE GERAL',
  escopo_cliente: 'MATEUS',
  lojas: '',
  dataPromocao: '01/10/2026',
  dataFim: '15/10/2026',
  nomeGrupo: 'Outubro',
};

function parseEncarteTipo(raw: string): EncarteTipo | null {
  const u = raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (u === 'ENCARTE GERAL') return 'ENCARTE GERAL';
  if (u === 'ENCARTE INTERNO') return 'ENCARTE INTERNO';
  if (u === 'UNICO') return 'UNICO';
  return null;
}

function parseEncarteEscopo(raw: string): EncarteEscopo | null {
  const u = raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (u === 'TODOS') return 'TODOS';
  if (u === 'MATEUS') return 'MATEUS';
  if (u === 'ASSAI' || u === 'ASSAÍ') return 'ASSAI';
  if (u === 'LISTA') return 'LISTA';
  return null;
}

function parseLojasCodigos(raw: string): number[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[,;|/]+/)
    .map((p) => Number(String(p).trim().replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parsePrecoCell(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value)
    .replace(/R\$\s?/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function downloadEncarteTemplate() {
  const ws = XLSX.utils.json_to_sheet([ENCARTE_EXAMPLE_ROW], {
    header: [...ENCARTE_SHEET_HEADERS],
  });
  ws['!cols'] = ENCARTE_SHEET_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Instruções: Lançar promoções/encarte'],
    [''],
    ['tipo: ENCARTE GERAL | ENCARTE INTERNO | UNICO'],
    ['escopo_cliente: TODOS | MATEUS | ASSAI | LISTA'],
    ['lojas: códigos da tabela lojas, separados por vírgula (ex.: 202,255)'],
    ['- ENCARTE GERAL + TODOS/MATEUS/ASSAI: deixe lojas vazio'],
    ['- ENCARTE INTERNO + LISTA: informe 2+ códigos'],
    ['- UNICO + LISTA: informe 1 código'],
    ['Datas: DD/MM/YYYY'],
    ['Mateus inclui Posterus e Carone'],
  ]);
  XLSX.utils.book_append_sheet(wb, instructions, 'Instrucoes');
  XLSX.writeFile(wb, 'modelo-encartes.xlsx');
}

export function exportEncartesXlsx(encartes: EncarteAviso[]) {
  if (encartes.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[...ENCARTE_SHEET_HEADERS]]);
    ws['!cols'] = ENCARTE_SHEET_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Encartes');
    XLSX.writeFile(wb, `encartes-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }

  const rows = encartes.map((e) => ({
    marca: e.marca ?? '',
    produto: e.produto ?? '',
    preco: e.preco ?? '',
    codigo: e.codigo ?? '',
    tipo: e.tipo,
    escopo_cliente: e.escopo_cliente,
    lojas: e.lojaCodigos.join(','),
    dataPromocao: formatEncarteDateBr(e.dataPromocao),
    dataFim: formatEncarteDateBr(e.dataFim),
    nomeGrupo: e.nomeGrupo ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: [...ENCARTE_SHEET_HEADERS] });
  ws['!cols'] = ENCARTE_SHEET_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Encartes');
  XLSX.writeFile(wb, `encartes-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function parseEncartesXlsx(file: File): Promise<EncarteImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName =
          wb.SheetNames.find((name) => name.toLowerCase() !== 'instrucoes') ?? wb.SheetNames[0];
        if (!sheetName) {
          reject(new Error('Planilha sem abas.'));
          return;
        }
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: true,
        });

        const out: EncarteImportRow[] = [];
        for (const row of rows) {
          const produto = cell(row, 'produto', 'Produto', 'descricao');
          if (!produto) continue;

          const tipo = parseEncarteTipo(cell(row, 'tipo', 'Tipo'));
          if (!tipo) {
            reject(new Error(`Tipo inválido na linha de "${produto}". Use: ${ENCARTE_TIPOS.join(' | ')}`));
            return;
          }

          let escopo = parseEncarteEscopo(cell(row, 'escopo_cliente', 'escopo', 'Escopo'));
          if (!escopo) {
            if (tipo === 'ENCARTE GERAL') escopo = 'TODOS';
            else escopo = 'LISTA';
          }

          const lojasCodigos = parseLojasCodigos(cell(row, 'lojas', 'loja', 'Lojas'));
          if (tipo === 'UNICO') {
            escopo = 'LISTA';
            if (lojasCodigos.length !== 1) {
              reject(new Error(`UNICO exige exatamente 1 código em lojas ("${produto}").`));
              return;
            }
          }
          if (tipo === 'ENCARTE INTERNO') {
            escopo = 'LISTA';
            if (lojasCodigos.length < 1) {
              reject(new Error(`ENCARTE INTERNO exige códigos em lojas ("${produto}").`));
              return;
            }
          }
          if (tipo === 'ENCARTE GERAL' && escopo === 'LISTA' && lojasCodigos.length === 0) {
            reject(new Error(`ENCARTE GERAL + LISTA precisa de lojas ("${produto}").`));
            return;
          }

          const dataPromocao = normalizeEncarteDate(
            row.dataPromocao ?? row['Data Promocao'] ?? cell(row, 'dataPromocao', 'data_inicio'),
          );
          const dataFim = normalizeEncarteDate(
            row.dataFim ?? row['Data Fim'] ?? cell(row, 'dataFim', 'data_fim'),
          );
          if (!dataPromocao || !dataFim) {
            reject(new Error(`Datas inválidas em "${produto}". Use DD/MM/YYYY.`));
            return;
          }

          const codigoRaw = cell(row, 'codigo', 'Codigo');
          const codigo =
            codigoRaw === ''
              ? null
              : Number(String(codigoRaw).replace(/\D/g, '')) || null;

          out.push({
            marca: cell(row, 'marca', 'industria', 'Industria') || '',
            produto,
            preco: parsePrecoCell(row.preco ?? row.Preco ?? cell(row, 'preco')),
            codigo,
            tipo,
            escopo_cliente: escopo,
            lojasCodigos: escopo === 'LISTA' ? lojasCodigos : [],
            dataPromocao,
            dataFim,
            nomeGrupo: cell(row, 'nomeGrupo', 'nome_grupo', 'grupo') || null,
          });
        }

        if (out.length === 0) {
          reject(new Error('Nenhuma linha válida encontrada no modelo.'));
          return;
        }
        resolve(out);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Erro ao ler arquivo de encartes.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}
