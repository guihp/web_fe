import { Link } from 'react-router-dom';
import AppIcon, { type AppIconName } from '../components/icons/AppIcon';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { userHasSectionAccess } from '../data/portalModules';
import './Administrador.css';

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
  {
    id: 'price',
    title: 'Price',
    description: 'Módulo Price — conteúdo a definir.',
    path: '/merchandising/price',
    tone: 'orange',
    icon: 'tag',
    section: 'merchandising.price',
  },
  {
    id: 'sucesso',
    title: 'Sucesso do cliente',
    description: 'Kanban de pedidos e acompanhamento do cliente.',
    path: '/merchandising/sucesso-cliente',
    tone: 'orange',
    icon: 'check',
    section: 'merchandising.sucesso',
  },
];

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
          Treinamentos, atividades em loja, validades, Price e Sucesso do cliente.
        </p>
      </header>

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
