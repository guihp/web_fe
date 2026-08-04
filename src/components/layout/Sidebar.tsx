import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { id: 'home', label: 'Início', icon: '🏠', path: '/' },
  { id: 'atividades', label: 'Atividades', icon: '📋', path: '/atividades' },
  { id: 'colaboradores', label: 'Colaboradores', icon: '👥', path: '/colaboradores' },
  { id: 'treinamento', label: 'Treinamento', icon: '💼', path: '/treinamento' },
  { id: 'financeiro', label: 'Financeiro', icon: '💵', path: '/financeiro' },
  { id: 'administrador', label: 'Administrador', icon: '🛡️', path: '/administrador' },
  { id: 'relatorios', label: 'Relatórios', icon: '📊', path: '/relatorios' },
  { id: 'projecao-metas', label: 'Projeção de metas', icon: '🎯', path: '/projecao-metas' },
  { id: 'comissao', label: 'Comissão', icon: '💵', path: '/comissao' },
  { id: 'vendas', label: 'Vendas', icon: '🛒', path: '/vendas' },
  { id: 'lancamento', label: 'Lançamento de vendas', icon: '💰', path: '/lancamento' },
  { id: 'clientes', label: 'Cadastro de clientes', icon: '🏢', path: '/clientes' },
  { id: 'base-clientes', label: 'Base de clientes', icon: '📋', path: '/base-clientes' },
  { id: 'base-vendas', label: 'Base de dados', icon: '🗃️', path: '/base-vendas' },
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
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

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
        {NAV_ITEMS.map((item) => (
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
