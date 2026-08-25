import type { ValidadeTopProduto } from '../../services/validadeService';
import './ValidadesTopChart.css';

type ValidadesTopChartProps = {
  data: ValidadeTopProduto[];
  loading?: boolean;
  periodLabel: string;
  emptyHint?: string;
};

function formatQtde(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export default function ValidadesTopChart({
  data,
  loading = false,
  periodLabel,
  emptyHint = 'Nenhum produto vencido neste período.',
}: ValidadesTopChartProps) {
  const total = data.reduce((sum, d) => sum + d.qtde, 0);
  const max = Math.max(...data.map((d) => d.qtde), 1);

  if (loading) {
    return <p className="validades-chart-loading">Carregando gráfico...</p>;
  }

  if (data.length === 0) {
    return <p className="validades-chart-empty">{emptyHint}</p>;
  }

  return (
    <div className="validades-chart">
      <div className="validades-chart-head">
        <h3>Produtos que mais venceram</h3>
        <p>
          Top {data.length} por quantidade no período: <strong>{periodLabel}</strong>
          {total > 0 ? ` · total ${formatQtde(total)} un.` : ''}
        </p>
      </div>

      <div className="validades-chart-bars">
        {data.map((item, index) => {
          const width = max > 0 ? (item.qtde / max) * 100 : 0;
          const pct = total > 0 ? (item.qtde / total) * 100 : 0;
          return (
            <div key={`${item.nome}-${index}`} className="validades-chart-row">
              <span className="validades-chart-rank">{index + 1}</span>
              <span className="validades-chart-label" title={item.nome}>
                {item.nome}
              </span>
              <div className="validades-chart-track">
                <div className="validades-chart-fill" style={{ width: `${width}%` }} />
              </div>
              <span className="validades-chart-metrics">
                <strong>{formatQtde(item.qtde)}</strong>
                <span>{pct.toFixed(1).replace('.', ',')}%</span>
                <small>{item.registros} reg.</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
