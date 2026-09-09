import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ModalShell from '../components/colaboradores/ModalShell';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { canManageUsers } from '../data/portalModules';
import {
  AVISO_TEMPLATES,
  enviarAviso,
  fetchAvisos,
  type Aviso,
} from '../services/avisoService';
import { formatNotificationTime } from '../services/notificationsService';
import './Avisos.css';

type AvisoManualTipo = 'salario' | 'feriado';

const TIPO_LABEL: Record<Aviso['tipo'], string> = {
  salario: 'Salário',
  feriado: 'Feriado',
  folha: 'Folha de ponto',
};

export default function Avisos() {
  const { user } = useAuth();
  const isGerente = canManageUsers(user?.cargo);
  const [tipo, setTipo] = useState<AvisoManualTipo>('salario');
  const [titulo, setTitulo] = useState(AVISO_TEMPLATES.salario.titulo);
  const [corpo, setCorpo] = useState(AVISO_TEMPLATES.salario.corpo);
  const [historico, setHistorico] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadHistorico = useCallback(async () => {
    if (!isGerente) return;
    setLoading(true);
    try {
      setHistorico(await fetchAvisos(40));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  }, [isGerente]);

  useEffect(() => {
    void loadHistorico();
  }, [loadHistorico]);

  if (!isGerente) {
    return <Navigate to="/fe-representacoes" replace />;
  }

  const applyTemplate = (next: AvisoManualTipo) => {
    setTipo(next);
    setTitulo(AVISO_TEMPLATES[next].titulo);
    setCorpo(AVISO_TEMPLATES[next].corpo);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!titulo.trim() || !corpo.trim()) {
      setError('Preencha título e mensagem.');
      return;
    }
    setError(null);
    setSuccess(null);
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      await enviarAviso({
        tipo,
        titulo: titulo.trim(),
        corpo: corpo.trim(),
        criadoPor: user?.id ?? null,
      });
      setConfirmOpen(false);
      setSuccess('Aviso enviado. A equipe interna recebe no sino e no push.');
      await loadHistorico();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o aviso.');
      setConfirmOpen(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="avisos-page">
      <BackToPortal to="/fe-representacoes" label="Fé Representações" />

      <header className="avisos-header">
        <div>
          <h1 className="page-title">Avisos</h1>
          <p className="avisos-subtitle">
            Envie avisos de salário ou feriado para a equipe interna (sino + push). Externos não
            recebem.
          </p>
        </div>
      </header>

      <p className="avisos-note">
        O aviso de <strong>folha de ponto</strong> é enviado automaticamente todo dia 25, não
        precisa disparar manualmente.
      </p>

      <form className="avisos-card" onSubmit={handleSubmit}>
        <div className="avisos-card-head">
          <h2>Novo aviso</h2>
          <p>Escolha o modelo, edite se quiser e envie.</p>
        </div>

        <div className="avisos-tipo-row" role="group" aria-label="Tipo de aviso">
          <button
            type="button"
            className={`avisos-tipo-btn ${tipo === 'salario' ? 'is-active' : ''}`}
            onClick={() => applyTemplate('salario')}
          >
            Salário antecipado
          </button>
          <button
            type="button"
            className={`avisos-tipo-btn ${tipo === 'feriado' ? 'is-active' : ''}`}
            onClick={() => applyTemplate('feriado')}
          >
            Feriado
          </button>
        </div>

        <label className="avisos-field">
          <span>Título</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            required
          />
        </label>

        <label className="avisos-field">
          <span>Mensagem</span>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={8}
            required
          />
        </label>

        {error && <p className="avisos-feedback avisos-feedback--error">{error}</p>}
        {success && <p className="avisos-feedback avisos-feedback--ok">{success}</p>}

        <div className="avisos-actions">
          <button type="submit" className="avisos-send" disabled={sending}>
            {sending ? 'Enviando…' : 'Enviar aviso'}
          </button>
        </div>
      </form>

      <section className="avisos-card">
        <div className="avisos-card-head">
          <h2>Histórico</h2>
          <p>Últimos avisos enviados (manuais e folha automática).</p>
        </div>

        {loading ? (
          <p className="avisos-empty">Carregando…</p>
        ) : historico.length === 0 ? (
          <p className="avisos-empty">Nenhum aviso enviado ainda.</p>
        ) : (
          <ul className="avisos-history">
            {historico.map((item) => (
              <li key={item.id} className="avisos-history-item">
                <div className="avisos-history-meta">
                  <span className={`avisos-badge avisos-badge--${item.tipo}`}>
                    {TIPO_LABEL[item.tipo]}
                  </span>
                  <time dateTime={item.created_at}>
                    {formatNotificationTime(item.created_at)}
                  </time>
                </div>
                <strong>{item.titulo}</strong>
                <p>{item.corpo}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmOpen && (
        <ModalShell
          onClose={() => {
            if (!sending) setConfirmOpen(false);
          }}
          className="avisos-confirm-modal"
        >
          <div className="avisos-confirm-header">
            <h2 id="avisos-confirm-title">Confirmar envio do aviso?</h2>
            <button
              type="button"
              className="avisos-confirm-close"
              aria-label="Fechar"
              disabled={sending}
              onClick={() => setConfirmOpen(false)}
            >
              ×
            </button>
          </div>

          <p className="avisos-confirm-warn">
            Depois de enviar, a ação é <strong>irreversível</strong>. O aviso vai para o sino e o
            push de toda a equipe interna.
          </p>

          <div className="avisos-confirm-preview">
            <span className={`avisos-badge avisos-badge--${tipo}`}>{TIPO_LABEL[tipo]}</span>
            <strong>{titulo.trim()}</strong>
            <p>{corpo.trim()}</p>
          </div>

          <div className="avisos-confirm-actions">
            <button
              type="button"
              className="avisos-confirm-cancel"
              disabled={sending}
              onClick={() => setConfirmOpen(false)}
            >
              Revisar
            </button>
            <button
              type="button"
              className="avisos-confirm-send"
              disabled={sending}
              onClick={() => void handleConfirmSend()}
            >
              {sending ? 'Enviando…' : 'Sim, enviar aviso'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
