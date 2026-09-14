import { useMemo } from 'react';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { canAccessCatalogoGestao } from '../data/portalModules';
import {
  buildCatalogoIframeSrc,
  resolveCatalogoIndustrySlug,
} from '../utils/catalogoAccess';
import './CatalogoIndustrias.css';

export default function CatalogoIndustrias() {
  const { user } = useAuth();
  const tipo = user?.tipo_usuario ?? 'interno';
  const interno = tipo === 'interno';
  const industrySlug =
    tipo === 'industria' ? resolveCatalogoIndustrySlug(user?.industria_nome) : null;
  const industryMissing = tipo === 'industria' && !industrySlug;

  const iframeSrc = useMemo(() => {
    const gestao = interno && canAccessCatalogoGestao(user?.cargo);
    return buildCatalogoIframeSrc({ gestao, industrySlug });
  }, [interno, industrySlug, user?.cargo]);

  return (
    <div className="catalogo-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />
      {industryMissing ? (
        <p className="catalogo-scope-note" role="status">
          Não foi possível identificar a indústria vinculada à sua conta. Fale com o
          administrador para liberar o catálogo correspondente.
        </p>
      ) : (
        <iframe
          className="catalogo-frame"
          title="Catálogo das indústrias"
          src={iframeSrc}
          allow="clipboard-write"
        />
      )}
    </div>
  );
}
