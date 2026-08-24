import { Outlet } from 'react-router-dom';
import BackToPortal from './BackToPortal';
import './VendasModuleLayout.css';

/** Layout comercial (Fé Representações) — navegação fica na sidebar do balão. */
export default function VendasModuleLayout() {
  return (
    <div className="vendas-module vendas-module--sidebar-nav">
      <div className="vendas-module-top">
        <BackToPortal to="/fe-representacoes" label="Voltar ao hub" />
      </div>
      <div className="vendas-module-content">
        <Outlet />
      </div>
    </div>
  );
}
