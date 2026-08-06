import { ESTADOS_VENDAS } from './lancamentoVendasData';

export type ClienteForm = {
  cnpj: string;
  cdc: string;
  razaoSocial: string;
  nomeFantasia: string;
  cidade: string;
  estado: string;
  status?: 'Ativo' | 'Inativo';
};

export const emptyClienteForm = (): ClienteForm => ({
  cnpj: '',
  cdc: '',
  razaoSocial: '',
  nomeFantasia: '',
  cidade: '',
  estado: 'MARANHAO',
  status: 'Ativo',
});

export { ESTADOS_VENDAS as ESTADOS_CLIENTES };
