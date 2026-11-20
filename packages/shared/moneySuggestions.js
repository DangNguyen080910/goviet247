// Only the suggested shortcuts are capped. Manual amounts keep the form's rules.
export const MAX_SUGGESTED_AMOUNT = 9_999_999;

export function moneySuggestions(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text) && !/^\d{1,3}(?:\.\d{3})+$/.test(text)) return [];
  const amount = Number(text.replace(/\./g, ''));
  if (!Number.isSafeInteger(amount) || amount <= 0) return [];
  return [1_000, 10_000, 100_000, 1_000_000]
    .map(multiplier => amount * multiplier)
    .filter(suggestion => Number.isSafeInteger(suggestion) && suggestion <= MAX_SUGGESTED_AMOUNT);
}

export function suggestedMoneyLabel(amount) {
  return `${amount.toLocaleString('vi-VN')} đ`;
}
