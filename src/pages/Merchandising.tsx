import { Link } from 'react-router-dom';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { userHasSectionAccess } from '../data/portalModules';
import './Administrador.css';

const MERCH_CARDS = [
  {
    id: 'treinamentos',
    title: 'Treinamentos',
    description: 'Materiais, vídeos e capacitação da equipe.',
    path: '/treinamento',
    tone: 'orange',
    icon: '💼',
    section: 'treinamentos.home',
  },
  {
    id: 'atividades',
    title: 'Atividades',
    description: 'Controle de visitas e ações de merchandising em PDVs.',
    path: '/atividades',
    tone: 'blue',
    icon: '📋',
    section: 'atividades.home',
  },
  {
    id: 'validades',
    title: 'Validades',
    description: 'Controle de validades — liberado para todos os usuários.',
    path: '/validades',
    tone: 'green',
    icon: '📅',
    section: 'validades.home',
  },
  {
    id: 'price',
    title: 'Price',
    description: 'Módulo Price — conteúdo a definir.',
    path: '/administrador/price',
    tone: 'sky',
    icon: '🏷️',
    section: 'merchandising.price',
  },
] as const;

export default function Merchandising() {
  const { user } = useAuth();
  const cards = MERCH_CARDS.filter((card) =>
    userHasSectionAccess(user?.cargo ?? '', user?.secoes_acesso, card.section),
  );

  return (
    <div className="admin-page">
      <BackToPortal />

      <header className="admin-header">
        <h1 className="page-title">Merchandising</h1>
        <p className="admin-subtitle">
          Treinamentos, atividades em loja, validades e Price.
        </p>
      </header>

      <div className="admin-grid admin-grid--compact">
        {cards.map((card) => (
          <Link key={card.id} to={card.path} className={`admin-card admin-card--${card.tone}`}>
            <span className="admin-card-icon" aria-hidden>
              {card.icon}
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
