import { useMemo, useState } from 'react';
import {
  calcMargemFromMarkup,
  calcMarkupExibido,
  calcMarkupPercent,
  formatPct,
  type PesquisaItem,
} from '../../services/priceService';
import { formatBRL } from '../../utils/currency';

const COR_PV = '#2563eb';
const COR_CUSTO = '#22c55e';
const COR_MARKUP = '#b91c1c';
const COR_MARGEM = '#ea6624';

type ChartPoint = {
  loja: string;
  preco_varejo: number | null;
  preco_custo: number | null;
  markup: number | null;
  margem: number | null;
};

type PriceInternoChartProps = {
  items: PesquisaItem[];
  multiplicadorPct: number;
  loading?: boolean;
};

type LabelSpec = {
  key: string;
  text: string;
  color: string;
  preferredY: number;
  xOffset: number;
};

type PlacedLabel = LabelSpec & { y: number };

function uniqueProducts(items: PesquisaItem[]): string[] {
  const set = new Set<string>();
  for (const row of items) {
    const name = row.descricao.trim();
    if (name && name !== '—') set.add(name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function buildPoints(items: PesquisaItem[], produto: string, multiplicadorPct: number): ChartPoint[] {
  const rows = items.filter((r) => r.descricao === produto);
  const byLoja = new Map<string, PesquisaItem>();
  for (const row of rows) {
    const loja = (row.loja ?? 'Sem loja').trim() || 'Sem loja';
    const prev = byLoja.get(loja);
    if (!prev) {
      byLoja.set(loja, row);
      continue;
    }
    if (prev.preco_custo == null && row.preco_custo != null) byLoja.set(loja, row);
  }

  return [...byLoja.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([loja, row]) => {
      const markupBase = calcMarkupPercent(row.preco_varejo, row.preco_custo);
      const markup = calcMarkupExibido(markupBase, multiplicadorPct);
      const margem = calcMargemFromMarkup(markup);
      return {
        loja,
        preco_varejo: row.preco_varejo,
        preco_custo: row.preco_custo,
        markup,
        margem,
      };
    });
}

function moneyLabel(v: number | null): string {
  if (v == null) return '';
  return formatBRL(v);
}

/** Empilha rótulos da mesma coluna para não sobrepor. */
function stackLabels(labels: LabelSpec[], minGap: number, yMin: number, yMax: number): PlacedLabel[] {
  if (labels.length === 0) return [];
  const sorted = [...labels].sort((a, b) => a.preferredY - b.preferredY);
  const ys = sorted.map((l) => l.preferredY);

  for (let i = 1; i < ys.length; i += 1) {
    if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap;
  }

  if (ys[ys.length - 1] > yMax) {
    const shift = ys[ys.length - 1] - yMax;
    for (let i = 0; i < ys.length; i += 1) ys[i] -= shift;
  }
  if (ys[0] < yMin) {
    const shift = yMin - ys[0];
    for (let i = 0; i < ys.length; i += 1) ys[i] += shift;
  }
  for (let i = 1; i < ys.length; i += 1) {
    if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap;
  }

  return sorted.map((l, i) => ({ ...l, y: ys[i] }));
}

export default function PriceInternoChart({
  items,
  multiplicadorPct,
  loading,
}: PriceInternoChartProps) {
  const products = useMemo(() => uniqueProducts(items), [items]);
  const [produto, setProduto] = useState<string>('');
  const [produtoSearch, setProdutoSearch] = useState('');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const selected = produto && products.includes(produto) ? produto : products[0] ?? '';

  const filteredProducts = useMemo(() => {
    const q = produtoSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.toLowerCase().includes(q));
  }, [products, produtoSearch]);

  const points = useMemo(
    () => (selected ? buildPoints(items, selected, multiplicadorPct) : []),
    [items, selected, multiplicadorPct],
  );

  const moneyMax = Math.max(
    ...points.flatMap((p) => [p.preco_varejo ?? 0, p.preco_custo ?? 0]),
    1,
  );
  const pctMax = Math.max(...points.flatMap((p) => [p.markup ?? 0, p.margem ?? 0]), 1);

  const W = 920;
  const H = 400;
  const padL = 54;
  const padR = 54;
  const padT = 48;
  const padB = 82;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const labelYMin = padT + 8;
  const labelYMax = padT + plotH - 4;

  const xAt = (i: number) => {
    if (points.length <= 1) return padL + plotW / 2;
    return padL + (i / (points.length - 1)) * plotW;
  };
  const yMoney = (v: number) => padT + plotH - (v / (moneyMax * 1.12)) * plotH;
  const yPct = (v: number) => padT + plotH - (v / (pctMax * 1.12)) * plotH;

  const linePath = (vals: (number | null)[], yFn: (v: number) => number) => {
    const parts: string[] = [];
    vals.forEach((v, i) => {
      if (v == null) return;
      const cmd = parts.length === 0 ? 'M' : 'L';
      parts.push(`${cmd}${xAt(i).toFixed(1)},${yFn(v).toFixed(1)}`);
    });
    return parts.join(' ');
  };

  const placedByStore = useMemo(() => {
    return points.map((p, i) => {
      const x = xAt(i);
      const specs: LabelSpec[] = [];
      if (p.preco_varejo != null) {
        specs.push({
          key: 'pv',
          text: moneyLabel(p.preco_varejo),
          color: COR_PV,
          preferredY: yMoney(p.preco_varejo) - 14,
          xOffset: -10,
        });
      }
      if (p.markup != null) {
        specs.push({
          key: 'markup',
          text: formatPct(p.markup),
          color: COR_MARKUP,
          preferredY: yPct(p.markup) - 14,
          xOffset: 12,
        });
      }
      if (p.preco_custo != null) {
        specs.push({
          key: 'custo',
          text: moneyLabel(p.preco_custo),
          color: COR_CUSTO,
          preferredY: yMoney(p.preco_custo) + 16,
          xOffset: -10,
        });
      }
      if (p.margem != null) {
        specs.push({
          key: 'margem',
          text: formatPct(p.margem),
          color: COR_MARGEM,
          preferredY: yPct(p.margem) + 16,
          xOffset: 12,
        });
      }
      return {
        x,
        labels: stackLabels(specs, 14, labelYMin, labelYMax),
      };
    });
    // xAt/yMoney/yPct depend on points + layout constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, moneyMax, pctMax]);

  if (loading) {
    return <p className="price-chart-empty">Carregando gráfico...</p>;
  }

  if (products.length === 0) {
    return (
      <p className="price-chart-empty">
        Nenhum produto interno para graficar. Cadastre pesquisas internas com preço e custo.
      </p>
    );
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div className="price-chart-layout">
      <div className="price-chart-main">
        <div className="price-chart-title-row">
          <h3>Pesquisa interna — {selected}</h3>
          <div className="price-chart-legend">
            <span>
              <i style={{ background: COR_PV }} /> Preço Varejo
            </span>
            <span>
              <i style={{ background: COR_CUSTO }} /> Custo
            </span>
            <span>
              <i style={{ background: COR_MARKUP }} /> Markup
            </span>
            <span>
              <i style={{ background: COR_MARGEM }} /> Margem
            </span>
          </div>
        </div>

        {points.length === 0 ? (
          <p className="price-chart-empty">Sem lojas para este produto.</p>
        ) : (
          <div className="price-chart-svg-wrap">
            {hovered && (
              <div className="price-chart-tooltip" role="status">
                <strong>{hovered.loja}</strong>
                <span style={{ color: COR_PV }}>PV: {moneyLabel(hovered.preco_varejo) || '—'}</span>
                <span style={{ color: COR_CUSTO }}>Custo: {moneyLabel(hovered.preco_custo) || '—'}</span>
                <span style={{ color: COR_MARKUP }}>Markup: {formatPct(hovered.markup)}</span>
                <span style={{ color: COR_MARGEM }}>Margem: {formatPct(hovered.margem)}</span>
              </div>
            )}
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="price-chart-svg"
              role="img"
              aria-label="Gráfico de preço, custo, markup e margem por loja"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = padT + plotH * (1 - t);
                return (
                  <line
                    key={t}
                    x1={padL}
                    x2={W - padR}
                    y1={y}
                    y2={y}
                    stroke="var(--border, #e5e7eb)"
                    strokeWidth={1}
                  />
                );
              })}

              {[0, 0.5, 1].map((t) => {
                const val = moneyMax * 1.12 * t;
                const y = yMoney(val);
                return (
                  <text
                    key={`m-${t}`}
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="price-chart-axis"
                  >
                    {formatBRL(val)}
                  </text>
                );
              })}

              {[0, 0.5, 1].map((t) => {
                const val = pctMax * 1.12 * t;
                const y = yPct(val);
                return (
                  <text
                    key={`p-${t}`}
                    x={W - padR + 8}
                    y={y + 4}
                    textAnchor="start"
                    className="price-chart-axis"
                  >
                    {val.toFixed(0)}%
                  </text>
                );
              })}

              <path
                d={linePath(
                  points.map((p) => p.preco_varejo),
                  yMoney,
                )}
                fill="none"
                stroke={COR_PV}
                strokeWidth={2.5}
              />
              <path
                d={linePath(
                  points.map((p) => p.preco_custo),
                  yMoney,
                )}
                fill="none"
                stroke={COR_CUSTO}
                strokeWidth={2.5}
              />
              <path
                d={linePath(
                  points.map((p) => p.markup),
                  yPct,
                )}
                fill="none"
                stroke={COR_MARKUP}
                strokeWidth={2.5}
              />
              <path
                d={linePath(
                  points.map((p) => p.margem),
                  yPct,
                )}
                fill="none"
                stroke={COR_MARGEM}
                strokeWidth={2.5}
                strokeDasharray="5 4"
              />

              {points.map((p, i) => {
                const x = xAt(i);
                const placed = placedByStore[i];
                const active = hoverIdx === i;
                return (
                  <g key={p.loja}>
                    {/* hit area */}
                    <rect
                      x={x - Math.max(18, plotW / points.length / 2)}
                      y={padT}
                      width={Math.max(36, plotW / points.length)}
                      height={plotH}
                      fill={active ? 'rgba(234,102,36,0.08)' : 'transparent'}
                      onMouseEnter={() => setHoverIdx(i)}
                      onMouseLeave={() => setHoverIdx(null)}
                      style={{ cursor: 'pointer' }}
                    />

                    {p.preco_varejo != null && (
                      <polygon
                        points={`${x},${yMoney(p.preco_varejo) - 5} ${x + 5},${yMoney(p.preco_varejo) + 4} ${x - 5},${yMoney(p.preco_varejo) + 4}`}
                        fill={COR_PV}
                        pointerEvents="none"
                      />
                    )}
                    {p.preco_custo != null && (
                      <polygon
                        points={`${x},${yMoney(p.preco_custo) + 6} ${x + 5},${yMoney(p.preco_custo) - 3} ${x - 5},${yMoney(p.preco_custo) - 3}`}
                        fill={COR_CUSTO}
                        pointerEvents="none"
                      />
                    )}
                    {p.markup != null && (
                      <rect
                        x={x - 4}
                        y={yPct(p.markup) - 4}
                        width={8}
                        height={8}
                        fill={COR_MARKUP}
                        pointerEvents="none"
                      />
                    )}
                    {p.margem != null && (
                      <circle cx={x} cy={yPct(p.margem)} r={4} fill={COR_MARGEM} pointerEvents="none" />
                    )}

                    {placed.labels.map((lab) => {
                      const pillW = Math.max(48, lab.text.length * 6.2);
                      return (
                        <g key={lab.key} pointerEvents="none">
                          <rect
                            x={x + lab.xOffset - pillW / 2}
                            y={lab.y - 10}
                            width={pillW}
                            height={13}
                            rx={3}
                            fill="rgba(15, 23, 42, 0.75)"
                          />
                          <text
                            x={x + lab.xOffset}
                            y={lab.y}
                            textAnchor="middle"
                            className="price-chart-label"
                            fill={lab.color}
                          >
                            {lab.text}
                          </text>
                        </g>
                      );
                    })}

                    <text
                      x={x}
                      y={H - 12}
                      textAnchor="middle"
                      className="price-chart-loja"
                      transform={`rotate(-28 ${x} ${H - 12})`}
                      pointerEvents="none"
                    >
                      {p.loja.length > 16 ? `${p.loja.slice(0, 14)}…` : p.loja}
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className="price-chart-hint">Passe o mouse sobre uma loja para ver os valores juntos.</p>
          </div>
        )}
      </div>

      <aside className="price-chart-products">
        <div className="price-chart-products-head">
          <strong>Produto</strong>
          <input
            type="search"
            placeholder="Filtrar..."
            value={produtoSearch}
            onChange={(e) => setProdutoSearch(e.target.value)}
            aria-label="Filtrar produtos do gráfico"
          />
        </div>
        <ul className="price-chart-product-list">
          {filteredProducts.map((name) => (
            <li key={name}>
              <button
                type="button"
                className={name === selected ? 'active' : ''}
                onClick={() => setProduto(name)}
              >
                {name}
              </button>
            </li>
          ))}
          {filteredProducts.length === 0 && (
            <li className="price-chart-product-empty">Nenhum produto.</li>
          )}
        </ul>
      </aside>
    </div>
  );
}
