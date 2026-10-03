export const BASE_CURRENCY = 'CAD'
export const SUPPORTED_CURRENCIES = ['CAD', 'USD']

// All API amounts are CAD. Convert at display time only and never round here:
// rounding happens once, in formatting, so sums and converted totals stay consistent.
// Sum raw CAD values first, then convert the total.
export function convertFromCad(amount, currency, cadToUsd) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return amount
  if (currency === 'CAD') return amount
  if (currency === 'USD' && Number.isFinite(cadToUsd)) return amount * cadToUsd
  throw new Error(`Cannot convert CAD to ${currency} without an exchange rate`)
}
