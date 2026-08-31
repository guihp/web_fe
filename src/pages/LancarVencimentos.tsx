import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { canLancarVencimentos } from '../data/portalModules';
import { brDateToIso, maskDateBrInput } from '../lib/cpf';
import { fetchProdutoByCodigo } from '../services/codigosService';
import { fetchIndustriasAtivas } from '../services/industriaService';
import {
  fetchLojas,
  formatLojaNome,
  type Loja,
} from '../services/lojasService';
import {
  maskPriceBrInput,
  submitLancarVencimento,
} from '../services/lancarVencimentoService';
import { industriasMatch } from '../utils/vendasDomain';
import './LancarVencimentos.css';

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

export default function LancarVencimentos() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const allowed = canLancarVencimentos(user?.tipo_usuario);

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeLookup, setCodeLookup] = useState<
    'idle' | 'loading' | 'found' | 'not_found'
  >('idle');

  const [promoterName, setPromoterName] = useState(user?.nome ?? '');
  const [lojaId, setLojaId] = useState('');
  const [state, setState] = useState('');
  const [code, setCode] = useState('');
  const [dateBr, setDateBr] = useState('');
  const [description, setDescription] = useState('');
  const [batch, setBatch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [industria, setIndustria] = useState('');

  const selectedLoja = useMemo(
    () => lojas.find((l) => String(l.id) === lojaId) ?? null,
    [lojas, lojaId],
  );

  const industriaOptions = useMemo(() => {
    const set = new Set(industrias);
    if (industria.trim()) set.add(industria.trim());
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [industrias, industria]);

  useEffect(() => {
    if (!allowed) return;
    Promise.all([fetchLojas(), fetchIndustriasAtivas()])
      .then(([lojasData, indData]) => {
        setLojas(lojasData.filter((l) => !l.status || l.status === 'Ativo'));
        setIndustrias(
          indData
            .map((i) => i.Nome)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'pt-BR')),
        );
      })
      .catch(() => {
        setLojas([]);
        setIndustrias([]);
      })
      .finally(() => setLoadingOpts(false));
  }, [allowed]);

  /** Ao digitar o código, busca produto + indústria em `codigos`. */
  useEffect(() => {
    if (!allowed) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length < 4) {
      setCodeLookup('idle');
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setCodeLookup('loading');
        try {
          const row = await fetchProdutoByCodigo(digits);
          if (cancelled) return;
          if (!row) {
            setCodeLookup('not_found');
            return;
          }
          if (row.produto) setDescription(row.produto);
          if (row.industria) {
            const match =
              industrias.find((nome) => industriasMatch(nome, row.industria)) ??
              row.industria;
            setIndustria(match);
          }
          setCodeLookup('found');
        } catch {
          if (!cancelled) setCodeLookup('not_found');
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [allowed, code, industrias]);

  if (!allowed) {
    return <Navigate to="/atividades" replace />;
  }

  const handleLojaChange = (id: string) => {
    setLojaId(id);
    const loja = lojas.find((l) => String(l.id) === id);
    if (loja?.estado) {
      setState(loja.estado.trim().toUpperCase().slice(0, 2));
    }
  };

  const resetForm = () => {
    setLojaId('');
    setState('');
    setCode('');
    setDateBr('');
    setDescription('');
    setBatch('');
    setQuantity('');
    setPrice('');
    setIndustria('');
    setCodeLookup('idle');
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!promoterName.trim()) {
      setError('Informe o nome do promotor.');
      return;
    }
    if (!selectedLoja) {
      setError('Selecione a loja.');
      return;
    }
    if (!state.trim()) {
      setError('Selecione o estado.');
      return;
    }
    if (!code.trim()) {
      setError('Informe o código reduzido.');
      return;
    }
    const dateIso = brDateToIso(dateBr);
    if (!dateIso) {
      setError('Data de vencimento inválida. Use DD/MM/AAAA.');
      return;
    }
    if (!description.trim()) {
      setError('Informe o nome do produto.');
      return;
    }
    if (!batch.trim()) {
      setError('Informe o lote.');
      return;
    }
    if (!quantity.trim()) {
      setError('Informe a quantidade.');
      return;
    }
    if (!price.trim()) {
      setError('Informe o preço.');
      return;
    }
    if (!industria.trim()) {
      setError('Selecione a indústria.');
      return;
    }

    const storeCode =
      selectedLoja.codigo != null ? String(selectedLoja.codigo) : String(selectedLoja.id);

    setSending(true);
    try {
      await submitLancarVencimento({
        promoterName: promoterName.trim(),
        store: storeCode,
        state: state.trim().toUpperCase(),
        code: code.trim(),
        description: description.trim(),
        batch: batch.trim(),
        quantity: quantity.trim(),
        price: price.trim(),
        storeName: selectedLoja.Nome.trim(),
        industria: industria.trim(),
        date: dateIso,
        submittedAt: new Date().toISOString(),
      });
      showToast('Vencimento enviado com sucesso.', 'success');
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao enviar vencimento.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="lancar-venc-page">
      <BackToPortal to="/atividades" label="Voltar às Atividades" />

      <header>
        <h1 className="page-title">Lançar vencimentos</h1>
        <p className="lancar-venc-subtitle">
          Registre produtos próximos do vencimento. O envio usa o mesmo fluxo do webhook comercial.
        </p>
      </header>

      <form className="lancar-venc-card" onSubmit={(e) => void handleSubmit(e)}>
        <h2>Controle de validade</h2>

        {loadingOpts ? (
          <p className="lancar-venc-subtitle">Carregando lojas e indústrias…</p>
        ) : (
          <div className="lancar-venc-grid">
            <label className="lancar-venc-field full">
              <span>Nome promotor</span>
              <input
                type="text"
                value={promoterName}
                onChange={(e) => setPromoterName(e.target.value)}
                placeholder="Nome do promotor"
                required
              />
            </label>

            <label className="lancar-venc-field full">
              <span>Loja</span>
              <select value={lojaId} onChange={(e) => handleLojaChange(e.target.value)} required>
                <option value="">Selecionar a loja</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {formatLojaNome(loja)}
                  </option>
                ))}
              </select>
            </label>

            <label className="lancar-venc-field">
              <span>Estado</span>
              <select value={state} onChange={(e) => setState(e.target.value)} required>
                <option value="">Selecionar o estado</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>

            <label className="lancar-venc-field">
              <span>Código reduzido</span>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 20))}
                placeholder="Código"
                required
              />
              {codeLookup === 'loading' && (
                <small className="lancar-venc-hint">Buscando produto…</small>
              )}
              {codeLookup === 'found' && (
                <small className="lancar-venc-hint ok">Produto e indústria preenchidos.</small>
              )}
              {codeLookup === 'not_found' && (
                <small className="lancar-venc-hint warn">
                  Código não encontrado — preencha produto e indústria manualmente.
                </small>
              )}
            </label>

            <label className="lancar-venc-field">
              <span>Data de vencimento</span>
              <input
                type="text"
                inputMode="numeric"
                value={dateBr}
                onChange={(e) => setDateBr(maskDateBrInput(e.target.value))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                required
              />
            </label>

            <label className="lancar-venc-field">
              <span>Indústria</span>
              <select
                value={industria}
                onChange={(e) => setIndustria(e.target.value)}
                required
              >
                <option value="">Selecionar indústria</option>
                {industriaOptions.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="lancar-venc-field full">
              <span>Nome produto</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nome do produto"
                rows={2}
                required
              />
            </label>

            <label className="lancar-venc-field">
              <span>Lote</span>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="Lote"
                required
              />
            </label>

            <label className="lancar-venc-field">
              <span>Quantidade</span>
              <input
                type="text"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="Quantidade"
                required
              />
            </label>

            <label className="lancar-venc-field">
              <span>Preço</span>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(maskPriceBrInput(e.target.value))}
                placeholder="0,00"
                required
              />
            </label>
          </div>
        )}

        {error && <p className="lancar-venc-error">{error}</p>}

        <div className="lancar-venc-actions">
          <Link to="/atividades" className="lancar-venc-btn outline">
            Cancelar
          </Link>
          <button type="submit" className="lancar-venc-btn primary" disabled={sending || loadingOpts}>
            {sending ? 'Enviando…' : 'Validar'}
          </button>
        </div>
      </form>
    </div>
  );
}
