import { Link, Navigate, useParams } from 'react-router-dom';
import './Administrador.css';

const SECTION_TITLES: Record<string, string> = {
  usuarios: 'Usuários',
  perfis: 'Perfis',
  vendedores: 'Vendedores',
  empresa: 'Empresa',
  regionais: 'Regionais',
  filiais: 'Filiais',
  industrias: 'Indústrias',
  clientes: 'Clientes',
  metas: 'Metas',
};

export default function AdminSectionPlaceholder() {
  const { section } = useParams<{ section: string }>();
  const title = section ? SECTION_TITLES[section] : undefined;

  if (!title) {
    return <Navigate to="/administrador" replace />;
  }

  return (
    <div className="admin-section-page">
      <Link to="/administrador" className="admin-section-back">
        <span aria-hidden>←</span>
        Voltar ao Administrador
      </Link>

      <header className="admin-header">
        <h1 className="page-title">{title}</h1>
        <p className="admin-subtitle">Esta seção será implementada em seguida.</p>
      </header>

      <section className="card admin-section-placeholder">
        <h2>Em breve</h2>
        <p>
          O cadastro e a gestão de <strong>{title.toLowerCase()}</strong> serão feitos aqui.
        </p>
      </section>
    </div>
  );
}
