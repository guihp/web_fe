import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userHasSectionAccess } from '../../data/portalModules';
import BackToPortal from './BackToPortal';
import './VendasModuleLayout.css';

const VENDAS_TABS = [
  { label: 'Relatórios', icon: '📊', path: '/relatorios', section: 'vendas.relatorios' },
  {
    label: 'Projeção de metas',
    icon: '🎯',
    path: '/projecao-metas',
    section: 'vendas.projecao-metas',
  },
  { label: 'Comissão', icon: '💵', path: '/comissao', section: 'vendas.comissao' },
  { label: 'Vendas', icon: '🛒', path: '/vendas', section: 'vendas.dashboard' },
  {
    label: 'Lançamento de vendas',
    icon: '💰',
    path: '/lancamento',
    section: 'vendas.lancamento',
  },
  { label: 'Cadastro de clientes', icon: '🏢', path: '/clientes', section: 'vendas.clientes' },
  {
    label: 'Base de clientes',
    icon: '📋',
    path: '/base-clientes',
    section: 'vendas.base-clientes',
  },
  { label: 'Base de dados', icon: '🗃️', path: '/base-vendas', section: 'vendas.base-vendas' },
] as const;

const TABS_STORAGE_KEY = 'fe_web_vendas_tabs_hidden';
const MOBILE_MQ = '(max-width: 960px)';

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_MQ).matches;
}

function readTabsHidden(): boolean {
  try {
    const stored = localStorage.getItem(TABS_STORAGE_KEY);
    if (stored === null) return isMobileViewport();
    return stored === '1';
  } catch {
    return isMobileViewport();
  }
}

export default function VendasModuleLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [tabsHidden, setTabsHidden] = useState(readTabsHidden);
  const [isMobile, setIsMobile] = useState(isMobileViewport);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TABS_STORAGE_KEY, tabsHidden ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [tabsHidden]);

  // No celular, após escolher uma função a aba fecha sozinha
  useEffect(() => {
    if (isMobile) setTabsHidden(true);
  }, [location.pathname, isMobile]);

  const tabs = VENDAS_TABS.filter((tab) =>
    userHasSectionAccess(user?.cargo ?? '', user?.secoes_acesso, tab.section),
  );

  const showDrawer = !tabsHidden;

  return (
    <div
      className={`vendas-module ${tabsHidden ? 'vendas-module--tabs-hidden' : ''} ${
        isMobile && showDrawer ? 'vendas-module--drawer-open' : ''
      }`}
    >
      <div className="vendas-module-top">
        <BackToPortal />
        {!tabsHidden && !isMobile && (
          <button
            type="button"
            className="vendas-tabs-toggle"
            onClick={() => setTabsHidden(true)}
            title="Esconder menu de abas"
            aria-label="Esconder menu de abas do módulo Vendas"
          >
            <span aria-hidden>«</span>
            Esconder abas
          </button>
        )}
      </div>

      <div className="vendas-module-body">
        {showDrawer && isMobile && (
          <button
            type="button"
            className="vendas-tabs-backdrop"
            aria-label="Fechar menu de abas"
            onClick={() => setTabsHidden(true)}
          />
        )}

        {showDrawer && (
          <nav className="vendas-module-tabs" aria-label="Abas do módulo Vendas">
            {isMobile && (
              <div className="vendas-module-tabs-head">
                <strong>Funções</strong>
                <button
                  type="button"
                  className="vendas-tabs-toggle"
                  onClick={() => setTabsHidden(true)}
                  aria-label="Esconder menu de abas"
                >
                  <span aria-hidden>«</span>
                  Ocultar
                </button>
              </div>
            )}
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === '/vendas'}
                className={({ isActive }) =>
                  `vendas-module-tab ${isActive ? 'active' : ''}`
                }
                onClick={() => {
                  if (isMobile) setTabsHidden(true);
                }}
              >
                <span className="vendas-module-tab-icon" aria-hidden>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        )}

        <div className="vendas-module-content">
          <Outlet />
        </div>
      </div>

      {tabsHidden && (
        <button
          type="button"
          className="vendas-tabs-fab"
          onClick={() => setTabsHidden(false)}
          title="Mostrar menu de abas"
          aria-label="Mostrar menu de abas do módulo Vendas"
        >
          <span aria-hidden>☰</span>
          <span className="vendas-tabs-fab-label">Abas</span>
        </button>
      )}
    </div>
  );
}
