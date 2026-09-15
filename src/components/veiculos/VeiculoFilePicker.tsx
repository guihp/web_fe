import { useId, useRef, useState } from 'react';
import './VeiculoFilePicker.css';

type VeiculoFilePickerProps = {
  label?: string;
  accept?: string;
  capture?: boolean | 'user' | 'environment';
  required?: boolean;
  disabled?: boolean;
  buttonText?: string;
  emptyText?: string;
  onFile: (file: File | null) => void | Promise<void>;
};

export default function VeiculoFilePicker({
  label,
  accept = 'image/*',
  capture,
  required,
  disabled,
  buttonText = 'Escolher arquivo',
  emptyText = 'Nenhum arquivo selecionado',
  onFile,
}: VeiculoFilePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const captureProp =
    capture === true ? 'environment' : capture === false || capture == null ? undefined : capture;

  return (
    <div className="gv-file-picker">
      {label ? (
        <span className="gv-file-picker-label">
          {label}
          {required ? ' *' : ''}
        </span>
      ) : null}
      <div className="gv-file-picker-row">
        <input
          ref={inputRef}
          id={inputId}
          className="gv-file-picker-native"
          type="file"
          accept={accept}
          capture={captureProp}
          required={required && !fileName}
          disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0] ?? null;
            setFileName(file?.name ?? null);
            setBusy(true);
            try {
              await onFile(file);
            } finally {
              setBusy(false);
            }
          }}
        />
        <button
          type="button"
          className="gv-file-picker-btn"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Enviando…' : buttonText}
        </button>
        <span className={`gv-file-picker-name${fileName ? ' has-file' : ''}`} title={fileName ?? undefined}>
          {fileName ?? emptyText}
        </span>
      </div>
    </div>
  );
}
