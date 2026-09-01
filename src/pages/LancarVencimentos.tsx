import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { canLancarVencimentos } from '../data/portalModules';
import { brDateToIso, isoDateToBr, maskDateBrInput } from '../lib/cpf';
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

/** UFs das regionais operacionais (MA/PI e PA). */
const UFS = ['MA', 'PI', 'PA'] as const;

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export default function LancarVencimentos() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const allowed = canLancarVencimentos(user?.tipo_usuario);
  const lojaWrapRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);

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
  const [lojaQuery, setLojaQuery] = useState('');
  const [lojaOpen, setLojaOpen] = useState(false);
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

  const lojasFiltradas = useMemo(() => {
    const q = normalizeSearch(lojaQuery);
    const list = !q
      ? lojas
      : lojas.filter((loja) => {
          const nome = normalizeSearch(loja.Nome);
          const label = normalizeSearch(formatLojaNome(loja));
          const codigo = loja.codigo != null ? String(loja.codigo) : '';
          const id = String(loja.id);
          const cidade = normalizeSearch(loja.cidade ?? '');
          return (
            nome.includes(q) ||
            label.includes(q) ||
            codigo.includes(q) ||
            id.includes(q) ||
            cidade.includes(q)
          );
        });
    return list.slice(0, 60);
  }, [lojas, lojaQuery]);

  const industriaOptions = useMemo(() => {
    const set = new Set(industrias);
    if (industria.trim()) set.add(industria.trim());
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [industrias, industria]);

  const dateIsoValue = brDateToIso(dateBr) ?? '';

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

  useEffect(() => {
    if (!lojaOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (lojaWrapRef.current && !lojaWrapRef.current.contains(event.target as Node)) {
        setLojaOpen(false);
        if (selectedLoja) setLojaQuery(formatLojaNome(selectedLoja));
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [lojaOpen, selectedLoja]);

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

  const selectLoja = (loja: Loja) => {
    setLojaId(String(loja.id));
    setLojaQuery(formatLojaNome(loja));
    setLojaOpen(false);
    if (loja.estado) {
      setState(loja.estado.trim().toUpperCase().slice(0, 2));
    }
  };

  const resetForm = () => {
    setLojaId('');
    setLojaQuery('');
    setLojaOpen(false);
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
      setError('Selecione a loja na lista (digite o nome ou o número).');
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
      setError('Data de vencimento inválida. Use DD/MM/YYYY ou o calendário.');
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

            <div className="lancar-venc-field full" ref={lojaWrapRef}>
              <span>Loja</span>
              <input
                type="search"
                value={lojaQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  setLojaQuery(next);
                  setLojaOpen(true);
                  if (selectedLoja && next !== formatLojaNome(selectedLoja)) {
                    setLojaId('');
                  }
                }}
                onFocus={() => setLojaOpen(true)}
                placeholder="Digite o nome ou número da loja"
                autoComplete="off"
                required={!selectedLoja}
              />
              {lojaOpen && (
                <ul className="lancar-venc-loja-list" role="listbox">
                  {lojasFiltradas.map((loja) => (
                    <li key={loja.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={String(loja.id) === lojaId}
                        className={String(loja.id) === lojaId ? 'is-selected' : undefined}
                        onClick={() => selectLoja(loja)}
                      >
                        {formatLojaNome(loja)}
                      </button>
                    </li>
                  ))}
                  {lojasFiltradas.length === 0 && (
                    <li className="lancar-venc-loja-empty">Nenhuma loja encontrada.</li>
                  )}
                </ul>
              )}
              {selectedLoja && (
                <small className="lancar-venc-hint ok">
                  Selecionada: {formatLojaNome(selectedLoja)}
                </small>
              )}
            </div>

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

            <div className="lancar-venc-field lancar-venc-field--date">
              <span>Data de vencimento</span>
              <div className="lancar-venc-date-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  value={dateBr}
                  onChange={(e) => setDateBr(maskDateBrInput(e.target.value))}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text');
                    setDateBr(maskDateBrInput(text));
                  }}
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  pattern="\d{2}/\d{2}/\d{4}"
                  title="Formato DD/MM/YYYY"
                  autoComplete="off"
                  required
                  aria-label="Data de vencimento DD/MM/YYYY"
                />
                <input
                  ref={datePickerRef}
                  type="date"
                  className="lancar-venc-date-native"
                  value={dateIsoValue}
                  onChange={(e) => setDateBr(isoDateToBr(e.target.value))}
                  tabIndex={-1}
                  aria-hidden
                />
                <button
                  type="button"
                  className="lancar-venc-date-cal-btn"
                  title="Abrir calendário"
                  aria-label="Abrir calendário (opcional)"
                  onClick={() => {
                    const el = datePickerRef.current;
                    if (!el) return;
                    try {
                      el.showPicker();
                    } catch {
                      el.click();
                    }
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="16"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M3 9h18M8 3v4M16 3v4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <small className="lancar-venc-hint">
                Máscara DD/MM/YYYY — digite ou use o calendário.
              </small>
            </div>

            <label className="lancar-venc-field lancar-venc-field--industria">
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
