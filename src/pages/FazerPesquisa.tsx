import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { canLancarVencimentos, isCampoMerchCargo } from '../data/portalModules';
import { fetchIndustriasAtivas } from '../services/industriaService';
import {
  fetchLojas,
  formatLojaNome,
  type Loja,
} from '../services/lojasService';
import {
  createPesquisaInicio,
  type TipoPesquisa,
} from '../services/priceService';
import {
  fetchUsuarioLojas,
  formatUsuarioLojaLabel,
} from '../services/usuarioLojasService';
import './FazerPesquisa.css';

/** UFs das regionais operacionais (MA/PI e PA). */
const UFS = ['MA', 'PI', 'PA'] as const;

function IconBack() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FazerPesquisa() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const allowed = canLancarVencimentos(user?.tipo_usuario);
  const campoMerch = isCampoMerchCargo(user?.cargo);

  const [tipo, setTipo] = useState<TipoPesquisa>('interna');
  const [uf, setUf] = useState('');
  const [lojaId, setLojaId] = useState('');
  const [industria, setIndustria] = useState('');
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOpts(true);
      try {
        const [lojasData, indData] = await Promise.all([
          campoMerch && user?.id
            ? fetchUsuarioLojas(user.id).then((rows) => rows as Loja[])
            : fetchLojas(),
          fetchIndustriasAtivas(),
        ]);
        if (cancelled) return;
        setLojas(lojasData.filter((l) => (l.status ?? 'Ativo') !== 'Inativo'));
        setIndustrias(indData.map((i) => i.Nome).filter(Boolean));
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : 'Erro ao carregar lojas.', 'error');
        }
      } finally {
        if (!cancelled) setLoadingOpts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campoMerch, user?.id, showToast]);

  const lojasFiltradas = useMemo(() => {
    if (!uf) return lojas;
    return lojas.filter((l) => (l.estado ?? '').toUpperCase() === uf);
  }, [lojas, uf]);

  useEffect(() => {
    if (!lojaId) return;
    const still = lojasFiltradas.some((l) => String(l.id) === lojaId);
    if (!still) setLojaId('');
  }, [lojasFiltradas, lojaId]);

  if (!allowed) {
    return <Navigate to="/merchandising" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const loja = lojasFiltradas.find((l) => String(l.id) === lojaId);
    if (!uf) {
      showToast('Selecione o estado.', 'error');
      return;
    }
    if (!loja) {
      showToast('Selecione a loja.', 'error');
      return;
    }
    if (!industria.trim()) {
      showToast(
        tipo === 'interna' ? 'Selecione a indústria.' : 'Informe o fornecedor.',
        'error',
      );
      return;
    }

    setSending(true);
    try {
      const created = await createPesquisaInicio({
        tipo,
        loja: formatLojaNome(loja),
        uf,
        industria: industria.trim(),
        promotor: user?.nome ?? null,
      });
      showToast(
        `Pesquisa ${tipo} iniciada (#${created.id}). Câmera/OCR em breve — contexto salvo no Price.`,
        'success',
      );
      setLojaId('');
      if (tipo === 'externa') setIndustria('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar pesquisa.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fazer-pesquisa-page">
      <header className="fazer-pesquisa-hero">
        <Link to="/merchandising" className="fazer-pesquisa-back" aria-label="Voltar ao Merchandising">
          <IconBack />
        </Link>
        <h1>Fazer Pesquisa</h1>
      </header>

      <form className="fazer-pesquisa-card" onSubmit={handleSubmit}>
        <div className="fazer-pesquisa-fields">
          <div className="fazer-pesquisa-tipo" role="tablist" aria-label="Tipo de pesquisa">
            <button
              type="button"
              role="tab"
              aria-selected={tipo === 'interna'}
              className={tipo === 'interna' ? 'active' : undefined}
              onClick={() => {
                setTipo('interna');
                setIndustria('');
              }}
            >
              Interna
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tipo === 'externa'}
              className={tipo === 'externa' ? 'active' : undefined}
              onClick={() => {
                setTipo('externa');
                setIndustria('');
              }}
            >
              Externa
            </button>
          </div>

          <p className="fazer-pesquisa-hint">
            {tipo === 'interna'
              ? 'Interna: apenas produtos das nossas indústrias.'
              : 'Externa: nosso produto ou concorrência.'}
          </p>

          <fieldset className="fazer-pesquisa-uf" disabled={loadingOpts}>
            <legend className="fazer-pesquisa-label">Estado</legend>
            <div className="fazer-pesquisa-uf-row" role="group" aria-label="Selecione o estado">
              {UFS.map((u) => (
                <button
                  key={u}
                  type="button"
                  className={uf === u ? 'active' : undefined}
                  aria-pressed={uf === u}
                  onClick={() => setUf(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="fazer-pesquisa-field">
            <span className="fazer-pesquisa-label">Nome da Loja</span>
            <span className="fazer-pesquisa-select">
              <select
                value={lojaId}
                onChange={(e) => setLojaId(e.target.value)}
                required
                disabled={loadingOpts || !uf}
              >
                <option value="">
                  {!uf
                    ? 'Selecione o estado primeiro'
                    : lojasFiltradas.length === 0
                      ? campoMerch
                        ? 'Nenhuma loja sua neste estado'
                        : 'Nenhuma loja neste estado'
                      : 'Nome da Loja'}
                </option>
                {lojasFiltradas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {campoMerch ? formatUsuarioLojaLabel(l) : formatLojaNome(l)}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="fazer-pesquisa-field">
            <span className="fazer-pesquisa-label">
              {tipo === 'interna' ? 'Indústria' : 'Nome do Fornecedor'}
            </span>
            {tipo === 'interna' ? (
              <span className="fazer-pesquisa-select">
                <select
                  value={industria}
                  onChange={(e) => setIndustria(e.target.value)}
                  required
                  disabled={loadingOpts}
                >
                  <option value="">Nome do Fornecedor</option>
                  {industrias.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </span>
            ) : (
              <input
                type="text"
                placeholder="Nome do Fornecedor"
                value={industria}
                onChange={(e) => setIndustria(e.target.value)}
                required
                autoComplete="off"
                enterKeyHint="done"
              />
            )}
          </label>
        </div>

        <div className="fazer-pesquisa-actions">
          <button type="submit" className="fazer-pesquisa-camera" disabled={sending || loadingOpts}>
            {sending ? 'Salvando...' : 'Abrir Câmera'}
          </button>
          <p className="fazer-pesquisa-foot">
            A câmera/OCR entra depois. Por agora o contexto já é gravado na tabela do Price.
          </p>
        </div>
      </form>
    </div>
  );
}
