import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute, { PublicOnlyRoute } from './components/auth/ProtectedRoute';
import ManagerLayout from './components/layout/ManagerLayout';
import Login from './pages/Login';
import ManagerHome from './pages/ManagerHome';
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

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<ManagerLayout />}>
          <Route path="/" element={<ManagerHome />} />
          <Route path="/atividades" element={<Atividades />} />
          <Route path="/colaboradores" element={<Colaboradores />} />
          <Route path="/treinamento" element={<Treinamentos />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/projecao-metas" element={<ProjecaoMetas />} />
          <Route path="/comissao" element={<Comissao />} />
          <Route path="/vendas" element={<VendasDashboard />} />
          <Route path="/lancamento" element={<LancamentoVendas />} />
          <Route path="/clientes" element={<CadastroClientes />} />
          <Route path="/base-clientes" element={<BaseDadosClientes />} />
          <Route path="/base-vendas" element={<BaseDadosVendas />} />
          <Route path="/vendas/lancamento" element={<Navigate to="/lancamento" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
