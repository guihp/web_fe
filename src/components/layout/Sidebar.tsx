import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  PORTAL_MODULES,
  canManageUsers,
  moduleIdFromSection,
  sectionIdForPath,
  userHasSectionAccess,
  type PortalModuleId,
} from '../../data/portalModules';
import './Sidebar.css';

type NavItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
  section: string | 'home';
};

const HOME_ITEM: NavItem = {
  id: 'home',
  label: 'Início',
  icon: '🏠',
  path: '/',
  section: 'home',
};

function currentModuleId(pathname: string): PortalModuleId | null {
  const section = sectionIdForPath(pathname);
  if (!section || section === 'home') return null;
  return moduleIdFromSection(section);
}

function pathMatches(itemPath: string, pathname: string, search: string) {
  const [path, query = ''] = itemPath.split('?');

  if (path === '/') return pathname === '/';

  if (query) {
    if (pathname !== path) return false;
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(search);
    for (const [key, value] of want.entries()) {
      if (have.get(key) !== value) return false;
    }
    return true;
  }

  // Visão geral do Financeiro (sem ?tab=)
  if (path === '/financeiro') {
    return pathname === '/financeiro' && !new URLSearchParams(search).get('tab');
  }

  // Hubs: só path exato
  if (path === '/administrador' || path === '/merchandising') {
    return pathname === path;
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('fe_web_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)').matches : false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
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
      localStorage.setItem('fe_web_sidebar_collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [location.pathname, location.search, isMobile]);

  const items = useMemo(() => {
    const cargo = user?.cargo ?? '';
    const secoes = user?.secoes_acesso;
    const moduleId = currentModuleId(location.pathname);
    const nav: NavItem[] = [HOME_ITEM];

    if (!moduleId) return nav;

    const mod = PORTAL_MODULES.find((m) => m.id === moduleId);
    if (!mod) return nav;

    for (const section of mod.sections) {
      // Hub: usa o título do módulo
      const label = section.id.endsWith('.hub')
        ? mod.title
        : section.id === 'financeiro.home'
          ? 'Visão geral'
          : section.title;

      if (section.id.startsWith('administrador.') && !canManageUsers(cargo)) {
        continue;
      }

      if (
        !userHasSectionAccess(cargo, secoes, section.id) &&
        !(
          section.id === 'administrador.hub' &&
          (secoes ?? []).some((s) => s.startsWith('administrador.'))
        )
      ) {
        continue;
      }

      nav.push({
        id: section.id,
        label,
        icon: section.icon ?? '•',
        path: section.path,
        section: section.id,
      });
    }

    return nav;
  }, [user, location.pathname]);

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
            {items.map((item) => {
              const active = pathMatches(item.path, location.pathname, location.search);
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === '/' || !item.path.includes('/')}
                  title={item.label}
                  className={() => `sidebar-item ${active ? 'active' : ''}`}
                  onClick={() => {
                    if (isMobile) setMobileOpen(false);
                  }}
                >
                  <span className="sidebar-icon" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="sidebar-label">{item.label}</span>
                </NavLink>
              );
            })}
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
