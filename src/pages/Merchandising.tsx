import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon, { type AppIconName } from '../components/icons/AppIcon';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { canViewSenhaDoDia, userHasSectionAccess } from '../data/portalModules';
import {
  fetchSenhaDoDia,
  formatDiaBR,
  todayDateKeyBRT,
  type SenhaDoDia,
} from '../services/senhaDoDiaService';
import './Administrador.css';
import './MerchandisingSenhaDia.css';

const MERCH_CARDS: {
  id: string;
  title: string;
  description: string;
  path: string;
  tone: 'orange' | 'blue' | 'green' | 'sky';
  icon: AppIconName;
  section: string;
}[] = [
  {
    id: 'treinamentos',
    title: 'Treinamentos',
    description: 'Materiais, vídeos e capacitação da equipe.',
    path: '/treinamento',
    tone: 'orange',
    icon: 'briefcase',
    section: 'treinamentos.home',
  },
  {
    id: 'atividades',
    title: 'Atividades',
    description: 'Controle de visitas e ações de merchandising em PDVs.',
    path: '/atividades',
    tone: 'orange',
    icon: 'clipboard',
    section: 'atividades.home',
  },
  {
    id: 'validades',
    title: 'Validades',
    description: 'Controle de validades — liberado para todos os usuários.',
    path: '/validades',
    tone: 'orange',
    icon: 'calendar',
    section: 'validades.home',
  },
];

export default function Merchandising() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const showSenha = canViewSenhaDoDia(user?.cargo);
  const [senhaDia, setSenhaDia] = useState<SenhaDoDia | null>(null);
  const [senhaLoading, setSenhaLoading] = useState(showSenha);
  const [senhaError, setSenhaError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const cards = MERCH_CARDS.filter((card) =>
    userHasSectionAccess(user?.cargo ?? '', user?.secoes_acesso, card.section),
  );

  const loadSenha = useCallback(async () => {
    if (!showSenha) return;
    setSenhaLoading(true);
    setSenhaError(null);
    try {
      setSenhaDia(await fetchSenhaDoDia());
    } catch (err) {
      setSenhaDia(null);
      setSenhaError(err instanceof Error ? err.message : 'Não foi possível carregar a senha.');
    } finally {
      setSenhaLoading(false);
    }
  }, [showSenha]);

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
    <div className="admin-page">
      <BackToPortal />

      <header className="admin-header">
        <h1 className="page-title">Merchandising</h1>
        <p className="admin-subtitle">Treinamentos, atividades em loja e controle de validades.</p>
      </header>

      {showSenha && (
        <section className="senha-dia-card" aria-label="Senha do dia">
          <div className="senha-dia-card-main">
            <span className="senha-dia-label">Senha do dia</span>
            <span className="senha-dia-date">{hojeLabel}</span>
            {senhaLoading ? (
              <p className="senha-dia-status">Carregando…</p>
            ) : senhaError ? (
              <p className="senha-dia-status senha-dia-status--error">{senhaError}</p>
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
            disabled={!senhaDia?.senha || copying || senhaLoading}
          >
            {copying ? 'Copiando…' : 'Copiar'}
          </button>
        </section>
      )}

      <div className="admin-grid admin-grid--compact">
        {cards.map((card) => (
          <Link key={card.id} to={card.path} className={`admin-card admin-card--${card.tone}`}>
            <span className="admin-card-icon" aria-hidden>
              <AppIcon name={card.icon} size={22} />
            </span>
            <h2 className="admin-card-title">{card.title}</h2>
            <p className="admin-card-desc">{card.description}</p>
          </Link>
        ))}
      </div>

      {cards.length === 0 && (
        <p className="admin-subtitle">Nenhuma seção liberada neste módulo.</p>
      )}
    </div>
  );
}
