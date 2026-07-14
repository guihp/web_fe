import * as XLSX from 'xlsx';
import type { ClienteForm } from '../data/clientesData';
import type { BaseCliente, BaseVenda } from '../utils/vendasDomain';
import { formatCdc } from '../utils/vendasDomain';

export function exportClientesXlsx(clientes: BaseCliente[]) {
  const rows = clientes.map((c) => ({
    cdc: c.cdc,
    cnpj: c.cnpj ?? '',
    nome_fantasia: c.nome_fantasia ?? '',
    razao_social: c.razao_social ?? '',
    cidade: c.cidade ?? '',
    estado: c.estado ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, `base-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadClienteTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    {
      cdc: '0159',
      cnpj: '42360111000159',
      nome_fantasia: 'EXEMPLO DISTRIBUIDORA',
      razao_social: 'EXEMPLO DISTRIBUIDORA LTDA',
      cidade: 'IMPERATRIZ',
      estado: 'MARANHÃO',
    },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
  XLSX.writeFile(wb, 'modelo-clientes.xlsx');
}

export function parseClientesXlsx(file: File): Promise<ClienteForm[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        const clientes: ClienteForm[] = rows.map((row) => ({
          cdc: formatCdc(String(row.cdc ?? row.CDC ?? '')),
          cnpj: String(row.cnpj ?? row.CNPJ ?? ''),
          nomeFantasia: String(row.nome_fantasia ?? row.nomeFantasia ?? row['Nome Fantasia'] ?? ''),
          razaoSocial: String(row.razao_social ?? row.razaoSocial ?? row['Razão Social'] ?? ''),
          cidade: String(row.cidade ?? row.Cidade ?? ''),
          estado: String(row.estado ?? row.Estado ?? 'MARANHÃO'),
        }));

        resolve(clientes.filter((c) => c.cdc && c.nomeFantasia));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportVendasXlsx(vendas: BaseVenda[]) {
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

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
  XLSX.writeFile(wb, `base-vendas-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadVendaTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    {
      data: '2026-06-01',
      cdc: '0159',
      numero_pedido: 'PED-001',
      valor: 1500.5,
      industria: 'Haribo',
      categoria: 'Alimentos',
      vendedor: 'JOAO ANTONIO',
    },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
  XLSX.writeFile(wb, 'modelo-vendas.xlsx');
}

export function parseVendasXlsx(file: File): Promise<
  Array<{
    data: string;
    cdc: string;
    numero_pedido: string;
    valor: number;
    industria: string;
    categoria?: string;
    vendedor: string;
  }>
> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);

        const vendas = rows.map((row) => ({
          data: String(row.data ?? row.Data ?? '').slice(0, 10),
          cdc: formatCdc(String(row.cdc ?? row.CDC ?? '')),
          numero_pedido: String(row.numero_pedido ?? row.pedido ?? row.Pedido ?? ''),
          valor: Number(row.valor ?? row.Valor ?? 0),
          industria: String(row.industria ?? row.Indústria ?? row.Industria ?? ''),
          categoria: String(row.categoria ?? row.Categoria ?? ''),
          vendedor: String(row.vendedor ?? row.Vendedor ?? 'JOAO ANTONIO'),
        }));

        resolve(vendas.filter((v) => v.cdc && v.numero_pedido && v.valor > 0));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}
