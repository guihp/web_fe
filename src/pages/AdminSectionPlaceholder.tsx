import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import AdminClientes from './admin/AdminClientes';
import AdminEmpresa from './admin/AdminEmpresa';
import AdminFiliais from './admin/AdminFiliais';
import AdminIndustrias from './admin/AdminIndustrias';
import AdminMetas from './admin/AdminMetas';
import AdminRegionais from './admin/AdminRegionais';
import AdminSucessoCliente from './admin/AdminSucessoCliente';
import AdminUsuarios from './admin/AdminUsuarios';
import './Administrador.css';

const SECTION_TITLES: Record<string, string> = {
  usuarios: 'Usuários',
  perfis: 'Sucesso do cliente',
  price: 'Price',
  empresa: 'Empresa',
  regionais: 'Regionais',
  filiais: 'Filiais',
  industrias: 'Indústrias',
  clientes: 'Clientes',
  metas: 'Metas',
};

export default function AdminSectionPlaceholder() {
  const { section: paramSection } = useParams<{ section: string }>();
  const location = useLocation();
  const fromMerchandising = location.pathname.startsWith('/merchandising');
  const section =
    paramSection ?? (location.pathname.endsWith('/price') ? 'price' : undefined);

  if (section === 'usuarios') {
    return <AdminUsuarios />;
  }

  if (section === 'empresa') {
    return <AdminEmpresa />;
  }

  if (section === 'perfis' || section === 'sucesso-cliente') {
    return <AdminSucessoCliente />;
  }

  if (section === 'filiais') {
    return <AdminFiliais />;
  }

  if (section === 'regionais') {
    return <AdminRegionais />;
  }

  if (section === 'industrias') {
    return <AdminIndustrias />;
  }

  if (section === 'clientes') {
    return <AdminClientes />;
  }

  if (section === 'metas') {
    return <AdminMetas />;
  }

  const title = section ? SECTION_TITLES[section] : undefined;
  const hubPath = fromMerchandising ? '/merchandising' : '/administrador';
  const hubLabel = fromMerchandising ? 'Voltar ao Merchandising' : 'Voltar ao Administrador';

  if (!title) {
    return <Navigate to={hubPath} replace />;
  }

  return (
    <div className="admin-section-page">
      <Link to={hubPath} className="admin-section-back">
        <span aria-hidden>←</span>
        {hubLabel}
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
