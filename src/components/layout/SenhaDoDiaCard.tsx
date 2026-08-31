import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  fetchSenhaDoDia,
  formatDiaBR,
  todayDateKeyBRT,
  type SenhaDoDia,
} from '../../services/senhaDoDiaService';
import './SenhaDoDiaCard.css';

export default function SenhaDoDiaCard() {
  const { showToast } = useToast();
  const [senhaDia, setSenhaDia] = useState<SenhaDoDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const loadSenha = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSenhaDia(await fetchSenhaDoDia());
    } catch (err) {
      setSenhaDia(null);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a senha.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSenha();
  }, [loadSenha]);

  const handleCopy = async () => {
    if (!senhaDia?.senha) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(senhaDia.senha);
      showToast('Senha copiada.', 'success');
    } catch {
      showToast('Não foi possível copiar a senha.', 'error');
    } finally {
      setCopying(false);
    }
  };

  const hojeLabel = formatDiaBR(senhaDia?.dia ?? todayDateKeyBRT());

  return (
    <section className="senha-dia-card" aria-label="Senha do dia">
      <div className="senha-dia-card-main">
        <span className="senha-dia-label">Senha do dia</span>
        <span className="senha-dia-date">{hojeLabel}</span>
        {loading ? (
          <p className="senha-dia-status">Carregando…</p>
        ) : error ? (
          <p className="senha-dia-status senha-dia-status--error">{error}</p>
        ) : senhaDia?.senha ? (
          <p className="senha-dia-value">{senhaDia.senha}</p>
        ) : (
          <p className="senha-dia-status">
            Senha ainda não disponível. Em geral fica pronta a partir das 7h.
          </p>
        )}
      </div>
      <button
        type="button"
        className="senha-dia-copy"
        onClick={() => void handleCopy()}
        disabled={!senhaDia?.senha || copying || loading}
      >
        {copying ? 'Copiando…' : 'Copiar'}
      </button>
    </section>
  );
}
