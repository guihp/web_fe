import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  canManageUsers,
  userHasModuleAccess,
  type PortalModuleId,
} from '../../data/portalModules';
import './Sidebar.css';

type NavItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
  module?: PortalModuleId | 'home';
  managersOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Início', icon: '🏠', path: '/', module: 'home' },
  { id: 'atividades', label: 'Atividades', icon: '📋', path: '/atividades', module: 'atividades' },
  {
    id: 'colaboradores',
    label: 'Colaboradores',
    icon: '👥',
    path: '/colaboradores',
    module: 'administrador',
    managersOnly: true,
  },
  { id: 'treinamento', label: 'Treinamento', icon: '💼', path: '/treinamento', module: 'treinamentos' },
  { id: 'financeiro', label: 'Financeiro', icon: '💵', path: '/financeiro', module: 'financeiro' },
  {
    id: 'administrador',
    label: 'Administrador',
    icon: '🛡️',
    path: '/administrador',
    module: 'administrador',
    managersOnly: true,
  },
  { id: 'relatorios', label: 'Relatórios', icon: '📊', path: '/relatorios', module: 'vendas' },
  { id: 'projecao-metas', label: 'Projeção de metas', icon: '🎯', path: '/projecao-metas', module: 'vendas' },
  { id: 'comissao', label: 'Comissão', icon: '💵', path: '/comissao', module: 'vendas' },
  { id: 'vendas', label: 'Vendas', icon: '🛒', path: '/vendas', module: 'vendas' },
  { id: 'lancamento', label: 'Lançamento de vendas', icon: '💰', path: '/lancamento', module: 'vendas' },
  { id: 'clientes', label: 'Cadastro de clientes', icon: '🏢', path: '/clientes', module: 'vendas' },
  { id: 'base-clientes', label: 'Base de clientes', icon: '📋', path: '/base-clientes', module: 'vendas' },
  { id: 'base-vendas', label: 'Base de dados', icon: '🗃️', path: '/base-vendas', module: 'vendas' },
];

const STORAGE_KEY = 'fe_web_sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function Sidebar() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const items = useMemo(() => {
    const cargo = user?.cargo ?? '';
    const modulos = user?.modulos_acesso;
    const isManager = canManageUsers(cargo);

    return NAV_ITEMS.filter((item) => {
      if (item.managersOnly && !isManager) return false;
      if (!item.module || item.module === 'home') return true;
      return userHasModuleAccess(cargo, modulos, item.module);
    });
  }, [user]);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-top">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Mostrar menu' : 'Esconder menu'}
          title={collapsed ? 'Mostrar menu' : 'Esconder menu'}
        >
          <span aria-hidden>{collapsed ? '»' : '«'}</span>
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            title={item.label}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
