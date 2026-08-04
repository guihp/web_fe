export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
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
