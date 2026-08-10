import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  canManageUsers,
  userHasSectionAccess,
} from '../../data/portalModules';
import './Sidebar.css';

type NavItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
  section?: string | 'home';
  managersOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Início', icon: '🏠', path: '/', section: 'home' },
  {
    id: 'atividades',
    label: 'Atividades',
    icon: '📋',
    path: '/atividades',
    section: 'atividades.home',
  },
  {
    id: 'colaboradores',
    label: 'Colaboradores',
    icon: '👥',
    path: '/colaboradores',
    section: 'administrador.colaboradores',
    managersOnly: true,
  },
  {
    id: 'treinamento',
    label: 'Treinamento',
    icon: '💼',
    path: '/treinamento',
    section: 'treinamentos.home',
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: '💵',
    path: '/financeiro',
    section: 'financeiro.home',
  },
  {
    id: 'validades',
    label: 'Validades',
    icon: '📅',
    path: '/validades',
    section: 'validades.home',
  },
  {
    id: 'administrador',
    label: 'Administrador',
    icon: '🛡️',
    path: '/administrador',
    section: 'administrador.hub',
    managersOnly: true,
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: '📊',
    path: '/relatorios',
    section: 'vendas.relatorios',
  },
  {
    id: 'projecao-metas',
    label: 'Projeção de metas',
    icon: '🎯',
    path: '/projecao-metas',
    section: 'vendas.projecao-metas',
  },
  {
    id: 'comissao',
    label: 'Comissão',
    icon: '💵',
    path: '/comissao',
    section: 'vendas.comissao',
  },
  { id: 'vendas', label: 'Vendas', icon: '🛒', path: '/vendas', section: 'vendas.dashboard' },
  {
    id: 'lancamento',
    label: 'Lançamento de vendas',
    icon: '💰',
    path: '/lancamento',
    section: 'vendas.lancamento',
  },
  {
    id: 'clientes',
    label: 'Cadastro de clientes',
    icon: '🏢',
    path: '/clientes',
    section: 'vendas.clientes',
  },
  {
    id: 'base-clientes',
    label: 'Base de clientes',
    icon: '📋',
    path: '/base-clientes',
    section: 'vendas.base-clientes',
  },
  {
    id: 'base-vendas',
    label: 'Base de dados',
    icon: '🗃️',
    path: '/base-vendas',
    section: 'vendas.base-vendas',
  },
];

const STORAGE_KEY = 'fe_web_sidebar_collapsed';
const MOBILE_MQ = '(max-width: 900px)';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_MQ).matches;
}

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setMobileOpen(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [location.pathname, isMobile]);

  const items = useMemo(() => {
    const cargo = user?.cargo ?? '';
    const secoes = user?.secoes_acesso;
    const isManager = canManageUsers(cargo);

    return NAV_ITEMS.filter((item) => {
      if (item.managersOnly && !isManager) return false;
      if (!item.section || item.section === 'home') return true;
      if (item.section === 'administrador.hub') {
        return (
          userHasSectionAccess(cargo, secoes, 'administrador.hub') ||
          (secoes ?? []).some((s) => s.startsWith('administrador.'))
        );
      }
      return userHasSectionAccess(cargo, secoes, item.section);
    });
  }, [user]);

  return (
    <>
      {isMobile && mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={`sidebar-slot ${isMobile ? 'sidebar-slot--mobile' : ''}`}>
        <aside
          className={`sidebar ${collapsed && !isMobile ? 'sidebar--collapsed' : ''} ${
            isMobile && mobileOpen ? 'sidebar--mobile-open' : ''
          } ${isMobile ? 'sidebar--mobile' : ''}`}
        >
          <div className="sidebar-top">
            {isMobile ? (
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setMobileOpen(false)}
                aria-label="Ocultar menu"
                title="Ocultar menu"
              >
                <span aria-hidden>«</span>
                <span className="sidebar-toggle-label">Ocultar</span>
              </button>
            ) : (
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={collapsed ? 'Mostrar menu' : 'Esconder menu'}
                title={collapsed ? 'Mostrar menu' : 'Esconder menu'}
              >
                <span aria-hidden>{collapsed ? '»' : '«'}</span>
              </button>
            )}
          </div>

          <nav className="sidebar-nav">
            {items.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                title={item.label}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (isMobile) setMobileOpen(false);
                }}
              >
                <span className="sidebar-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
      </div>

      {isMobile && !mobileOpen && (
        <button
          type="button"
          className="sidebar-fab"
          onClick={() => setMobileOpen(true)}
          title="Mostrar menu"
          aria-label="Mostrar menu lateral"
        >
          <span aria-hidden>☰</span>
        </button>
      )}
    </>
  );
}
