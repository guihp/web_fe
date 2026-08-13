import { useEffect, useState } from 'react';
import {
  CATEGORIAS_VENDAS,
  ESTADOS_VENDAS,
} from '../../data/lancamentoVendasData';
import { fetchIndustriaNomes } from '../../services/industriaService';
import { parseValor, updateVenda } from '../../services/vendaService';
import {
  MESES_PT,
  VENDEDORES,
  mesAnoFromDate,
  normalizeEstado,
  type BaseVenda,
} from '../../utils/vendasDomain';
import ModalShell from '../colaboradores/ModalShell';

type EditVendaModalProps = {
  venda: BaseVenda;
  onClose: () => void;
  onSuccess: () => void;
};

type EditForm = {
  data: string;
  cdc: string;
  numero_pedido: string;
  valor: string;
  industria: string;
  categoria: string;
  vendedor: string;
  cliente: string;
  cnpj: string;
  cidade: string;
  estado: string;
  mes: string;
  ano: string;
};

function maskValor(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const number = Number(digits) / 100;
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function valorToMasked(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function vendaToForm(venda: BaseVenda): EditForm {
  return {
    data: (venda.data ?? '').slice(0, 10),
    cdc: venda.cdc ?? '',
    numero_pedido: venda.numero_pedido ?? '',
    valor: valorToMasked(Number(venda.valor) || 0),
    industria: venda.industria ?? '',
    categoria: venda.categoria ?? '',
    vendedor: venda.vendedor ?? VENDEDORES[0],
    cliente: venda.cliente ?? '',
    cnpj: venda.cnpj ?? '',
    cidade: venda.cidade ?? '',
    estado: venda.estado ?? 'MARANHÃO',
    mes: (venda.mes ?? 'JANEIRO').toUpperCase(),
    ano: venda.ano ?? String(new Date().getFullYear()),
  };
}

export default function EditVendaModal({ venda, onClose, onSuccess }: EditVendaModalProps) {
  const [form, setForm] = useState<EditForm>(() => vendaToForm(venda));
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIndustriaNomes()
      .then((nomes) => {
        setIndustrias(nomes);
        setForm((prev) => {
          if (prev.industria && nomes.includes(prev.industria)) return prev;
          if (prev.industria) return prev;
          return { ...prev, industria: nomes[0] ?? '' };
        });
      })
      .catch(() => setIndustrias([]));
  }, []);

  const updateField = (field: keyof EditForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'data' && value) {
        const { mes, ano } = mesAnoFromDate(value);
        next.mes = mes;
        next.ano = ano;
      }
      return next;
    });
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.cdc.trim() || !form.numero_pedido.trim() || !form.data) {
      setError('Preencha data, CDC e número do pedido.');
      return;
    }
    const valor = parseValor(form.valor);
    if (valor <= 0) {
      setError('Informe um valor válido.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateVenda(venda.id, {
        data: form.data,
        cdc: form.cdc.trim(),
        numero_pedido: form.numero_pedido.trim(),
        valor,
        industria: form.industria || null,
        categoria: form.categoria || null,
        vendedor: form.vendedor || null,
        cliente: form.cliente.trim() || null,
        cnpj: form.cnpj.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: normalizeEstado(form.estado),
        mes: form.mes.toUpperCase(),
        ano: form.ano,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar venda.');
    } finally {
      setSaving(false);
    }
  };

  const anos = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - 2 + i));
  const industriaOptions = Array.from(
    new Set([...(form.industria ? [form.industria] : []), ...industrias]),
  );
  const categoriaOptions = Array.from(
    new Set([...(form.categoria ? [form.categoria] : []), ...CATEGORIAS_VENDAS]),
  );
  const estadoOptions = Array.from(
    new Set([form.estado, ...ESTADOS_VENDAS.map((e) => normalizeEstado(e)), 'MARANHÃO', 'PIAUÍ', 'PARÁ']),
  );

  return (
    <ModalShell onClose={onClose}>
      <div className="colab-modal-header">
        <h2>Editar Venda</h2>
        <p>Pedido {venda.numero_pedido}</p>
      </div>

      <div className="colab-form">
        <div className="colab-row">
          <label className="colab-field">
            <span>Data</span>
            <input
              type="date"
              value={form.data}
              onChange={(e) => updateField('data', e.target.value)}
            />
          </label>
          <label className="colab-field">
            <span>CDC</span>
            <input value={form.cdc} onChange={(e) => updateField('cdc', e.target.value)} />
          </label>
        </div>

        <div className="colab-row">
          <label className="colab-field">
            <span>Nº Pedido</span>
            <input
              value={form.numero_pedido}
              onChange={(e) => updateField('numero_pedido', e.target.value)}
            />
          </label>
          <label className="colab-field">
            <span>Valor (R$)</span>
            <input
              value={form.valor}
              onChange={(e) => updateField('valor', maskValor(e.target.value))}
              inputMode="decimal"
            />
          </label>
        </div>

        <div className="colab-row">
          <label className="colab-field">
            <span>Indústria</span>
            <div className="colab-select-wrap">
              <select
                value={form.industria}
                onChange={(e) => updateField('industria', e.target.value)}
              >
                {industriaOptions.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="colab-field">
            <span>Categoria</span>
            <div className="colab-select-wrap">
              <select
                value={form.categoria}
                onChange={(e) => updateField('categoria', e.target.value)}
              >
                <option value="">Sem categoria</option>
                {categoriaOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <div className="colab-row">
          <label className="colab-field">
            <span>Vendedor</span>
            <div className="colab-select-wrap">
              <select value={form.vendedor} onChange={(e) => updateField('vendedor', e.target.value)}>
                {VENDEDORES.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="colab-field">
            <span>Cliente</span>
            <input value={form.cliente} onChange={(e) => updateField('cliente', e.target.value)} />
          </label>
        </div>

        <div className="colab-row">
          <label className="colab-field">
            <span>CNPJ</span>
            <input value={form.cnpj} onChange={(e) => updateField('cnpj', e.target.value)} />
          </label>
          <label className="colab-field">
            <span>Cidade</span>
            <input value={form.cidade} onChange={(e) => updateField('cidade', e.target.value)} />
          </label>
        </div>

        <div className="colab-row">
          <label className="colab-field">
            <span>Estado</span>
            <div className="colab-select-wrap">
              <select value={form.estado} onChange={(e) => updateField('estado', e.target.value)}>
                {estadoOptions.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="colab-field">
            <span>Mês</span>
            <div className="colab-select-wrap">
              <select value={form.mes} onChange={(e) => updateField('mes', e.target.value)}>
                {MESES_PT.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <label className="colab-field">
          <span>Ano</span>
          <div className="colab-select-wrap">
            <select value={form.ano} onChange={(e) => updateField('ano', e.target.value)}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </label>

        {error && <p className="colab-error">{error}</p>}

        <div className="colab-actions">
          <button type="button" className="colab-btn primary" disabled={saving} onClick={handleSubmit}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="colab-btn outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
