import { useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import type { Validade } from '../../services/validadeService';
import './ValidadeVendaModal.css';

type ValidadeVendaModalProps = {
  item: Validade;
  lojaLabel?: string;
  onClose: () => void;
  onConfirm: (opts: { qtdeVendida?: number; tudoVendido?: boolean }) => Promise<void>;
};

export default function ValidadeVendaModal({
  item,
  lojaLabel,
  onClose,
  onConfirm,
}: ValidadeVendaModalProps) {
  const disponivel = item.qtde_unit;
  const [modo, setModo] = useState<'parcial' | 'total'>('parcial');
  const [qtde, setQtde] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lojaText = lojaLabel || item.lojas;

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      if (modo === 'total') {
        await onConfirm({ tudoVendido: true });
      } else {
        const n = Number(qtde.replace(',', '.'));
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error('Informe a quantidade vendida.');
        }
        if (disponivel != null && n > disponivel) {
          throw new Error(`Máximo disponível: ${disponivel}.`);
        }
        await onConfirm({ qtdeVendida: n });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar venda.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="form-modal validade-venda-modal">
      <div className="colab-modal-header">
        <h2>Registrar venda</h2>
        <p>
          {item.descricao ?? 'Produto'}
          {item.codigo ? ` · cód. ${item.codigo}` : ''}
          {lojaText ? ` · ${lojaText}` : ''}
        </p>
      </div>

      <div className="colab-form">
        <p className="validade-venda-disponivel">
          Disponível:{' '}
          <strong>{disponivel == null ? '—' : disponivel.toLocaleString('pt-BR')}</strong> un.
        </p>

        <div className="validade-venda-modos" role="group" aria-label="Tipo de venda">
          <button
            type="button"
            className={modo === 'parcial' ? 'active' : ''}
            onClick={() => setModo('parcial')}
          >
            Venda parcial
          </button>
          <button
            type="button"
            className={modo === 'total' ? 'active' : ''}
            onClick={() => setModo('total')}
          >
            Tudo vendido
          </button>
        </div>

        {modo === 'parcial' ? (
          <label className="colab-field full">
            <span>Quantidade vendida</span>
            <input
              type="number"
              min={1}
              step={1}
              max={disponivel ?? undefined}
              value={qtde}
              onChange={(e) => setQtde(e.target.value)}
              placeholder="Ex.: 70"
              autoFocus
            />
            <small>
              A validade continua na lista com a quantidade restante
              {disponivel != null && qtde
                ? ` (${Math.max(0, disponivel - Number(qtde.replace(',', '.') || 0))} un.)`
                : ''}
              .
            </small>
          </label>
        ) : (
          <p className="validade-venda-aviso">
            Este registro <strong>sai da listagem e do gráfico desta loja</strong>. O produto só some
            do gráfico do mês se zerar em <strong>todas</strong> as lojas.
          </p>
        )}

        {error && <p className="colab-error">{error}</p>}

        <div className="colab-actions">
          <button type="button" className="colab-btn outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="colab-btn primary"
            onClick={() => void handleSubmit()}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
