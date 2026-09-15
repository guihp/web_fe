import { useState } from 'react';
import { uploadVeiculoAnexo } from '../../services/veiculosService';
import VeiculoFilePicker from './VeiculoFilePicker';

type Props = {
  label: string;
  usuarioId: number;
  required?: boolean;
  kmValue: string;
  onKmChange: (v: string) => void;
  kmIa?: number | null;
  onUploaded: (url: string, suggestedKm: number | null) => void;
};

/**
 * Upload do hodômetro + confirmação de km.
 * OCR real fica para etapa 2 (Edge Function); UI já exige confirmação humana.
 */
export default function HodometroFotoField({
  label,
  usuarioId,
  required,
  kmValue,
  onKmChange,
  kmIa,
  onUploaded,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="gv-hodometro">
      <VeiculoFilePicker
        label={label}
        accept="image/*"
        capture="environment"
        required={required && !preview}
        buttonText="Tirar ou escolher foto"
        emptyText="Nenhuma foto selecionada"
        onFile={async (file) => {
          if (!file) return;
          setErr(null);
          try {
            const url = await uploadVeiculoAnexo(usuarioId, 'hodometro', file);
            setPreview(url);
            onUploaded(url, null);
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : 'Falha no upload.');
          }
        }}
      />
      {preview && <img src={preview} alt="Hodômetro" className="gv-thumb" />}
      <p className="gv-muted">
        A leitura automática por IA será ligada depois. Por enquanto, digite a quilometragem
        vista na foto.
      </p>
      <button type="button" className="gv-btn" disabled title="OCR em breve">
        Ler quilometragem na imagem (em breve)
      </button>
      {kmIa != null && (
        <p className="gv-info">
          Identificamos {kmIa} km nesta imagem. Confirme ou corrija a quilometragem.
        </p>
      )}
      <label>
        Quilometragem confirmada (km)
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          required={required}
          value={kmValue}
          onChange={(e) => onKmChange(e.target.value)}
          placeholder="Ex.: 120"
        />
      </label>
      {err && <p className="gv-err">{err}</p>}
    </div>
  );
}
