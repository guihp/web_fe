import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import BackToPortal from '../components/layout/BackToPortal';
import './Administrador.css';

type AdminModule = {
  id: string;
  title: string;
  description: string;
  path: string;
  tone: string;
  icon: ReactNode;
};

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9.5 4.5-1 8-4.5 8-9.5V6l-8-3Z" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 21h16" />
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconStore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10.5 5 4h14l2 6.5" />
      <path d="M4 10.5V20h16v-9.5" />
      <path d="M9 20v-5h6v5" />
      <path d="M3 10.5h18" />
    </svg>
  );
}

function IconFactory() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 21h18" />
      <path d="M5 21V10l6 4V10l6 4V5h2v16" />
      <path d="M9 21v-3M13 21v-3M17 21v-3" />
    </svg>
  );
}

function IconIdCard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="9" cy="12" r="2.5" />
      <path d="M14 10h5M14 14h5" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

const ADMIN_MODULES: AdminModule[] = [
  {
    id: 'usuarios',
    title: 'Usuários',
    description: 'Gerencie os usuários do sistema',
    path: '/administrador/usuarios',
    tone: 'blue',
    icon: <IconUser />,
  },
  {
    id: 'perfis',
    title: 'Perfis',
    description: 'Configure perfis e permissões de acesso',
    path: '/administrador/perfis',
    tone: 'violet',
    icon: <IconShield />,
  },
  {
    id: 'vendedores',
    title: 'Vendedores',
    description: 'Cadastro comercial dos usuários com perfil Vendedor (regional e comissão)',
    path: '/administrador/vendedores',
    tone: 'sky',
    icon: <IconBriefcase />,
  },
  {
    id: 'empresa',
    title: 'Empresa',
    description: 'Configurações da empresa matriz',
    path: '/administrador/empresa',
    tone: 'green',
    icon: <IconBuilding />,
  },
  {
    id: 'regionais',
    title: 'Regionais',
    description: 'Cadastre e gerencie as regionais',
    path: '/administrador/regionais',
    tone: 'orange',
    icon: <IconPin />,
  },
  {
    id: 'filiais',
    title: 'Filiais',
    description: 'Cadastre filiais vinculadas às regionais',
    path: '/administrador/filiais',
    tone: 'rose',
    icon: <IconStore />,
  },
  {
    id: 'industrias',
    title: 'Indústrias',
    description: 'Cadastre as indústrias parceiras',
    path: '/administrador/industrias',
    tone: 'indigo',
    icon: <IconFactory />,
  },
  {
    id: 'clientes',
    title: 'Clientes',
    description: 'Cadastre e gerencie os clientes para pedidos',
    path: '/administrador/clientes',
    tone: 'teal',
    icon: <IconIdCard />,
  },
  {
    id: 'metas',
    title: 'Metas',
    description: 'Cadastre metas por regional, indústria ou vendedor',
    path: '/administrador/metas',
    tone: 'lime',
    icon: <IconTarget />,
  },
];

export default function Administrador() {
  return (
    <div className="admin-page">
      <BackToPortal />

      <header className="admin-header">
        <h1 className="page-title">Módulo Administrador</h1>
        <p className="admin-subtitle">
          Central de gestão de usuários, empresas, regionais, filiais e indústrias.
        </p>
      </header>

      <div className="admin-grid">
        {ADMIN_MODULES.map((mod) => (
          <Link key={mod.id} to={mod.path} className={`admin-card admin-card--${mod.tone}`}>
            <span className="admin-card-icon" aria-hidden>
              {mod.icon}
            </span>
            <h2 className="admin-card-title">{mod.title}</h2>
            <p className="admin-card-desc">{mod.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
