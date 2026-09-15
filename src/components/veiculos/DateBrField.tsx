import { useEffect, useRef, useState } from 'react';
import { brDateToIso, isoDateToBr, maskDateBrInput } from '../../lib/cpf';
import './DateBrField.css';

type DateBrFieldProps = {
  label?: string;
  valueIso: string;
  onChangeIso: (iso: string) => void;
  required?: boolean;
  disabled?: boolean;
};

/** Campo de data no formato brasileiro DD/MM/AAAA (valor interno YYYY-MM-DD). */
export default function DateBrField({
  label,
  valueIso,
  onChangeIso,
  required,
  disabled,
}: DateBrFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => isoDateToBr(valueIso));

  useEffect(() => {
    const next = isoDateToBr(valueIso);
    if (next && next !== text) setText(next);
    if (!valueIso && text.length === 10) setText('');
    // Só sincroniza quando o valor externo ISO muda de verdade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueIso]);

  return (
    <div className="gv-date-br">
      {label ? <span className="gv-date-br-label">{label}</span> : null}
      <div className="gv-date-br-wrap">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          disabled={disabled}
          required={required}
          placeholder="DD/MM/AAAA"
          maxLength={10}
          pattern="\d{2}/\d{2}/\d{4}"
          title="Formato DD/MM/AAAA"
          autoComplete="off"
          aria-label={label ? `${label} DD/MM/AAAA` : 'Data DD/MM/AAAA'}
          onChange={(e) => {
            const br = maskDateBrInput(e.target.value);
            setText(br);
            const iso = brDateToIso(br);
            if (iso) onChangeIso(iso);
            else if (br.length === 0) onChangeIso('');
          }}
          onPaste={(e) => {
            e.preventDefault();
            const br = maskDateBrInput(e.clipboardData.getData('text'));
            setText(br);
            const iso = brDateToIso(br);
            if (iso) onChangeIso(iso);
          }}
          onBlur={() => {
            const iso = brDateToIso(text);
            if (iso) {
              setText(isoDateToBr(iso));
              onChangeIso(iso);
            } else if (text.trim()) {
              // incompleto: volta ao valor ISO atual
              setText(isoDateToBr(valueIso));
            }
          }}
        />
        <input
          ref={pickerRef}
          type="date"
          className="gv-date-br-native"
          value={valueIso || ''}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            onChangeIso(e.target.value);
            setText(isoDateToBr(e.target.value));
          }}
        />
        <button
          type="button"
          className="gv-date-br-cal"
          disabled={disabled}
          title="Abrir calendário"
          aria-label="Abrir calendário"
          onClick={() => {
            const el = pickerRef.current;
            if (!el) return;
            try {
              el.showPicker();
            } catch {
              el.click();
            }
          }}
        >
          📅
        </button>
      </div>
    </div>
  );
}
