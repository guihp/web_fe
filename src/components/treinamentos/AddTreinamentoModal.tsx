import { useState } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import { addTreinamento } from '../../services/treinamentoService';
import './TreinamentoModals.css';

type MaterialType = 'PDF' | 'Video';

type AddTreinamentoModalProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function AddTreinamentoModal({ onClose, onSuccess }: AddTreinamentoModalProps) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<MaterialType>('PDF');
  const [file, setFile] = useState<File | null>(null);
  const [youtubeLink, setYoutubeLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      setError('Selecione um arquivo PDF.');
      return;
    }
    setError(null);
    setFile(selected);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      await addTreinamento({
        titulo,
        tipo,
        file: tipo === 'PDF' ? file : null,
        youtubeLink: tipo === 'Video' ? youtubeLink : undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar treinamento.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="treinamento-modal">
      <div className="treinamento-modal-header">
        <div>
          <h2>Adicionar treinamento</h2>
          <p>adicione novos treinamentos para seus colaboradores</p>
        </div>
        <button type="button" className="treinamento-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <label className="treinamento-field">
        <span>Treinamento</span>
        <input
          type="text"
          placeholder="Titulo do treinamento"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </label>

      <div className="treinamento-type-row">
        <button
          type="button"
          className={`treinamento-type-btn ${tipo === 'PDF' ? 'active pdf' : ''}`}
          onClick={() => setTipo('PDF')}
        >
          <span>📄</span> Arquivo
        </button>
        <button
          type="button"
          className={`treinamento-type-btn ${tipo === 'Video' ? 'active video' : ''}`}
          onClick={() => setTipo('Video')}
        >
          <span>▶</span> Link do Youtube
        </button>
      </div>

      {tipo === 'PDF' ? (
        <div className="treinamento-file-area">
          <label className="treinamento-file-btn">
            Selecionar Arquivo
            <input type="file" accept="application/pdf" onChange={handleFileChange} hidden />
          </label>
          {file && <p className="treinamento-file-name">{file.name}</p>}
        </div>
      ) : (
        <label className="treinamento-field">
          <span>Link do YouTube</span>
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={youtubeLink}
            onChange={(e) => setYoutubeLink(e.target.value)}
          />
        </label>
      )}

      {error && <p className="treinamento-error">{error}</p>}

      <div className="treinamento-modal-actions">
        <button type="button" className="treinamento-btn-save" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" className="treinamento-btn-cancel" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </ModalShell>
  );
}
