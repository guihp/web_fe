import { useEffect, useState, type FormEvent } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import {
  fetchRegionais,
  type Loja,
  type LojaFormInput,
  type RegionalOption,
} from '../../services/lojasService';

type FilialFormModalProps = {
  mode: 'create' | 'edit';
  initial?: Loja | null;
  onClose: () => void;
  onSubmit: (values: LojaFormInput) => Promise<void>;
};

export default function FilialFormModal({ mode, initial, onClose, onSubmit }: FilialFormModalProps) {
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [regionalId, setRegionalId] = useState(initial?.regional_id ? String(initial.regional_id) : '');
  const [nome, setNome] = useState(initial?.Nome ?? '');
  const [codigo, setCodigo] = useState(initial?.codigo != null ? String(initial.codigo) : '');
  const [cnpj, setCnpj] = useState(initial?.cnpj ?? '');
  const [cidade, setCidade] = useState(initial?.cidade ?? '');
  const [estado, setEstado] = useState(initial?.estado ?? '');
  const [endereco, setEndereco] = useState(initial?.endereco ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRegionais()
      .then((rows) => {
        setRegionais(rows);
        if (!regionalId && initial?.regional) {
          const match = rows.find((r) => r.Nome === initial.regional);
          if (match) setRegionalId(String(match.id));
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar regionais.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from initial
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const regional = regionais.find((r) => String(r.id) === regionalId);
    if (!regional) {
      setError('Selecione a regional.');
      return;
    }
    if (!nome.trim()) {
      setError('Informe o nome da filial.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        nome,
        codigo,
        cnpj,
        regionalId: regional.id,
        regionalNome: regional.Nome,
        cidade,
        estado,
        endereco,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'edit'
            ? 'Não foi possível salvar a filial.'
            : 'Não foi possível criar a filial.',
      );
    } finally {
      setSaving(false);
    }
  };

  const isEdit = mode === 'edit';

  return (
    <ModalShell onClose={onClose} className="filiais-modal">
      <div className="filiais-modal-header">
        <div>
          <h2>{isEdit ? 'Editar Filial' : 'Nova Filial'}</h2>
          <p>
            {isEdit
              ? 'Altere os dados da filial e salve as mudanças.'
              : 'Cadastre uma nova filial vinculada a uma regional.'}
          </p>
        </div>
        <button type="button" className="filiais-modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <form className="filiais-form" onSubmit={handleSubmit}>
        <label className="filiais-field full">
          <span>
            Regional <em>*</em>
          </span>
          <select value={regionalId} onChange={(e) => setRegionalId(e.target.value)} required>
            <option value="">Selecione a regional</option>
            {regionais.map((r) => (
              <option key={r.id} value={r.id}>
                {r.Nome}
              </option>
            ))}
          </select>
        </label>

        <div className="filiais-form-row">
          <label className="filiais-field">
            <span>
              Nome da Filial <em>*</em>
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Filial Centro"
              required
            />
          </label>
          <label className="filiais-field">
            <span>Código</span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex: 120"
              inputMode="numeric"
            />
          </label>
        </div>

        <label className="filiais-field full">
          <span>CNPJ</span>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </label>

        <div className="filiais-form-row cidade-estado">
          <label className="filiais-field">
            <span>Cidade</span>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="São Luís"
            />
          </label>
          <label className="filiais-field estado">
            <span>Estado</span>
            <input
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase())}
              placeholder="MA"
              maxLength={2}
            />
          </label>
        </div>

        <label className="filiais-field full">
          <span>Endereço</span>
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Av. Principal, 1000"
          />
        </label>

        {error && <p className="filiais-form-error">{error}</p>}

        <div className="filiais-modal-actions">
          <button type="button" className="filiais-btn-outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="filiais-btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Filial'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
