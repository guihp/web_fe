import { useEffect, useMemo, useState } from 'react';
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
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const iframeSrc = useMemo(() => {
    const gestao = interno && canAccessCatalogoGestao(user?.cargo);
    return buildCatalogoIframeSrc({ gestao, industrySlug });
  }, [interno, industrySlug, user?.cargo]);

  return (
    <div className="catalogo-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />
      {offline && !industryMissing && (
        <p className="catalogo-offline-hint" role="status">
          Sem conexão — o catálogo usa produtos já salvos no aparelho (IndexedDB). Cadastro e
          upload de imagens exigem internet.
        </p>
      )}
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
