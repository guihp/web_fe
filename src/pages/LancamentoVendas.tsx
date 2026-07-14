import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { fetchIndustrias } from '../services/atividadesService';
import { fetchClienteByCdc } from '../services/clienteService';
import { createVenda, parseValor } from '../services/vendaService';
import {
  CATEGORIAS_VENDAS,
  emptyLancamentoForm,
  type LancamentoVendaForm,
} from '../data/lancamentoVendasData';
import { VENDEDORES } from '../utils/vendasDomain';
import './LancamentoVendas.css';

function maskCdc(value: string) {
  return value.replace(/\D/g, '').slice(0, 4);
}

function maskValor(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const number = Number(digits) / 100;
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LancamentoVendas() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState<LancamentoVendaForm>(emptyLancamentoForm);
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    fetchIndustrias()
      .then((data) => {
        const nomes = data.map((item) => item.Nome);
        if (nomes.length > 0) {
          setIndustrias(nomes);
          setForm((prev) => ({ ...prev, industria: prev.industria || nomes[0] }));
        }
      })
      .catch(() => {
        setIndustrias(['Haribo', 'Nestlé', 'Coca-Cola']);
      });
  }, []);

  const updateField = (field: keyof LancamentoVendaForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleCdcLookup = async (cdc: string) => {
    const digits = cdc.replace(/\D/g, '');
    if (digits.length !== 4) return;

    setLookupLoading(true);
    try {
      const cliente = await fetchClienteByCdc(digits);
      if (cliente) {
        setForm((prev) => ({
          ...prev,
          cdc: cliente.cdc,
          cnpj: cliente.cnpj ?? prev.cnpj,
          nomeFantasia: cliente.nome_fantasia?.trim() ?? '',
          cidade: cliente.cidade ?? '',
          estado: cliente.estado ?? prev.estado,
        }));
      }
    } catch {
      // silent on lookup failure
    } finally {
      setLookupLoading(false);
    }
  };

  const handleClear = () => {
    setForm(emptyLancamentoForm());
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.cdc.trim() || !form.pedido.trim() || !form.valor.trim()) {
      setError('Preencha os campos obrigatórios: CDC, Pedido e Valor.');
      return;
    }

    if (form.cdc.replace(/\D/g, '').length !== 4) {
      setError('O CDC deve ter exatamente 4 dígitos.');
      return;
    }

    const valor = parseValor(form.valor);
    if (valor <= 0) {
      setError('Informe um valor válido.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createVenda(form);
      showToast(`Venda do pedido ${form.pedido} lançada com sucesso!`, 'success');
      handleClear();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao lançar venda.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lancamento-page">
      <header className="lancamento-header">
        <div>
          <h1 className="page-title">Lançamento de Vendas</h1>
          <p className="lancamento-subtitle">Registre novas vendas no sistema</p>
        </div>
      </header>

      <section className="card lancamento-card">
        <div className="lancamento-card-head">
          <h2>Dados da Venda</h2>
          <p>OBS: O CDC corresponde aos 4 últimos dígitos do CNPJ {lookupLoading && '(buscando cliente...)'}</p>
        </div>

        <div className="lancamento-grid">
          <label className="lancamento-field">
            <span>Data de Lançamento</span>
            <input
              type="date"
              value={form.dataLancamento}
              onChange={(e) => updateField('dataLancamento', e.target.value)}
            />
          </label>

          <label className="lancamento-field">
            <span>
              CDC <em>*</em>
            </span>
            <input
              type="text"
              placeholder="4 últimos dígitos"
              value={form.cdc}
              onChange={(e) => updateField('cdc', maskCdc(e.target.value))}
              onBlur={(e) => handleCdcLookup(e.target.value)}
            />
          </label>

          <label className="lancamento-field">
            <span>CNPJ</span>
            <input
              type="text"
              placeholder="CNPJ do cliente"
              value={form.cnpj}
              readOnly
            />
          </label>

          <label className="lancamento-field">
            <span>
              Pedido <em>*</em>
            </span>
            <input
              type="text"
              placeholder="Número do pedido"
              value={form.pedido}
              onChange={(e) => updateField('pedido', e.target.value)}
            />
          </label>

          <label className="lancamento-field">
            <span>
              Valor (R$) <em>*</em>
            </span>
            <input
              type="text"
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => updateField('valor', maskValor(e.target.value))}
            />
          </label>

          <label className="lancamento-field">
            <span>Indústria</span>
            <div className="lancamento-select-wrap">
              <select value={form.industria} onChange={(e) => updateField('industria', e.target.value)}>
                {industrias.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="lancamento-field">
            <span>Categoria</span>
            <div className="lancamento-select-wrap">
              <select value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)}>
                <option value="">Selecione a categoria</option>
                {CATEGORIAS_VENDAS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="lancamento-field">
            <span>Vendedor</span>
            <div className="lancamento-select-wrap">
              <select value={form.vendedor} onChange={(e) => updateField('vendedor', e.target.value)}>
                {VENDEDORES.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="lancamento-field">
            <span>Nome Fantasia</span>
            <input type="text" placeholder="Nome do cliente" value={form.nomeFantasia} readOnly />
          </label>

          <label className="lancamento-field">
            <span>Estado</span>
            <input type="text" value={form.estado} readOnly />
          </label>

          <label className="lancamento-field">
            <span>Cidade</span>
            <input type="text" placeholder="Nome da cidade" value={form.cidade} readOnly />
          </label>
        </div>

        {error && <p className="lancamento-feedback error">{error}</p>}

        <div className="lancamento-actions">
          <button type="button" className="lancamento-btn primary" disabled={submitting} onClick={handleSubmit}>
            <span>🚀</span> {submitting ? 'LANÇANDO...' : 'LANÇAR'}
          </button>
          <button type="button" className="lancamento-btn outline" onClick={handleClear}>
            <span>🗑</span> APAGAR
          </button>
          <button type="button" className="lancamento-btn soft" onClick={() => navigate('/clientes')}>
            <span>👤+</span> NOVO CLIENTE
          </button>
        </div>
      </section>
    </div>
  );
}
