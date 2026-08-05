import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute, { PublicOnlyRoute } from './components/auth/ProtectedRoute';
import ManagerLayout from './components/layout/ManagerLayout';
import VendasModuleLayout from './components/layout/VendasModuleLayout';
import Login from './pages/Login';
import PortalHome from './pages/PortalHome';
import Colaboradores from './pages/Colaboradores';
import Treinamentos from './pages/Treinamentos';
import VendasDashboard from './pages/VendasDashboard';
import LancamentoVendas from './pages/LancamentoVendas';
import CadastroClientes from './pages/CadastroClientes';
import BaseDadosClientes from './pages/BaseDadosClientes';
import BaseDadosVendas from './pages/BaseDadosVendas';
import Relatorios from './pages/Relatorios';
import ProjecaoMetas from './pages/ProjecaoMetas';
import Comissao from './pages/Comissao';
import Atividades from './pages/Atividades';
import Financeiro from './pages/Financeiro';
import Administrador from './pages/Administrador';
import AdminClientes from './pages/admin/AdminClientes';
import AdminFiliais from './pages/admin/AdminFiliais';
import AdminIndustrias from './pages/admin/AdminIndustrias';
import AdminMetas from './pages/admin/AdminMetas';
import AdminRegionais from './pages/admin/AdminRegionais';
import AdminSectionPlaceholder from './pages/AdminSectionPlaceholder';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<ManagerLayout />}>
          <Route path="/" element={<PortalHome />} />
          <Route path="/atividades" element={<Atividades />} />
          <Route path="/colaboradores" element={<Colaboradores />} />
          <Route path="/treinamento" element={<Treinamentos />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/administrador" element={<Administrador />} />
          <Route path="/administrador/filiais" element={<AdminFiliais />} />
          <Route path="/administrador/regionais" element={<AdminRegionais />} />
          <Route path="/administrador/industrias" element={<AdminIndustrias />} />
          <Route path="/administrador/clientes" element={<AdminClientes />} />
          <Route path="/administrador/metas" element={<AdminMetas />} />
          <Route path="/administrador/:section" element={<AdminSectionPlaceholder />} />

          <Route element={<VendasModuleLayout />}>
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/projecao-metas" element={<ProjecaoMetas />} />
            <Route path="/comissao" element={<Comissao />} />
            <Route path="/vendas" element={<VendasDashboard />} />
            <Route path="/lancamento" element={<LancamentoVendas />} />
            <Route path="/clientes" element={<CadastroClientes />} />
            <Route path="/base-clientes" element={<BaseDadosClientes />} />
            <Route path="/base-vendas" element={<BaseDadosVendas />} />
          </Route>

          <Route path="/vendas/lancamento" element={<Navigate to="/lancamento" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
