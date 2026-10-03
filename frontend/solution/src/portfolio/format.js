export const NOT_FOUND = 'Not found'

export const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

export function formatCurrency(value, currency) {
  if (!isNumber(value)) return NOT_FOUND
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency ?? 'CAD' }).format(value)
  } catch {
    // Unknown currency code from the API: still show a legible number
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }
}

export function formatNumber(value) {
  if (!isNumber(value)) return NOT_FOUND
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value)
}

// `percent` is already in percent units (0.61 => 0.61%)
export function formatPercent(percent) {
  if (!isNumber(percent)) return NOT_FOUND
  return `${percent.toFixed(2)}%`
}

// Decimal fractions from the API (0.187 => 18.7); missing stays null
export const toPercent = (fraction) => (isNumber(fraction) ? fraction * 100 : null)

export function withSign(value, formatted) {
  return isNumber(value) && value > 0 ? `+${formatted}` : formatted
}

// Zero and missing values are neutral, never styled positive/negative
export function trend(value) {
  if (!isNumber(value) || value === 0) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}

export const TREND_ICON = { positive: '▲', negative: '▼', neutral: '' }
