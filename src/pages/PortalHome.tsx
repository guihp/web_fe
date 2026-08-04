import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './PortalHome.css';

const MODULES = [
  {
    id: 'treinamentos',
    title: 'Treinamentos',
    description: 'Materiais, vídeos e capacitação da equipe.',
    badge: 'Disponíveis: 12',
    icon: '💼',
    path: '/treinamento',
  },
  {
    id: 'atividades',
    title: 'Atividade',
    description: 'Controle de visitas e ações de merchandising em PDVs.',
    badge: 'Pendentes: 23',
    icon: '📋',
    path: '/atividades',
  },
  {
    id: 'vendas',
    title: 'Vendas',
    description: 'Gestão completa de vendas, clientes e metas comerciais.',
    badge: 'Vendas no mês: 127',
    icon: '🛒',
    path: '/vendas',
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Gestão de comissões e relatórios financeiros.',
    badge: 'Comissão: R$ 12.450',
    icon: '💵',
    path: '/financeiro',
  },
  {
    id: 'administrador',
    title: 'Administrador',
    description: 'Gestão de usuários, empresas, regionais e indústrias.',
    badge: 'Usuários: 32',
    icon: '🛡️',
    path: '/administrador',
  },
] as const;

export default function PortalHome() {
  const { user } = useAuth();
  const firstName = user?.nome?.split(' ')[0] ?? 'Usuário';

  return (
    <div className="portal-home">
      <header className="portal-hero">
        <h1 className="portal-greeting">Bem-vindo, {firstName}!</h1>
        <p className="portal-subtitle">
          Selecione o módulo que deseja acessar para começar suas atividades.
        </p>
      </header>

      <div className="portal-grid">
        {MODULES.map((mod) => (
          <article key={mod.id} className="portal-card">
            <div className="portal-card-top">
              <span className="portal-status">
                <span className="portal-status-dot" aria-hidden />
                Ativo
              </span>
              <span className="portal-badge">{mod.badge}</span>
            </div>

            <div className="portal-card-icon" aria-hidden>
              {mod.icon}
            </div>

            <h2 className="portal-card-title">{mod.title}</h2>
            <p className="portal-card-desc">{mod.description}</p>

            <Link to={mod.path} className="portal-card-cta">
              Acessar
              <span aria-hidden>→</span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
