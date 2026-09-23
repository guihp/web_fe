import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  canManageUsers,
  sectionIdForPath,
  userHasSectionAccess,
} from '../../data/portalModules';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        Carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const sectionId = sectionIdForPath(location.pathname);
  const hubOpts = {
    isSuperAdmin: user.is_super_admin,
    hubSistemas: user.hub_sistemas,
  };

  if (
    typeof sectionId === 'string' &&
    sectionId.startsWith('administrador.') &&
    !canManageUsers(user.cargo)
  ) {
    return <Navigate to="/" replace />;
  }

  if (sectionId === 'grupo-fe.hub' || sectionId?.startsWith('grupo-fe.')) {
    if (!userHasSectionAccess(user.cargo, user.secoes_acesso, sectionId, hubOpts)) {
      return <Navigate to="/" replace />;
    }
  } else if (sectionId === 'administrador.hub') {
    const hasAnyAdmin = (user.secoes_acesso ?? []).some((s) => s.startsWith('administrador.'));
    if (!hasAnyAdmin && !userHasSectionAccess(user.cargo, user.secoes_acesso, sectionId)) {
      return <Navigate to="/" replace />;
    }
  } else if (sectionId === 'merchandising.hub') {
    if (!userHasSectionAccess(user.cargo, user.secoes_acesso, sectionId)) {
      return <Navigate to="/" replace />;
    }
  } else if (
    sectionId &&
    sectionId !== 'home' &&
    !userHasSectionAccess(user.cargo, user.secoes_acesso, sectionId, hubOpts)
  ) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        Carregando...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
