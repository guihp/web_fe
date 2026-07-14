import { Outlet, useLocation } from 'react-router-dom';
import { AtividadeModalProvider } from '../../context/AtividadeModalProvider';
import RouteErrorBoundary from './RouteErrorBoundary';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import CalendarPanel from './CalendarPanel';

export default function ManagerLayout() {
  const { pathname } = useLocation();
  const showCalendar = pathname === '/';

  return (
    <AtividadeModalProvider>
      <div className="app-shell">
        <TopBar />

        <div className="app-body">
          <Sidebar />

          <div className="main-area">
            <div className="content-column">
              <RouteErrorBoundary>
                <Outlet />
              </RouteErrorBoundary>
            </div>
            {showCalendar && <CalendarPanel />}
          </div>
        </div>
      </div>
    </AtividadeModalProvider>
  );
}
