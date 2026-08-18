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

type HorizontalBarChartProps = {
  data: { nome: string; valor: number }[];
  color: string;
  maxValue?: number;
};

export function HorizontalBarChart({ data, color, maxValue }: HorizontalBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.valor), 1);

  return (
    <div className="h-bar-chart">
      {data.map((item) => {
        const width = (item.valor / max) * 100;
        return (
          <div key={item.nome} className="h-bar-row">
            <span className="h-bar-label">{item.nome}</span>
            <div className="h-bar-track">
              <div className="h-bar-fill" style={{ width: `${width}%`, background: color }} />
            </div>
            <span className="h-bar-value">{formatBRL(item.valor)}</span>
          </div>
        );
      })}
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
};

export function KpiCardView({ title, realizado, meta, percentLabel, icon }: KpiCardViewProps) {
  const pctRaw = meta > 0 ? (realizado / meta) * 100 : 0;
  const pctBar = Math.min(pctRaw, 100);
  const alcançada = meta > 0 && realizado >= meta;
  const statusLabel = alcançada
    ? `Meta Alcançada! ${pctRaw.toFixed(2).replace('.', ',')}%`
    : percentLabel;

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
      <p className="vendas-kpi-percent">{statusLabel}</p>
    </article>
  );
}
