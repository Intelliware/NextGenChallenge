// Display helpers for non-money values (quantities, percentages, trend tone).
// Money is formatted by src/currency (useCurrency / <Money>) so it follows the CAD/USD toggle.

// Shown for any missing value; src/currency/format.js uses it too so money and numbers match
export const NOT_FOUND = 'Not found'

// True only for real, finite numbers (not null, NaN, Infinity or numeric strings)
export const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

// Quantities with thousands separators and up to 4 decimals (8000 => "8,000"); same locale as money
export function formatNumber(value) {
  if (!isNumber(value)) return NOT_FOUND
  return new Intl.NumberFormat('en-CA', { maximumFractionDigits: 4 }).format(value)
}

// `percent` is already in percent units (0.61 => "0.61%"). Values that round to zero show "0.00%", never "-0.00%".
export function formatPercent(percent) {
  if (!isNumber(percent)) return NOT_FOUND
  const rounded = Math.round(percent * 100) / 100
  return `${(rounded === 0 ? 0 : rounded).toFixed(2)}%`
}

// Decimal fractions from the API (0.187 => 18.7); missing stays null
export const toPercent = (fraction) => (isNumber(fraction) ? fraction * 100 : null)

// Prefixes an already formatted value with "+" when the raw value is positive (negatives carry their own "-")
export function withSign(value, formatted) {
  return isNumber(value) && value > 0 ? `+${formatted}` : formatted
}

// Zero and missing values are neutral, never styled positive/negative
export function trend(value) {
  if (!isNumber(value) || value === 0) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}

// Arrow shown next to a value for each trend tone
export const TREND_ICON = { positive: '▲', negative: '▼', neutral: '' }
