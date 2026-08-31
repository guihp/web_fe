import { FormEvent, useEffect, useMemo, useState } from 'react';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchIndustriasAtivas } from '../services/industriaService';
import {
  fetchMinhasAtividadesHoje,
  submitPromotorAntesDepois,
} from '../services/promotorAtividadeService';
import {
  fetchUsuarioLojas,
  formatUsuarioLojaLabel,
  type UsuarioLoja,
} from '../services/usuarioLojasService';
import './PromotorRoteiro.css';

type Step = 'lojas' | 'checkin' | 'industria' | 'fotos';

export default function PromotorRoteiro() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [lojas, setLojas] = useState<UsuarioLoja[]>([]);
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [hojeRows, setHojeRows] = useState<
    Awaited<ReturnType<typeof fetchMinhasAtividadesHoje>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('lojas');
  const [loja, setLoja] = useState<UsuarioLoja | null>(null);
  const [industria, setIndustria] = useState('');
  const [fotoAntes, setFotoAntes] = useState<File | null>(null);
  const [fotoDepois, setFotoDepois] = useState<File | null>(null);
  const [previewAntes, setPreviewAntes] = useState<string | null>(null);
  const [previewDepois, setPreviewDepois] = useState<string | null>(null);

  const firstName = user?.nome?.split(' ')[0] ?? 'Promotor';

  const regionalLabel = useMemo(() => {
    if (!loja) return '';
    const cidade = (loja.cidade ?? '').trim();
    const estado = (loja.estado ?? '').trim().toUpperCase();
    if (cidade && estado) return `${cidade} / ${estado}`;
    return cidade || estado || 'Regional da loja';
  }, [loja]);

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [lojasData, indData, hoje] = await Promise.all([
        fetchUsuarioLojas(user.id),
        fetchIndustriasAtivas(),
        fetchMinhasAtividadesHoje(user.id),
      ]);
      setLojas(lojasData);
      setIndustrias(
        indData
          .map((i) => i.Nome)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, 'pt-BR')),
      );
      setHojeRows(hoje);
    } catch {
      setLojas([]);
      setIndustrias([]);
      setHojeRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (previewAntes) URL.revokeObjectURL(previewAntes);
      if (previewDepois) URL.revokeObjectURL(previewDepois);
    };
  }, [previewAntes, previewDepois]);

  const resetFlow = () => {
    setStep('lojas');
    setLoja(null);
    setIndustria('');
    setFotoAntes(null);
    setFotoDepois(null);
    if (previewAntes) URL.revokeObjectURL(previewAntes);
    if (previewDepois) URL.revokeObjectURL(previewDepois);
    setPreviewAntes(null);
    setPreviewDepois(null);
    setError(null);
  };

  const chooseLoja = (item: UsuarioLoja) => {
    setLoja(item);
    setStep('checkin');
    setError(null);
  };

  const onPickFoto = (kind: 'antes' | 'depois', file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (kind === 'antes') {
      if (previewAntes) URL.revokeObjectURL(previewAntes);
      setFotoAntes(file);
      setPreviewAntes(url);
    } else {
      if (previewDepois) URL.revokeObjectURL(previewDepois);
      setFotoDepois(file);
      setPreviewDepois(url);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id || !loja) return;
    if (!industria.trim()) {
      setError('Selecione a indústria.');
      return;
    }
    if (!fotoAntes || !fotoDepois) {
      setError('Envie a foto de antes e a de depois.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      await submitPromotorAntesDepois({
        usuarioId: user.id,
        loja,
        industria,
        fotoAntes,
        fotoDepois,
      });
      showToast('Atividade enviada com sucesso.', 'success');
      resetFlow();
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao enviar atividade.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="promotor-roteiro-page">
      <BackToPortal />

      <header className="promotor-roteiro-header">
        <div>
          <h1 className="page-title">Meu roteiro</h1>
          <p className="promotor-roteiro-subtitle">
            Olá, {firstName}. Selecione a loja, faça o check-in, escolha a indústria e envie as
            fotos de antes e depois. Localização GPS ainda não é exigida.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="promotor-roteiro-empty">Carregando lojas…</p>
      ) : lojas.length === 0 ? (
        <p className="promotor-roteiro-empty">
          Nenhuma loja cadastrada para você. Peça ao supervisor/gerente para vincular até 7 PDVs no
          seu usuário.
        </p>
      ) : (
        <>
          {step === 'lojas' && (
            <section className="promotor-roteiro-card">
              <h2>Lojas cadastradas</h2>
              <ul className="promotor-loja-list">
                {lojas.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="promotor-loja-card" onClick={() => chooseLoja(item)}>
                      <strong>{item.Nome}</strong>
                      <span>{formatUsuarioLojaLabel(item)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {step === 'checkin' && loja && (
            <section className="promotor-roteiro-card promotor-checkin">
              <h2>Check-In</h2>
              <p className="promotor-checkin-label">Você está em:</p>
              <p className="promotor-checkin-loja">{loja.Nome}</p>
              <p className="promotor-checkin-regional">{regionalLabel}</p>
              <div className="promotor-actions">
                <button type="button" className="promotor-btn outline" onClick={resetFlow}>
                  Cancelar
                </button>
                <button type="button" className="promotor-btn primary" onClick={() => setStep('industria')}>
                  Fazer Check-In
                </button>
              </div>
            </section>
          )}

          {step === 'industria' && loja && (
            <section className="promotor-roteiro-card">
              <h2>Indústrias</h2>
              <p className="promotor-roteiro-subtitle">Loja: {loja.Nome} · {regionalLabel}</p>
              <ul className="promotor-industria-list">
                {industrias.map((nome) => (
                  <li key={nome}>
                    <button
                      type="button"
                      className={`promotor-industria-btn ${industria === nome ? 'is-active' : ''}`}
                      onClick={() => {
                        setIndustria(nome);
                        setStep('fotos');
                      }}
                    >
                      {nome}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="promotor-actions">
                <button type="button" className="promotor-btn outline" onClick={() => setStep('checkin')}>
                  Voltar
                </button>
              </div>
            </section>
          )}

          {step === 'fotos' && loja && (
            <form className="promotor-roteiro-card" onSubmit={(e) => void handleSubmit(e)}>
              <h2>{industria || 'Fotos'}</h2>
              <p className="promotor-roteiro-subtitle">
                {loja.Nome} · {regionalLabel}
              </p>

              <div className="promotor-fotos-grid">
                <label className="promotor-foto-box">
                  <span>1 - Foto de antes *</span>
                  {previewAntes ? (
                    <img src={previewAntes} alt="Prévia antes" />
                  ) : (
                    <span className="promotor-foto-placeholder">Abrir câmera / galeria</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => onPickFoto('antes', e.target.files?.[0] ?? null)}
                  />
                </label>

                <label className="promotor-foto-box">
                  <span>2 - Foto de depois *</span>
                  {previewDepois ? (
                    <img src={previewDepois} alt="Prévia depois" />
                  ) : (
                    <span className="promotor-foto-placeholder">Abrir câmera / galeria</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => onPickFoto('depois', e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {error && <p className="promotor-error">{error}</p>}

              <div className="promotor-actions">
                <button type="button" className="promotor-btn outline" onClick={() => setStep('industria')}>
                  Voltar
                </button>
                <button type="submit" className="promotor-btn primary" disabled={sending}>
                  {sending ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </form>
          )}

          {hojeRows.length > 0 && step === 'lojas' && (
            <section className="promotor-roteiro-card">
              <h2>Envios de hoje</h2>
              <ul className="promotor-hoje-list">
                {hojeRows.map((row) => (
                  <li key={row.id}>
                    <strong>{row.loja}</strong>
                    <span>
                      {row.industria} · {row.status ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
