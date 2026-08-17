import { useCallback, useEffect, useMemo, useState } from 'react';
import BackToPortal from '../../components/layout/BackToPortal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MESES_PT } from '../../utils/vendasDomain';
import {
  KANBAN_STATUSES,
  KANBAN_STATUS_DEFAULT,
  currentMesAnoLabel,
  fetchKanbanFilterOptions,
  fetchKanbanPedidos,
  formatKanbanValor,
  setPedidoKanbanStatus,
  type KanbanStatus,
  type PedidoKanbanCard,
} from '../../services/sucessoClienteService';
import '../Administrador.css';
import './AdminSucessoCliente.css';

const STATUS_CLASS: Record<KanbanStatus, string> = {
  'Enviado ou gerado': 'status-enviado',
  Faturado: 'status-faturado',
  'Em trânsito': 'status-transito',
  'Aguardando recebimento': 'status-aguardando',
  'Entregue finalizado': 'status-finalizado',
};

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatData(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function AdminSucessoCliente() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const somenteLeitura = Boolean(user?.somente_leitura);
  const scopeIndustria =
    user?.tipo_usuario === 'industria' ? user.industria_nome ?? undefined : undefined;
  const scopeClienteGrupo =
    user?.tipo_usuario === 'cliente' ? user.cliente_grupo ?? undefined : undefined;
  const scopeLoginCnpj =
    user?.tipo_usuario === 'cliente' ? user.login_cnpj ?? undefined : undefined;

  const current = currentMesAnoLabel();
  const [mes, setMes] = useState<string>(current.mes);
  const [ano, setAno] = useState<string>(current.ano);
  const [industria, setIndustria] = useState('Todas');
  const [vendedor, setVendedor] = useState('Todos');
  const [estado, setEstado] = useState('Todos');
  const [search, setSearch] = useState('');
  const [cards, setCards] = useState<PedidoKanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanStatus | null>(null);
  const [options, setOptions] = useState({
    industrias: [] as string[],
    vendedores: [] as string[],
    estados: [] as string[],
    anos: [] as string[],
  });

  const loadOptions = useCallback(async () => {
    try {
      const data = await fetchKanbanFilterOptions(ano === 'Todos' ? undefined : ano);
      setOptions(data);
    } catch {
      /* ignore */
    }
  }, [ano]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKanbanPedidos({
        mes: mes === 'Todos' ? undefined : mes,
        ano: ano === 'Todos' ? undefined : ano,
        industria: scopeIndustria || industria,
        vendedor,
        estado,
        search,
        scopeIndustria,
        scopeClienteGrupo,
        scopeLoginCnpj,
      });
      setCards(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar pedidos.', 'error');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [
    mes,
    ano,
    industria,
    vendedor,
    estado,
    search,
    showToast,
    scopeIndustria,
    scopeClienteGrupo,
    scopeLoginCnpj,
  ]);

  useEffect(() => {
    if (scopeIndustria) setIndustria(scopeIndustria);
  }, [scopeIndustria]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      load();
    }, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const columns = useMemo(() => {
    const map = Object.fromEntries(KANBAN_STATUSES.map((s) => [s, [] as PedidoKanbanCard[]])) as Record<
      KanbanStatus,
      PedidoKanbanCard[]
    >;
    for (const card of cards) {
      const status = card.status || KANBAN_STATUS_DEFAULT;
      map[status].push(card);
    }
    return map;
  }, [cards]);

  const totalValor = useMemo(() => cards.reduce((a, c) => a + c.valor, 0), [cards]);

  const moveCard = async (vendaId: string, nextStatus: KanbanStatus) => {
    if (somenteLeitura) {
      showToast('Modo visualização: não é possível alterar o status.', 'info');
      return;
    }
    const currentCard = cards.find((c) => c.vendaId === vendaId);
    if (!currentCard || currentCard.status === nextStatus) return;

    setCards((prev) =>
      prev.map((c) => (c.vendaId === vendaId ? { ...c, status: nextStatus } : c)),
    );

    try {
      await setPedidoKanbanStatus(vendaId, nextStatus, { allowWrite: !somenteLeitura });
    } catch (err) {
      setCards((prev) =>
        prev.map((c) => (c.vendaId === vendaId ? { ...c, status: currentCard.status } : c)),
      );
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar status.', 'error');
    }
  };

  const anosOptions = useMemo(() => {
    const set = new Set(options.anos);
    set.add(current.ano);
    set.add(String(Number(current.ano) - 1));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [options.anos, current.ano]);

  return (
    <div className="sucesso-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />

      <header className="sucesso-header">
        <div>
          <h1 className="page-title">Sucesso do cliente</h1>
          <p className="admin-subtitle">
            {somenteLeitura
              ? `Visualização${scopeIndustria ? ` — ${scopeIndustria}` : ''}${scopeClienteGrupo ? ` — grupo ${scopeClienteGrupo}` : ''}. Sem alteração de status.`
              : 'Kanban de pedidos com base nas vendas lançadas. Arraste os cards entre as colunas.'}
          </p>
        </div>
        <div className="sucesso-summary">
          <span>
            <strong>{cards.length}</strong> pedidos
          </span>
          <span>
            Total <strong>{formatKanbanValor(totalValor)}</strong>
          </span>
        </div>
      </header>

      <section className="card sucesso-filters">
        <label>
          <span>Mês</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="Todos">Todos</option>
            {MESES_PT.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0) + m.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Ano</span>
          <select value={ano} onChange={(e) => setAno(e.target.value)}>
            <option value="Todos">Todos</option>
            {anosOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Indústria</span>
          <select value={industria} onChange={(e) => setIndustria(e.target.value)}>
            <option value="Todas">Todas</option>
            {options.industrias.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Vendedor</span>
          <select value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
            <option value="Todos">Todos</option>
            {options.vendedores.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="Todos">Todos</option>
            {options.estados.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="sucesso-search">
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pedido, cliente, CNPJ..."
          />
        </label>
      </section>

      {loading ? (
        <p className="sucesso-empty">Carregando Kanban...</p>
      ) : (
        <div className="sucesso-board" aria-label="Kanban de pedidos">
          {KANBAN_STATUSES.map((status) => {
            const list = columns[status];
            const colTotal = list.reduce((a, c) => a + c.valor, 0);
            const isOver = dropTarget === status;
            const statusClass = STATUS_CLASS[status];
            const isFinalizado = status === 'Entregue finalizado';

            return (
              <section
                key={status}
                className={`sucesso-column ${statusClass} ${isOver ? 'is-over' : ''}`}
                onDragOver={(e) => {
                  if (somenteLeitura) return;
                  e.preventDefault();
                  setDropTarget(status);
                }}
                onDragLeave={() => {
                  if (somenteLeitura) return;
                  setDropTarget((prev) => (prev === status ? null : prev));
                }}
                onDrop={(e) => {
                  if (somenteLeitura) return;
                  e.preventDefault();
                  const vendaId = e.dataTransfer.getData('text/venda-id') || draggingId;
                  setDropTarget(null);
                  setDraggingId(null);
                  if (vendaId) void moveCard(vendaId, status);
                }}
              >
                <header className="sucesso-column-head">
                  <div>
                    <h2>
                      {isFinalizado && (
                        <span className="sucesso-status-check" aria-hidden>
                          <IconCheck />
                        </span>
                      )}
                      {status}
                    </h2>
                    <p>
                      {list.length} · {formatKanbanValor(colTotal)}
                    </p>
                  </div>
                  <span className="sucesso-column-count">
                    {isFinalizado && list.length > 0 ? <IconCheck /> : null}
                    {list.length}
                  </span>
                </header>

                <div className="sucesso-column-body">
                  {list.length === 0 ? (
                    <p className="sucesso-column-empty">Nenhum pedido</p>
                  ) : (
                    list.map((card) => (
                      <article
                        key={card.vendaId}
                        className={`sucesso-card ${statusClass} ${draggingId === card.vendaId ? 'is-dragging' : ''}`}
                        draggable={!somenteLeitura}
                        onDragStart={(e) => {
                          if (somenteLeitura) {
                            e.preventDefault();
                            return;
                          }
                          setDraggingId(card.vendaId);
                          e.dataTransfer.setData('text/venda-id', card.vendaId);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropTarget(null);
                        }}
                      >
                        <div className="sucesso-card-top">
                          <strong>
                            {isFinalizado && (
                              <span className="sucesso-card-check" aria-hidden>
                                <IconCheck />
                              </span>
                            )}
                            {card.numeroPedido}
                          </strong>
                          <span>{formatKanbanValor(card.valor)}</span>
                        </div>
                        <p className="sucesso-card-cliente">{card.cliente}</p>
                        <p className="sucesso-card-meta">CNPJ {formatCnpj(card.cnpj)}</p>
                        <p className="sucesso-card-meta">
                          {card.industria}
                          {card.cidade !== '—' ? ` · ${card.cidade}` : ''}
                          {card.estado ? `/${card.estado}` : ''}
                        </p>
                        <div className="sucesso-card-footer">
                          <span>{formatData(card.data)}</span>
                          <span>{card.vendedor}</span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
