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
import Atividades from './pages/Atividades';
import LancarVencimentos from './pages/LancarVencimentos';
import LancarEncartes from './pages/LancarEncartes';
import FazerPesquisa from './pages/FazerPesquisa';
import EbookDigital from './pages/EbookDigital';
import CatalogoIndustrias from './pages/CatalogoIndustrias';
import Financeiro from './pages/Financeiro';
import Administrador from './pages/Administrador';
import AdminClientes from './pages/admin/AdminClientes';
import AdminFiliais from './pages/admin/AdminFiliais';
import AdminIndustrias from './pages/admin/AdminIndustrias';
import AdminMetas from './pages/admin/AdminMetas';
import AdminRegionais from './pages/admin/AdminRegionais';
import AdminUsuarios from './pages/admin/AdminUsuarios';
import AdminEmpresa from './pages/admin/AdminEmpresa';
import AdminSucessoCliente from './pages/admin/AdminSucessoCliente';
import AdminSectionPlaceholder from './pages/AdminSectionPlaceholder';
import Validades from './pages/Validades';
import Merchandising from './pages/Merchandising';
import FeRepresentacoes from './pages/FeRepresentacoes';
import Price from './pages/Price';
import Avisos from './pages/Avisos';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<ManagerLayout />}>
          <Route path="/" element={<PortalHome />} />
          <Route path="/merchandising" element={<Merchandising />} />
          <Route path="/merchandising/encartes" element={<LancarEncartes />} />
          <Route path="/merchandising/pesquisas" element={<FazerPesquisa />} />
          <Route path="/merchandising/ebook" element={<EbookDigital />} />
          <Route path="/merchandising/catalogo" element={<CatalogoIndustrias />} />
          <Route path="/fe-representacoes" element={<FeRepresentacoes />} />
          <Route path="/fe-representacoes/price" element={<Price />} />
          <Route path="/fe-representacoes/sucesso-cliente" element={<AdminSucessoCliente />} />
          <Route path="/fe-representacoes/avisos" element={<Avisos />} />

          {/* Legado → Fé Representações */}
          <Route
            path="/merchandising/price"
            element={<Navigate to="/fe-representacoes/price" replace />}
          />
          <Route
            path="/administrador/price"
            element={<Navigate to="/fe-representacoes/price" replace />}
          />
          <Route
            path="/merchandising/sucesso-cliente"
            element={<Navigate to="/fe-representacoes/sucesso-cliente" replace />}
          />
          <Route
            path="/administrador/sucesso-cliente"
            element={<Navigate to="/fe-representacoes/sucesso-cliente" replace />}
          />
          <Route
            path="/administrador/perfis"
            element={<Navigate to="/fe-representacoes/sucesso-cliente" replace />}
          />

          <Route path="/atividades" element={<Atividades />} />
          <Route path="/atividades/lancar-vencimentos" element={<LancarVencimentos />} />
          <Route path="/colaboradores" element={<Colaboradores />} />
          <Route path="/treinamento" element={<Treinamentos />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/validades" element={<Validades />} />
          <Route path="/administrador" element={<Administrador />} />
          <Route path="/administrador/usuarios" element={<AdminUsuarios />} />
          <Route path="/administrador/empresa" element={<AdminEmpresa />} />
          <Route path="/administrador/filiais" element={<AdminFiliais />} />
          <Route path="/administrador/regionais" element={<AdminRegionais />} />
          <Route path="/administrador/industrias" element={<AdminIndustrias />} />
          <Route path="/administrador/clientes" element={<AdminClientes />} />
          <Route path="/administrador/metas" element={<AdminMetas />} />
          <Route path="/administrador/:section" element={<AdminSectionPlaceholder />} />

          <Route element={<VendasModuleLayout />}>
            <Route path="/fe-representacoes/relatorios" element={<Relatorios />} />
            <Route path="/fe-representacoes/projecao-metas" element={<ProjecaoMetas />} />
            <Route path="/fe-representacoes/vendas" element={<VendasDashboard />} />
            <Route path="/fe-representacoes/lancamento" element={<LancamentoVendas />} />
            <Route path="/fe-representacoes/clientes" element={<CadastroClientes />} />
            <Route path="/fe-representacoes/base-clientes" element={<BaseDadosClientes />} />
            <Route path="/fe-representacoes/base-vendas" element={<BaseDadosVendas />} />

            {/* Legado Vendas (paths curtos) */}
            <Route path="/relatorios" element={<Navigate to="/fe-representacoes/relatorios" replace />} />
            <Route
              path="/projecao-metas"
              element={<Navigate to="/fe-representacoes/projecao-metas" replace />}
            />
            <Route path="/vendas" element={<Navigate to="/fe-representacoes/vendas" replace />} />
            <Route
              path="/lancamento"
              element={<Navigate to="/fe-representacoes/lancamento" replace />}
            />
            <Route path="/clientes" element={<Navigate to="/fe-representacoes/clientes" replace />} />
            <Route
              path="/base-clientes"
              element={<Navigate to="/fe-representacoes/base-clientes" replace />}
            />
            <Route
              path="/base-vendas"
              element={<Navigate to="/fe-representacoes/base-vendas" replace />}
            />
          </Route>

          <Route path="/comissao" element={<Navigate to="/financeiro?tab=comissao" replace />} />
          <Route
            path="/vendas/lancamento"
            element={<Navigate to="/fe-representacoes/lancamento" replace />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
