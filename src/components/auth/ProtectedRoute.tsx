import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  canManageUsers,
  moduleIdForPath,
  userHasModuleAccess,
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

  const moduleId = moduleIdForPath(location.pathname);

  if (moduleId === 'administrador' && !canManageUsers(user.cargo)) {
    return <Navigate to="/" replace />;
  }

  if (
    moduleId &&
    moduleId !== 'home' &&
    !userHasModuleAccess(user.cargo, user.modulos_acesso, moduleId)
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
