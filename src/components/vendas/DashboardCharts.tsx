import { formatBRL, formatBRLCompact } from '../../utils/currency';

type DonutChartProps = {
  realizado: number;
  meta: number;
  color: string;
  emptyColor?: string;
};

export function DonutChart({ realizado, meta, color, emptyColor = '#f3f4f6' }: DonutChartProps) {
  const pct = meta > 0 ? Math.min(realizado / meta, 1) : 0;
  const size = 120;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={emptyColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="donut-legend">
        <span>
          <i style={{ background: color }} /> Realizado: {formatBRLCompact(realizado)}
        </span>
        <span>
          <i style={{ background: emptyColor }} /> Desvio: {formatBRLCompact(Math.max(meta - realizado, 0))}
        </span>
      </div>
    </div>
  );
}

const PIE_PALETTE = [
  '#ea6624',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#ec4899',
  '#64748b',
  '#d97706',
  '#2563eb',
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  if (endAngle - startAngle >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

type PieChartProps = {
  data: { nome: string; valor: number }[];
  emptyColor?: string;
};

export function PieChart({ data, emptyColor = '#e5e7eb' }: PieChartProps) {
  const rows = data.filter((d) => d.valor > 0 && d.nome.trim() && d.nome !== 'Sem dados');
  const total = rows.reduce((sum, d) => sum + d.valor, 0);
  const size = 120;
  const radius = 54;
  const cx = size / 2;
  const cy = size / 2;

  if (rows.length === 0 || total <= 0) {
    return (
      <div className="donut-wrap pie-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={radius} fill={emptyColor} />
        </svg>
        <div className="donut-legend">
          <span>Sem dados no mês</span>
        </div>
      </div>
    );
  }

  let angle = 0;
  const slices = rows.map((item, index) => {
    const sweep = (item.valor / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return {
      ...item,
      start,
      end,
      color: PIE_PALETTE[index % PIE_PALETTE.length]!,
      pct: (item.valor / total) * 100,
    };
  });

  return (
    <div className="donut-wrap pie-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {slices.map((slice, index) => (
          <path
            key={`${slice.nome}-${index}`}
            d={pieSlicePath(cx, cy, radius, slice.start, slice.end)}
            fill={slice.color}
            stroke="var(--surface, #fff)"
            strokeWidth={1}
          />
        ))}
      </svg>
      <div className="donut-legend pie-legend">
        {slices.map((slice, index) => (
          <span key={`${slice.nome}-${index}`} title={slice.nome}>
            <i style={{ background: slice.color }} />
            <span className="pie-legend-text">
              <strong>{slice.nome}</strong>
              {formatBRLCompact(slice.valor)} · {slice.pct.toFixed(1).replace('.', ',')}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

type HorizontalBarChartProps = {
  data: { nome: string; valor: number }[];
  color: string;
  maxValue?: number;
  /** Mostra % de cada item sobre o total da lista e linha de total no fim. */
  showShareAndTotal?: boolean;
};

export function HorizontalBarChart({
  data,
  color,
  maxValue,
  showShareAndTotal = false,
}: HorizontalBarChartProps) {
  const rows = data.filter((d) => d.valor > 0 && d.nome.trim() && d.nome !== 'Sem dados');
  const total = rows.reduce((sum, d) => sum + d.valor, 0);
  const max = maxValue ?? Math.max(...rows.map((d) => d.valor), 1);

  const fmtPct = (valor: number) => {
    if (total <= 0) return '0,0%';
    return `${((valor / total) * 100).toFixed(1).replace('.', ',')}%`;
  };

  if (rows.length === 0) {
    return (
      <div className="h-bar-chart">
        <p className="h-bar-empty">Sem dados</p>
      </div>
    );
  }

  return (
    <div className={`h-bar-chart${showShareAndTotal ? ' h-bar-chart--share' : ''}`}>
      <div className="h-bar-chart-scroll">
        {rows.map((item, index) => {
          const width = max > 0 ? (item.valor / max) * 100 : 0;
          return (
            <div key={`${item.nome}-${index}`} className="h-bar-row">
              <span className="h-bar-label" title={item.nome}>
                {item.nome}
              </span>
              <div className="h-bar-track">
                <div className="h-bar-fill" style={{ width: `${width}%`, background: color }} />
              </div>
              <span className="h-bar-metrics">
                <span className="h-bar-value">{formatBRL(item.valor)}</span>
                {showShareAndTotal && <span className="h-bar-pct">{fmtPct(item.valor)}</span>}
              </span>
            </div>
          );
        })}
      </div>
      {showShareAndTotal && (
        <div className="h-bar-row h-bar-row--total">
          <span className="h-bar-label">Total</span>
          <div className="h-bar-track h-bar-track--total">
            <div className="h-bar-fill" style={{ width: '100%', background: color }} />
          </div>
          <span className="h-bar-metrics">
            <span className="h-bar-value">{formatBRL(total)}</span>
            <span className="h-bar-pct">100%</span>
          </span>
        </div>
      )}
    </div>
  );
}

type VerticalBarChartProps = {
  data: { mes: string; valor: number }[];
  color: string;
  maxValue?: number;
};

export function VerticalBarChart({ data, color, maxValue }: VerticalBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.valor), 1);

  return (
    <div className="v-bar-chart">
      <div className="v-bar-grid">
        {data.map((item) => {
          const height = max > 0 ? (item.valor / max) * 100 : 0;
          return (
            <div key={item.mes} className="v-bar-col">
              {item.valor > 0 && (
                <span className="v-bar-top-label">{formatBRLCompact(item.valor)}</span>
              )}
              <div className="v-bar-shell">
                <div className="v-bar-fill" style={{ height: `${height}%`, background: color }} />
              </div>
              <span className="v-bar-mes">{item.mes}</span>
            </div>
          );
        })}
      </div>
      <div className="v-bar-legend">
        <i style={{ background: color }} /> Realizado
      </div>
    </div>
  );
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 17l6-6 4 4 8-10" />
      <path d="M14 5h7v7" />
    </svg>
  );
}

type KpiCardViewProps = {
  title: string;
  realizado: number;
  meta: number;
  percentLabel: string;
  icon: 'target' | 'trend';
  /** Participação das regiões no total (só cards gerais). */
  regionShare?: { mapiPct: number; paPct: number };
};

export function KpiCardView({
  title,
  realizado,
  meta,
  percentLabel,
  icon,
  regionShare,
}: KpiCardViewProps) {
  const pctRaw = meta > 0 ? (realizado / meta) * 100 : 0;
  const pctBar = Math.min(pctRaw, 100);
  const alcançada = meta > 0 && realizado >= meta;
  const statusLabel = alcançada
    ? `Meta Alcançada! ${pctRaw.toFixed(2).replace('.', ',')}%`
    : percentLabel;

  const fmtShare = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;

  return (
    <article className={`vendas-kpi card${alcançada ? ' alcançada' : ''}`}>
      <div className="vendas-kpi-top">
        <span className="vendas-kpi-title">{title}</span>
        <span className="vendas-kpi-icon">{icon === 'target' ? <TargetIcon /> : <TrendIcon />}</span>
      </div>
      <p className="vendas-kpi-value">{formatBRL(realizado)}</p>
      <p className="vendas-kpi-meta">Meta: {formatBRL(meta)}</p>
      <div className="vendas-kpi-bar">
        <div className="vendas-kpi-bar-fill" style={{ width: `${pctBar}%` }} />
      </div>
      <div className="vendas-kpi-footer">
        <p className="vendas-kpi-percent">{statusLabel}</p>
        {regionShare && (
          <p className="vendas-kpi-regions" aria-label="Participação por região">
            <span>
              MA/PI <strong>{fmtShare(regionShare.mapiPct)}</strong>
            </span>
            <span>
              PA <strong>{fmtShare(regionShare.paPct)}</strong>
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
