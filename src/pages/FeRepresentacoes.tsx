import { Link } from 'react-router-dom';
import AppIcon, { type AppIconName } from '../components/icons/AppIcon';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { userHasSectionAccess } from '../data/portalModules';
import './Administrador.css';

const FE_CARDS: {
  id: string;
  title: string;
  description: string;
  path: string;
  tone: 'orange' | 'blue' | 'green' | 'sky';
  icon: AppIconName;
  section: string;
}[] = [
  {
    id: 'price',
    title: 'Price',
    description: 'Pesquisas de preço internas e externas, markup e margem.',
    path: '/fe-representacoes/price',
    tone: 'orange',
    icon: 'tag',
    section: 'fe-representacoes.price',
  },
  {
    id: 'sucesso',
    title: 'Sucesso do cliente',
    description: 'Kanban de pedidos e acompanhamento do cliente.',
    path: '/fe-representacoes/sucesso-cliente',
    tone: 'orange',
    icon: 'check',
    section: 'fe-representacoes.sucesso',
  },
  {
    id: 'avisos',
    title: 'Avisos',
    description: 'Enviar avisos de salário ou feriado para a equipe interna.',
    path: '/fe-representacoes/avisos',
    tone: 'orange',
    icon: 'bell',
    section: 'fe-representacoes.avisos',
  },
  {
    id: 'veiculos',
    title: 'Gestão de Veículos',
    description: 'Meus veículos, retirada/entrega, frota e aprovação de prestações.',
    path: '/fe-representacoes/veiculos',
    tone: 'green',
    icon: 'cart',
    section: 'fe-representacoes.veiculos',
  },
  {
    id: 'vendas',
    title: 'Vendas',
    description: 'Dashboard de realizado x meta por região e indústria.',
    path: '/fe-representacoes/vendas',
    tone: 'sky',
    icon: 'cart',
    section: 'vendas.dashboard',
  },
  {
    id: 'lancamento',
    title: 'Lançamento de vendas',
    description: 'Incluir, editar e cancelar pedidos de venda.',
    path: '/fe-representacoes/lancamento',
    tone: 'sky',
    icon: 'money',
    section: 'vendas.lancamento',
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    description: 'Relatórios comerciais e acompanhamento.',
    path: '/fe-representacoes/relatorios',
    tone: 'blue',
    icon: 'chart',
    section: 'vendas.relatorios',
  },
  {
    id: 'metas',
    title: 'Projeção de metas',
    description: 'Metas versus realizado por período.',
    path: '/fe-representacoes/projecao-metas',
    tone: 'blue',
    icon: 'target',
    section: 'vendas.projecao-metas',
  },
  {
    id: 'clientes',
    title: 'Cadastro de clientes',
    description: 'Cadastro operacional de clientes.',
    path: '/fe-representacoes/clientes',
    tone: 'green',
    icon: 'building',
    section: 'vendas.clientes',
  },
  {
    id: 'base-clientes',
    title: 'Base de clientes',
    description: 'Base tabular de clientes.',
    path: '/fe-representacoes/base-clientes',
    tone: 'green',
    icon: 'clipboard',
    section: 'vendas.base-clientes',
  },
  {
    id: 'base-vendas',
    title: 'Base de dados',
    description: 'Base tabular de vendas.',
    path: '/fe-representacoes/base-vendas',
    tone: 'green',
    icon: 'archive',
    section: 'vendas.base-vendas',
  },
];

export default function FeRepresentacoes() {
  const { user } = useAuth();
  const cards = FE_CARDS.filter((card) =>
    userHasSectionAccess(user?.cargo ?? '', user?.secoes_acesso, card.section),
  );

  return (
    <div className="admin-page">
      <BackToPortal />

      <header className="admin-header">
        <h1 className="page-title">Fé Representações</h1>
        <p className="admin-subtitle">
          Price, Sucesso do cliente, gestão comercial e veículos da empresa.
        </p>
      </header>

      <div className="admin-grid admin-grid--compact">
        {cards.map((card) => (
          <Link key={card.id} to={card.path} className={`admin-card admin-card--${card.tone}`}>
            <span className="admin-card-icon" aria-hidden>
              <AppIcon name={card.icon} size={22} />
            </span>
            <h2 className="admin-card-title">{card.title}</h2>
            <p className="admin-card-desc">{card.description}</p>
          </Link>
        ))}
      </div>

      {cards.length === 0 && (
        <p className="admin-subtitle">Nenhuma seção liberada neste módulo.</p>
      )}
    </div>
  );
}
