import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: '🏠', path: '/' },
  { id: 'atividades', label: 'Atividades', icon: '📋', path: '/atividades' },
  { id: 'colaboradores', label: 'Colaboradores', icon: '👥', path: '/colaboradores' },
  { id: 'treinamento', label: 'Treinamento', icon: '💼', path: '/treinamento' },
  { id: 'relatorios', label: 'Relatórios', icon: '📊', path: '/relatorios' },
  { id: 'projecao-metas', label: 'Projeção de metas', icon: '🎯', path: '/projecao-metas' },
  { id: 'comissao', label: 'Comissão', icon: '💵', path: '/comissao' },
  { id: 'vendas', label: 'Vendas', icon: '🛒', path: '/vendas' },
  { id: 'lancamento', label: 'Lançamento de vendas', icon: '💰', path: '/lancamento' },
  { id: 'clientes', label: 'Cadastro de clientes', icon: '🏢', path: '/clientes' },
  { id: 'base-clientes', label: 'Base de clientes', icon: '📋', path: '/base-clientes' },
  { id: 'base-vendas', label: 'Base de dados', icon: '🗃️', path: '/base-vendas' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon" aria-hidden>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
