import { useContext } from 'react'
import { PortfolioContext } from '../portfolio/PortfolioContext'

const NOT_FOUND = 'Not found'

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

function formatCurrency(value, currency) {
  if (!isNumber(value)) return NOT_FOUND
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency ?? 'CAD' }).format(value)
  } catch {
    // Unknown currency code from the API: still show a legible number
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }
}

// `percent` is already in percent units (0.61 => 0.61%)
function formatPercent(percent) {
  if (!isNumber(percent)) return NOT_FOUND
  return `${percent.toFixed(2)}%`
}

function withSign(value, formatted) {
  return isNumber(value) && value > 0 ? `+${formatted}` : formatted
}

// Zero and missing values are neutral, never styled positive/negative
function trend(value) {
  if (!isNumber(value) || value === 0) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}

const TREND_ICON = { positive: '▲', negative: '▼', neutral: '' }

function Stat({ label, value, tone = 'neutral' }) {
  return (
    <div className={`summary-card__stat summary-card__stat--${tone}`}>
      <dt>{label}</dt>
      <dd>
        {TREND_ICON[tone] && <span aria-hidden="true">{TREND_ICON[tone]} </span>}
        {value}
      </dd>
    </div>
  )
}

export default function SummaryCard() {
  const { status, data } = useContext(PortfolioContext) ?? {}

  if (status === 'loading' && !data) {
    return <section className="summary-card">Loading portfolio…</section>
  }

  const portfolio = data?.portfolio ?? {}
  const { totalMarketValue, dayChangeAmount, dayChangePercent, totalReturnSinceInception, currency } = portfolio

  // Day change shares one tone; prefer amount, fall back to percent if amount is missing
  const dayTone = trend(isNumber(dayChangeAmount) ? dayChangeAmount : dayChangePercent)
  const dayChange = `${withSign(dayChangeAmount, formatCurrency(dayChangeAmount, currency))} (${withSign(
    dayChangePercent,
    formatPercent(dayChangePercent),
  )})`

  // totalReturnSinceInception is a fraction (0.187 => 18.70%)
  const totalReturn = isNumber(totalReturnSinceInception) ? totalReturnSinceInception * 100 : null

  return (
    <section className="summary-card" aria-label="Portfolio summary">
      <h2 className="summary-card__title">{portfolio.label ?? NOT_FOUND}</h2>
      <dl className="summary-card__stats">
        <Stat label="Total market value" value={formatCurrency(totalMarketValue, currency)} />
        <Stat label="Day change" value={dayChange} tone={dayTone} />
        <Stat
          label="Total return since inception"
          value={withSign(totalReturn, formatPercent(totalReturn))}
          tone={trend(totalReturn)}
        />
      </dl>
    </section>
  )
}
