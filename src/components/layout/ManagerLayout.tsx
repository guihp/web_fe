import { Outlet, useLocation } from 'react-router-dom';
import { AtividadeModalProvider } from '../../context/AtividadeModalProvider';
import RouteErrorBoundary from './RouteErrorBoundary';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

export default function ManagerLayout() {
  const { pathname } = useLocation();
  const isPortal = pathname === '/';

  return (
    <AtividadeModalProvider>
      <div className="app-shell">
        <TopBar />

        <div className="app-body">
          {!isPortal && <Sidebar />}

          <div className={`main-area ${isPortal ? 'main-area-portal' : ''}`}>
            <div className="content-column">
              <RouteErrorBoundary>
                <Outlet />
              </RouteErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </AtividadeModalProvider>
  );
}
