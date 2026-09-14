import { Navigate } from 'react-router-dom';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { canLancarVencimentos } from '../data/portalModules';
import './CatalogoIndustrias.css';

export default function CatalogoIndustrias() {
  const { user } = useAuth();
  const interno = canLancarVencimentos(user?.tipo_usuario);

  if (!interno) {
    return <Navigate to="/merchandising" replace />;
  }

  return (
    <div className="catalogo-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />
      <iframe
        className="catalogo-frame"
        title="Catálogo das indústrias"
        src="/catalogo/index.html"
        allow="clipboard-write"
      />
    </div>
  );
}
