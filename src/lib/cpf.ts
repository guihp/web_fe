export function normalizeCpf(cpf?: string | null): string {
  if (cpf == null) return '';
  return String(cpf).replace(/\D/g, '');
}

export function maskCpfInput(value: string) {
  const onlyNumbers = normalizeCpf(value).slice(0, 11);
  return onlyNumbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskPhoneInput(value: string) {
  let onlyNumbers = value.replace(/\D/g, '').slice(0, 11);
  if (onlyNumbers.length > 2 && onlyNumbers[2] !== '9') {
    onlyNumbers = `${onlyNumbers.slice(0, 2)}9${onlyNumbers.slice(2)}`;
  }
  return onlyNumbers.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{4})$/, '$1-$2');
}

/** Máscara visual DD/MM/AAAA. */
export function maskDateBrInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Converte YYYY-MM-DD (banco) → DD/MM/AAAA (tela). */
export function isoDateToBr(value: string | null | undefined): string {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Converte DD/MM/AAAA → YYYY-MM-DD, ou null se incompleto/inválido. */
export function brDateToIso(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
