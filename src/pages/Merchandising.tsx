import { Link } from 'react-router-dom';
import AppIcon, { type AppIconName } from '../components/icons/AppIcon';
import BackToPortal from '../components/layout/BackToPortal';
import SenhaDoDiaCard from '../components/layout/SenhaDoDiaCard';
import { useAuth } from '../context/AuthContext';
import { canLancarVencimentos, userHasSectionAccess } from '../data/portalModules';
import './Administrador.css';

const MERCH_CARDS: {
  id: string;
  title: string;
  description: string;
  path: string;
  tone: 'orange' | 'blue' | 'green' | 'sky';
  icon: AppIconName;
  section: string;
  internoOnly?: boolean;
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
    id: 'lancar-vencimentos',
    title: 'Lançar vencimentos',
    description: 'Registrar produtos próximos do vencimento (webhook comercial).',
    path: '/atividades/lancar-vencimentos',
    tone: 'orange',
    icon: 'calendar',
    section: 'atividades.home',
    internoOnly: true,
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
  const interno = canLancarVencimentos(user?.tipo_usuario);

  const cards = MERCH_CARDS.filter((card) => {
    if (card.internoOnly && !interno) return false;
    return userHasSectionAccess(user?.cargo ?? '', user?.secoes_acesso, card.section);
  });

  return (
    <div className="admin-page">
      <BackToPortal />

      <header className="admin-header">
        <h1 className="page-title">Merchandising</h1>
        <p className="admin-subtitle">Treinamentos, atividades em loja e controle de validades.</p>
      </header>

      <SenhaDoDiaCard />

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
