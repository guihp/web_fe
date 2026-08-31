import { usePwaUpdate } from '../../context/PwaUpdateContext';
import './PwaUpdateBanner.css';

export default function PwaUpdateBanner() {
  const { needRefresh, updateApp, dismissUpdate } = usePwaUpdate();

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <p className="pwa-update-banner-text">
        <strong>Nova versão disponível</strong>
        <span>Atualize para obter as últimas melhorias.</span>
      </p>
      <div className="pwa-update-banner-actions">
        <button type="button" className="pwa-update-btn primary" onClick={updateApp}>
          Atualizar agora
        </button>
        <button type="button" className="pwa-update-btn secondary" onClick={dismissUpdate}>
          Depois
        </button>
      </div>
    </div>
  );
}
