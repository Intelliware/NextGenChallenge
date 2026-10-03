// Single place that turns raw amounts into display strings. Components must not
// format money themselves, so a currency switch applies everywhere at once.

import { NOT_FOUND } from '../portfolio/format.js'

const formatters = new Map()

// Intl formatters are costly to build, so one is cached per currency + sign style
function getFormatter(currency, signDisplay) {
  const key = `${currency}:${signDisplay}`
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency,
        // "$" rather than "CA$"/"US$"; the currency code is appended instead
        currencyDisplay: 'narrowSymbol',
        signDisplay,
      }),
    )
  }
  return formatters.get(key)
}

// Formats an amount already in `currency` and appends the currency code; missing values show NOT_FOUND
function format(amount, currency, signDisplay) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return NOT_FOUND
  return `${getFormatter(currency, signDisplay).format(amount)} ${currency}`
}

// e.g. 65680 -> "$65,680.00 CAD". Amounts that round to zero never show "-$0.00".
export function formatMoney(amount, currency = 'CAD') {
  return format(amount, currency, 'negative')
}

// For changes such as day change or gain/loss: "+$397.25 CAD", "-$410.50 CAD", "$0.00 CAD"
export function formatSignedMoney(amount, currency = 'CAD') {
  return format(amount, currency, 'exceptZero')
}
