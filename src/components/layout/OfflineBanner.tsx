import { useState } from 'react';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import './OfflineBanner.css';

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function OfflineBanner() {
  const { online, syncing, pendingCount, items, flush } = useOfflineStatus();
  const [open, setOpen] = useState(false);
  const [flushing, setFlushing] = useState(false);

  const showBar = !online || pendingCount > 0 || syncing;
  if (!showBar) return null;

  const statusLabel = !online
    ? 'Você está offline'
    : syncing
      ? `Sincronizando ${pendingCount} item(ns)…`
      : pendingCount > 0
        ? `${pendingCount} pendente(s) de envio`
        : 'Online';

  const onFlush = async () => {
    setFlushing(true);
    try {
      await flush();
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="offline-banner-wrap">
      <div
        className={`offline-banner ${online ? 'is-online-pending' : 'is-offline'}`}
        role="status"
        aria-live="polite"
      >
        <p className="offline-banner-text">
          <strong>{statusLabel}</strong>
          {!online && pendingCount === 0 ? (
            <span>Dados salvos no aparelho quando disponíveis.</span>
          ) : pendingCount > 0 ? (
            <span>Toque para ver a fila ou envie quando a rede voltar.</span>
          ) : null}
        </p>
        <div className="offline-banner-actions">
          {pendingCount > 0 && (
            <button
              type="button"
              className="offline-banner-btn ghost"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Ocultar' : 'Ver fila'}
            </button>
          )}
          {pendingCount > 0 && online && (
            <button
              type="button"
              className="offline-banner-btn primary"
              disabled={flushing || syncing}
              onClick={() => void onFlush()}
            >
              {flushing || syncing ? 'Enviando…' : 'Enviar pendentes'}
            </button>
          )}
        </div>
      </div>

      {open && pendingCount > 0 && (
        <ul className="offline-banner-list">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.type === 'promotor_antes_depois' ? 'Roteiro' : 'Vencimento'}</strong>
              <span>{item.label}</span>
              <span className="offline-banner-meta">
                {formatTime(item.createdAt)}
                {item.status === 'error' && item.lastError
                  ? ` · ${item.lastError.slice(0, 80)}`
                  : ` · ${item.status}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
