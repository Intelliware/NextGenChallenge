import { useContext } from 'react'
import useCurrency from '../currency/useCurrency'
import { PortfolioContext } from '../portfolio/PortfolioContext'
import {
  NOT_FOUND,
  TREND_ICON,
  formatPercent,
  isNumber,
  toPercent,
  trend,
  withSign,
} from '../portfolio/format'

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
  const { formatMoney, formatSignedMoney } = useCurrency()

  if (status === 'loading' && !data) {
    return <section className="summary-card">Loading portfolio…</section>
  }

  const portfolio = data?.portfolio ?? {}
  // Money fields are CAD from the API; useCurrency converts them to the selected currency
  const { totalMarketValue, dayChangeAmount, dayChangePercent, totalReturnSinceInception } = portfolio

  // Day change shares one tone; prefer amount, fall back to percent if amount is missing
  const dayTone = trend(isNumber(dayChangeAmount) ? dayChangeAmount : dayChangePercent)
  const dayChange = `${formatSignedMoney(dayChangeAmount)} (${withSign(
    dayChangePercent,
    formatPercent(dayChangePercent),
  )})`

  // totalReturnSinceInception is a fraction (0.187 => 18.70%)
  const totalReturn = toPercent(totalReturnSinceInception)

  return (
    <section className="summary-card" aria-label="Portfolio summary">
      <h2 className="summary-card__title">{portfolio.label ?? NOT_FOUND}</h2>
      <dl className="summary-card__stats">
        <Stat label="Total market value" value={formatMoney(totalMarketValue)} />
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
