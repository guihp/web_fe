import { useState, type FormEvent } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import type { IndustriaAdmin, IndustriaFormInput } from '../../services/industriasAdminService';

type IndustriaFormModalProps = {
  mode: 'create' | 'edit';
  initial?: IndustriaAdmin | null;
  onClose: () => void;
  onSubmit: (values: IndustriaFormInput) => Promise<void>;
};

export default function IndustriaFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: IndustriaFormModalProps) {
  const [nome, setNome] = useState(initial?.Nome ?? '');
  const [codigo, setCodigo] = useState(initial?.codigo ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === 'edit';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!nome.trim()) {
      setError('Informe o nome da indústria.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({ nome, codigo, descricao });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? 'Não foi possível salvar a indústria.'
            : 'Não foi possível criar a indústria.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="filiais-modal">
      <div className="filiais-modal-header">
        <div>
          <h2>{isEdit ? 'Editar Indústria' : 'Nova Indústria'}</h2>
          <p>
            {isEdit
              ? 'Altere os dados da indústria e salve as mudanças.'
              : 'Cadastre uma nova indústria parceira.'}
          </p>
        </div>
        <button type="button" className="filiais-modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <form className="filiais-form" onSubmit={handleSubmit}>
        <label className="filiais-field full">
          <span>
            Nome <em>*</em>
          </span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Haribo Brasil"
            required
          />
        </label>

        <label className="filiais-field full">
          <span>Código</span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ex: HAR"
          />
        </label>

        <label className="filiais-field full">
          <span>Descrição</span>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Opcional"
          />
        </label>

        {error && <p className="filiais-form-error">{error}</p>}

        <div className="filiais-modal-actions">
          <button type="button" className="filiais-btn-outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="filiais-btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Indústria'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
