import { useMemo } from 'react'
import HistoryChart from './HistoryChart'
import { fromPerformanceHistory } from '../portfolio/history'
import SummaryCard from './SummaryCard'
import { isNumber } from '../portfolio/format'

const sum = (values) => {
  const numbers = values.filter(isNumber)
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) : null
}

// Combined figures across every account (raw CAD, like the API)
function combineSummaries(portfolios) {
  const totalMarketValue = sum(portfolios.map((p) => p.portfolio?.totalMarketValue))
  const dayChangeAmount = sum(portfolios.map((p) => p.portfolio?.dayChangeAmount))
  // Percent of yesterday's close: today's value minus today's change
  const previous = totalMarketValue - dayChangeAmount
  const dayChangePercent =
    isNumber(totalMarketValue) && isNumber(dayChangeAmount) && previous !== 0
      ? (dayChangeAmount / previous) * 100
      : null

  return { label: 'All accounts', totalMarketValue, dayChangeAmount, dayChangePercent }
}

// Number overview on top, value chart beneath, for all accounts combined
export default function OverviewPanel({ status, portfolios, error }) {
  const histories = useMemo(() => portfolios.map((p) => fromPerformanceHistory(p.performanceHistory)), [portfolios])
  const summary = useMemo(() => combineSummaries(portfolios), [portfolios])
  const isLoading = status === 'loading' && portfolios.length === 0

  return (
    <section className="overview-panel" aria-label="Portfolio overview">
      <SummaryCard summary={summary} loading={isLoading} showTotalReturn={false} />
      {status === 'error' && <p role="alert">{error.message}</p>}
      {portfolios.length > 0 && (
        <HistoryChart histories={histories} title="Total value (all accounts)" />
      )}
    </section>
  )
}
