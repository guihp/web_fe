import { useState } from 'react';
import { formatNumberBr, maskNumberBrInput, parseNumberBr } from '../../lib/numberBr';
import { uploadVeiculoAnexo } from '../../services/veiculosService';
import VeiculoFilePicker from './VeiculoFilePicker';

type Props = {
  label: string;
  usuarioId: number;
  required?: boolean;
  /** Valor exibido (máscara BR, ex.: 200.000,00). */
  kmValue: string;
  onKmChange: (v: string) => void;
  kmIa?: number | null;
  onUploaded: (url: string, suggestedKm: number | null) => void;
};

/**
 * Upload do hodômetro + confirmação manual do km (formato BR).
 * OCR/IA é opcional depois; o cálculo da entrega usa o valor confirmado.
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
        Anexe a foto e digite a quilometragem exatamente como aparece no painel. A foto fica
        guardada para conferência; o cálculo na entrega usa este valor confirmado.
      </p>
      {kmIa != null && (
        <p className="gv-info">
          Sugestão da imagem: {formatNumberBr(kmIa)} km. Confira com a foto e ajuste se
          necessário.
        </p>
      )}
      <label>
        Quilometragem confirmada (km)
        <input
          type="text"
          inputMode="decimal"
          required={required}
          value={kmValue}
          onChange={(e) => onKmChange(maskNumberBrInput(e.target.value))}
          onPaste={(e) => {
            e.preventDefault();
            onKmChange(maskNumberBrInput(e.clipboardData.getData('text')));
          }}
          onBlur={() => {
            const n = parseNumberBr(kmValue);
            if (n != null) onKmChange(formatNumberBr(n));
          }}
          placeholder="Ex.: 200.000,00"
          title="Formato brasileiro: 200.000,00"
          autoComplete="off"
        />
      </label>
      {err && <p className="gv-err">{err}</p>}
    </div>
  );
}
