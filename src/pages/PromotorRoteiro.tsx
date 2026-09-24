import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ModalShell from '../components/colaboradores/ModalShell';
import BackToPortal from '../components/layout/BackToPortal';
import SenhaDoDiaCard from '../components/layout/SenhaDoDiaCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchIndustriasAtivas } from '../services/industriaService';
import {
  cacheIndustrias,
  cacheSenhaDoDia,
  cacheUsuarioLojas,
  readCachedIndustrias,
  readCachedSenhaDoDia,
  readCachedUsuarioLojas,
} from '../services/offlineCacheService';
import {
  enqueuePromotorAntesDepois,
  isLikelyNetworkError,
} from '../services/offlineOutboxService';
import {
  clearPromotorDraft,
  loadPromotorDraftFotos,
  savePromotorDraftFoto,
} from '../services/promotorDraftService';
import {
  fetchMinhasAtividadesHoje,
  submitPromotorAntesDepois,
} from '../services/promotorAtividadeService';
import {
  fetchSenhaDoDia,
  formatDiaBR,
  todayDateKeyBRT,
} from '../services/senhaDoDiaService';
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
  const [fromCache, setFromCache] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [senhaConfirm, setSenhaConfirm] = useState<string | null>(null);
  const [senhaDiaLabel, setSenhaDiaLabel] = useState(() => formatDiaBR(todayDateKeyBRT()));
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('lojas');
  const [loja, setLoja] = useState<UsuarioLoja | null>(null);
  const [industria, setIndustria] = useState('');
  const [fotoAntes, setFotoAntes] = useState<File | null>(null);
  const [fotoDepois, setFotoDepois] = useState<File | null>(null);
  const [previewAntes, setPreviewAntes] = useState<string | null>(null);
  const [previewDepois, setPreviewDepois] = useState<string | null>(null);
  const [draftHint, setDraftHint] = useState(false);
  const previewAntesRef = useRef<string | null>(null);
  const previewDepoisRef = useRef<string | null>(null);
  const restoreGenRef = useRef(0);

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
      const indNomes = indData
        .map((i) => i.Nome)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      setLojas(lojasData);
      setIndustrias(indNomes);
      setHojeRows(hoje);
      setFromCache(false);
      void cacheUsuarioLojas(user.id, lojasData);
      void cacheIndustrias(indNomes);
    } catch {
      const [cachedLojas, cachedInd] = await Promise.all([
        readCachedUsuarioLojas(user.id),
        readCachedIndustrias(),
      ]);
      if (cachedLojas?.length) {
        setLojas(cachedLojas);
        setIndustrias(cachedInd ?? []);
        setHojeRows([]);
        setFromCache(true);
      } else {
        setLojas([]);
        setIndustrias([]);
        setHojeRows([]);
        setFromCache(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [user?.id]);

  const setPreview = (kind: 'antes' | 'depois', nextUrl: string | null) => {
    if (kind === 'antes') {
      if (previewAntesRef.current) URL.revokeObjectURL(previewAntesRef.current);
      previewAntesRef.current = nextUrl;
      setPreviewAntes(nextUrl);
    } else {
      if (previewDepoisRef.current) URL.revokeObjectURL(previewDepoisRef.current);
      previewDepoisRef.current = nextUrl;
      setPreviewDepois(nextUrl);
    }
  };

  /** Restaura fotos do aparelho ao chegar na etapa (sobrevive a fechar o PWA). */
  useEffect(() => {
    if (step !== 'fotos' || !user?.id || !loja || !industria.trim()) return;
    const gen = ++restoreGenRef.current;
    void (async () => {
      try {
        const draft = await loadPromotorDraftFotos({
          usuarioId: user.id,
          lojaId: loja.id,
          industria,
        });
        if (gen !== restoreGenRef.current) return;
        if (draft.fotoAntes) {
          setFotoAntes(draft.fotoAntes);
          setPreview('antes', URL.createObjectURL(draft.fotoAntes));
        }
        if (draft.fotoDepois) {
          setFotoDepois(draft.fotoDepois);
          setPreview('depois', URL.createObjectURL(draft.fotoDepois));
        }
        if (draft.fotoAntes || draft.fotoDepois) setDraftHint(true);
      } catch {
        /* ignore */
      }
    })();
  }, [step, user?.id, loja?.id, industria]);

  // Só revoga no unmount — não quando a outra foto muda (evita quebrar a prévia).
  useEffect(() => {
    return () => {
      if (previewAntesRef.current) URL.revokeObjectURL(previewAntesRef.current);
      if (previewDepoisRef.current) URL.revokeObjectURL(previewDepoisRef.current);
    };
  }, []);

  const resetFlow = () => {
    setStep('lojas');
    setLoja(null);
    setIndustria('');
    setFotoAntes(null);
    setFotoDepois(null);
    setPreview('antes', null);
    setPreview('depois', null);
    setDraftHint(false);
    setConfirmOpen(false);
    setSenhaConfirm(null);
    setError(null);
  };

  const chooseLoja = (item: UsuarioLoja) => {
    setLoja(item);
    setStep('checkin');
    setError(null);
  };

  const onPickFoto = (kind: 'antes' | 'depois', file: File | null) => {
    if (!file || !user?.id || !loja || !industria.trim()) return;
    restoreGenRef.current += 1;
    const url = URL.createObjectURL(file);
    if (kind === 'antes') {
      setFotoAntes(file);
      setPreview('antes', url);
    } else {
      setFotoDepois(file);
      setPreview('depois', url);
    }
    setDraftHint(false);
    void savePromotorDraftFoto({
      usuarioId: user.id,
      lojaId: loja.id,
      industria,
      kind,
      file,
    }).catch(() => {
      /* rascunho best-effort */
    });
  };

  const clearDraftAfterSend = async () => {
    if (!user?.id || !loja || !industria.trim()) return;
    await clearPromotorDraft({
      usuarioId: user.id,
      lojaId: loja.id,
      industria,
    }).catch(() => undefined);
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

    setPreview('antes', URL.createObjectURL(fotoAntes));
    setPreview('depois', URL.createObjectURL(fotoDepois));

    setError(null);
    try {
      const senha = await fetchSenhaDoDia();
      setSenhaConfirm(senha?.senha ?? null);
      setSenhaDiaLabel(formatDiaBR(senha?.dia ?? todayDateKeyBRT()));
      void cacheSenhaDoDia({
        senha: senha?.senha ?? null,
        dia: senha?.dia ?? todayDateKeyBRT(),
        label: formatDiaBR(senha?.dia ?? todayDateKeyBRT()),
      });
    } catch {
      const cached = await readCachedSenhaDoDia();
      setSenhaConfirm(cached?.senha ?? null);
      setSenhaDiaLabel(cached?.label ?? formatDiaBR(todayDateKeyBRT()));
    }
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!user?.id || !loja || !fotoAntes || !fotoDepois) return;

    setSending(true);
    setError(null);
    try {
      if (!navigator.onLine) {
        await enqueuePromotorAntesDepois({
          usuarioId: user.id,
          loja,
          industria,
          fotoAntes,
          fotoDepois,
        });
        await clearDraftAfterSend();
        setConfirmOpen(false);
        showToast('Salvo no aparelho. Será enviado ao conectar.', 'success');
        resetFlow();
        return;
      }

      await submitPromotorAntesDepois({
        usuarioId: user.id,
        loja,
        industria,
        fotoAntes,
        fotoDepois,
      });
      await clearDraftAfterSend();
      setConfirmOpen(false);
      showToast('Atividade enviada com sucesso.', 'success');
      resetFlow();
      await reload();
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        try {
          await enqueuePromotorAntesDepois({
            usuarioId: user.id,
            loja,
            industria,
            fotoAntes,
            fotoDepois,
          });
          await clearDraftAfterSend();
          setConfirmOpen(false);
          showToast('Salvo no aparelho. Será enviado ao conectar.', 'success');
          resetFlow();
          return;
        } catch (queueErr) {
          const message =
            queueErr instanceof Error ? queueErr.message : 'Falha ao salvar offline.';
          setError(message);
          showToast(message, 'error');
          setConfirmOpen(false);
          return;
        }
      }
      const message = err instanceof Error ? err.message : 'Falha ao enviar atividade.';
      setError(message);
      showToast(message, 'error');
      setConfirmOpen(false);
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
            fotos de antes e depois. A senha do dia é gravada automaticamente no envio.
          </p>
        </div>
      </header>

      <SenhaDoDiaCard />

      {fromCache && (
        <p className="promotor-roteiro-cache-hint" role="status">
          Sem conexão — lojas e indústrias do último acesso em cache.
        </p>
      )}

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
              <p className="promotor-roteiro-subtitle">
                Loja: {loja.Nome} · {regionalLabel}
              </p>
              <ul className="promotor-industria-list">
                {industrias.map((nome) => (
                  <li key={nome}>
                    <button
                      type="button"
                      className={`promotor-industria-btn ${industria === nome ? 'is-active' : ''}`}
                      onClick={() => {
                        setIndustria(nome);
                        setFotoAntes(null);
                        setFotoDepois(null);
                        setPreview('antes', null);
                        setPreview('depois', null);
                        setDraftHint(false);
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

              {draftHint && (
                <p className="promotor-roteiro-cache-hint" role="status">
                  Foto recuperada do aparelho (rascunho salvo neste PDV / indústria).
                </p>
              )}

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

      {confirmOpen && loja && previewAntes && previewDepois && (
        <ModalShell
          onClose={() => {
            if (!sending) setConfirmOpen(false);
          }}
          className="promotor-confirm-modal"
        >
          <div className="promotor-confirm-header">
            <h2>Confirmar envio?</h2>
            <button
              type="button"
              className="promotor-confirm-close"
              aria-label="Fechar"
              disabled={sending}
              onClick={() => setConfirmOpen(false)}
            >
              ×
            </button>
          </div>

          <p className="promotor-confirm-warn">
            Depois de enviar, a ação é <strong>irreversível</strong>. Confira as fotos e a senha do
            dia antes de confirmar.
            {!navigator.onLine ? (
              <>
                {' '}
                <strong>Sem internet:</strong> o envio ficará na fila do aparelho.
              </>
            ) : null}
          </p>

          <div className="promotor-confirm-meta">
            <p>
              <strong>{industria}</strong>
            </p>
            <p>
              {loja.Nome} · {regionalLabel}
            </p>
          </div>

          <div className="promotor-confirm-senha">
            <span>Senha do dia · {senhaDiaLabel}</span>
            <strong>{senhaConfirm ?? 'Indisponível no momento'}</strong>
          </div>

          <div className="promotor-confirm-fotos">
            <figure>
              <figcaption>Antes</figcaption>
              <img src={previewAntes} alt="Foto de antes" />
            </figure>
            <figure>
              <figcaption>Depois</figcaption>
              <img src={previewDepois} alt="Foto de depois" />
            </figure>
          </div>

          <div className="promotor-confirm-actions">
            <button
              type="button"
              className="promotor-btn outline"
              disabled={sending}
              onClick={() => setConfirmOpen(false)}
            >
              Revisar
            </button>
            <button
              type="button"
              className="promotor-btn primary"
              disabled={sending}
              onClick={() => void handleConfirmSend()}
            >
              {sending
                ? 'Enviando…'
                : !navigator.onLine
                  ? 'Salvar no aparelho'
                  : 'Sim, enviar'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
