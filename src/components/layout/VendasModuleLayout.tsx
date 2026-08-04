import { NavLink, Outlet } from 'react-router-dom';
import BackToPortal from './BackToPortal';
import './VendasModuleLayout.css';

const VENDAS_TABS = [
  { label: 'Relatórios', icon: '📊', path: '/relatorios' },
  { label: 'Projeção de metas', icon: '🎯', path: '/projecao-metas' },
  { label: 'Comissão', icon: '💵', path: '/comissao' },
  { label: 'Vendas', icon: '🛒', path: '/vendas' },
  { label: 'Lançamento de vendas', icon: '💰', path: '/lancamento' },
  { label: 'Cadastro de clientes', icon: '🏢', path: '/clientes' },
  { label: 'Base de clientes', icon: '📋', path: '/base-clientes' },
  { label: 'Base de dados', icon: '🗃️', path: '/base-vendas' },
] as const;

export default function VendasModuleLayout() {
  return (
    <div className="vendas-module">
      <BackToPortal />

      <div className="vendas-module-body">
        <nav className="vendas-module-tabs" aria-label="Abas do módulo Vendas">
          {VENDAS_TABS.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/vendas'}
              className={({ isActive }) =>
                `vendas-module-tab ${isActive ? 'active' : ''}`
              }
            >
              <span className="vendas-module-tab-icon" aria-hidden>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="vendas-module-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
