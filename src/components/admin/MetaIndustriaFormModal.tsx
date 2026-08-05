import { useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import { formatBRL } from '../../utils/currency';

export type MetaIndustriaFormValues = {
  nome: string;
  metaMensal: number;
  metaAnual: number;
};

type MetaIndustriaFormModalProps = {
  mode: 'create' | 'edit';
  regiaoLabel: string;
  initial?: MetaIndustriaFormValues | null;
  onClose: () => void;
  onSubmit: (values: MetaIndustriaFormValues) => void;
};

function parseMoney(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return Number(digits) / 100;
}

export default function MetaIndustriaFormModal({
  mode,
  regiaoLabel,
  initial,
  onClose,
  onSubmit,
}: MetaIndustriaFormModalProps) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [metaMensal, setMetaMensal] = useState(initial?.metaMensal ?? 0);
  const [error, setError] = useState<string | null>(null);

  const metaAnual = metaMensal * 12;
  const isEdit = mode === 'edit';

  const handleSubmit = () => {
    if (!nome.trim()) {
      setError('Informe o nome da indústria.');
      return;
    }
    onSubmit({
      nome: nome.trim().toUpperCase(),
      metaMensal,
      metaAnual,
    });
    onClose();
  };

  return (
    <ModalShell onClose={onClose} className="filiais-modal">
      <div className="filiais-modal-header">
        <div>
          <h2>{isEdit ? 'Editar Indústria' : `Nova Indústria para ${regiaoLabel}`}</h2>
          <p>
            {isEdit
              ? 'Altere o nome e as metas manuais desta indústria.'
              : 'A indústria será adicionada com meta manual.'}
          </p>
        </div>
        <button type="button" className="filiais-modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <div className="filiais-form">
        <label className="filiais-field full">
          <span>
            Nome da Indústria <em>*</em>
          </span>
          <input
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setError(null);
            }}
            placeholder="Ex: Nova Indústria"
            autoFocus
          />
        </label>

        <label className="filiais-field full">
          <span>Meta Mensal (R$)</span>
          <input
            value={formatBRL(metaMensal)}
            onChange={(e) => setMetaMensal(parseMoney(e.target.value))}
          />
        </label>

        <label className="filiais-field full">
          <span>Meta Anual (R$)</span>
          <input value={formatBRL(metaAnual)} readOnly />
          <small className="projecao-field-hint">Calculado automaticamente: Meta Mensal × 12</small>
        </label>

        {error && <p className="filiais-form-error">{error}</p>}

        <div className="filiais-modal-actions">
          <button type="button" className="filiais-btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="filiais-btn-primary" onClick={handleSubmit}>
            {isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
