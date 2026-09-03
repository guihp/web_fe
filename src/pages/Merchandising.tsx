import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon, { type AppIconName } from '../components/icons/AppIcon';
import BackToPortal from '../components/layout/BackToPortal';
import SenhaDoDiaCard from '../components/layout/SenhaDoDiaCard';
import { useAuth } from '../context/AuthContext';
import {
  canLancarEncartes,
  canLancarVencimentos,
  userHasSectionAccess,
} from '../data/portalModules';
import {
  fetchPromocoesAtivasParaUsuario,
  formatEncarteDateBr,
  lojaLabelForEncarte,
  type EncarteAviso,
} from '../services/encarteService';
import './Administrador.css';
import './Merchandising.css';

const CATALOGO_INDUSTRIAS_URL = 'https://catalogo-fe.vercel.app/';

const MERCH_CARDS: {
  id: string;
  title: string;
  description: string;
  path?: string;
  externalUrl?: string;
  tone: 'orange' | 'blue' | 'green' | 'sky';
  icon: AppIconName;
  section?: string;
  internoOnly?: boolean;
  encartesOnly?: boolean;
}[] = [
  {
    id: 'treinamentos',
    title: 'Treinamentos',
    description: 'Materiais, vídeos e capacitação da equipe.',
    path: '/treinamento',
    tone: 'orange',
    icon: 'briefcase',
    section: 'treinamentos.home',
  },
  {
    id: 'atividades',
    title: 'Atividades',
    description: 'Controle de visitas e ações de merchandising em PDVs.',
    path: '/atividades',
    tone: 'orange',
    icon: 'clipboard',
    section: 'atividades.home',
  },
  {
    id: 'lancar-vencimentos',
    title: 'Lançar vencimentos',
    description: 'Registrar produtos próximos do vencimento (webhook comercial).',
    path: '/atividades/lancar-vencimentos',
    tone: 'orange',
    icon: 'calendar',
    section: 'atividades.home',
    internoOnly: true,
  },
  {
    id: 'validades',
    title: 'Validades',
    description: 'Controle de validades — liberado para todos os usuários.',
    path: '/validades',
    tone: 'orange',
    icon: 'calendar',
    section: 'validades.home',
  },
  {
    id: 'encartes',
    title: 'Lançar promoções/encarte',
    description: 'Importar modelo Excel e lançar encartes na operação.',
    path: '/merchandising/encartes',
    tone: 'sky',
    icon: 'tag',
    section: 'merchandising.encartes',
    encartesOnly: true,
  },
  {
    id: 'pesquisas',
    title: 'Fazer pesquisa',
    description: 'Lançar pesquisa de preço interna ou externa (Price).',
    path: '/merchandising/pesquisas',
    tone: 'orange',
    icon: 'search',
    section: 'merchandising.pesquisas',
    internoOnly: true,
  },
  {
    id: 'catalogo-industrias',
    title: 'Catálogo das indústrias',
    description:
      'Abre o catálogo em nova aba (site próprio). O painel permanece logado; o catálogo pode pedir login separado.',
    externalUrl: CATALOGO_INDUSTRIAS_URL,
    tone: 'green',
    icon: 'factory',
    internoOnly: true,
  },
];

function formatPreco(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Merchandising() {
  const { user } = useAuth();
  const interno = canLancarVencimentos(user?.tipo_usuario);
  const [promos, setPromos] = useState<EncarteAviso[]>([]);
  const [promosLoading, setPromosLoading] = useState(true);

  const cards = MERCH_CARDS.filter((card) => {
    if (card.internoOnly && !interno) return false;
    if (card.encartesOnly && !canLancarEncartes(user?.cargo)) return false;
    if (!card.section) return true;
    return userHasSectionAccess(user?.cargo ?? '', user?.secoes_acesso, card.section);
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPromosLoading(true);
      try {
        const list = await fetchPromocoesAtivasParaUsuario({
          tipo_usuario: user?.tipo_usuario,
          cargo: user?.cargo,
          industria_nome: user?.industria_nome,
          cliente_grupo: user?.cliente_grupo,
          usuario_id: user?.id,
        });
        if (!cancelled) setPromos(list);
      } catch {
        if (!cancelled) setPromos([]);
      } finally {
        if (!cancelled) setPromosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.tipo_usuario, user?.cargo, user?.industria_nome, user?.cliente_grupo]);

  return (
    <div className="admin-page">
      <BackToPortal />

      <header className="admin-header">
        <h1 className="page-title">Merchandising</h1>
        <p className="admin-subtitle">
          Treinamentos, atividades em loja, pesquisa e controle de validades.
        </p>
      </header>

      <SenhaDoDiaCard />

      <section className="merch-promos" aria-label="Promoções ativas">
        <h2 className="merch-promos-title">Promoções ativas</h2>
        <p className="merch-promos-subtitle">
          Avisos de encarte no período de promoção — somem automaticamente após a data fim.
        </p>
        {promosLoading ? (
          <p className="merch-promos-empty">Carregando promoções...</p>
        ) : promos.length === 0 ? (
          <p className="merch-promos-empty">Nenhuma promoção ativa no momento.</p>
        ) : (
          <ul className="merch-promos-list">
            {promos.map((p) => (
              <li key={p.id} className="merch-promo-card">
                <div className="merch-promo-top">
                  <strong>{p.produto ?? 'Promoção'}</strong>
                  <span className="merch-promo-tipo">{p.tipo}</span>
                </div>
                <p className="merch-promo-meta">
                  {p.marca ?? '—'} · {formatPreco(p.preco)} · {lojaLabelForEncarte(p)}
                </p>
                <p className="merch-promo-dates">
                  {formatEncarteDateBr(p.dataPromocao)} → {formatEncarteDateBr(p.dataFim)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="admin-grid admin-grid--compact">
        {cards.map((card) => {
          const className = `admin-card admin-card--${card.tone}`;
          const body = (
            <>
              <span className="admin-card-icon" aria-hidden>
                <AppIcon name={card.icon} size={22} />
              </span>
              <h2 className="admin-card-title">{card.title}</h2>
              <p className="admin-card-desc">{card.description}</p>
            </>
          );

          if (card.externalUrl) {
            return (
              <a
                key={card.id}
                href={card.externalUrl}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
              >
                {body}
              </a>
            );
          }

          return (
            <Link key={card.id} to={card.path ?? '/merchandising'} className={className}>
              {body}
            </Link>
          );
        })}
      </div>

      {cards.length === 0 && (
        <p className="admin-subtitle">Nenhuma seção liberada neste módulo.</p>
      )}
    </div>
  );
}
