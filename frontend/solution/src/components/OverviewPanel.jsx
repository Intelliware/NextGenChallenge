import { useMemo } from 'react'
import HistoryChart from './HistoryChart'
import { fromPerformanceHistory } from '../portfolio/history'
import SummaryCard from './SummaryCard'
import { isNumber } from '../portfolio/format'

// Sum of the numeric values, skipping missing ones; null when there are none
const sum = (values) => {
  const numbers = values.filter(isNumber)
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) : null
}

// Combined figures across every account (raw CAD, like the API)
function combineSummaries(portfolios) {
  const totalMarketValue = sum(portfolios.map((p) => p.portfolio?.totalMarketValue))
  const dayChangeAmount = sum(portfolios.map((p) => p.portfolio?.dayChangeAmount))
  // Percent of yesterday's close: today's value minus today's change. No change is 0% even when
  // the close was 0 (e.g. empty accounts); otherwise a zero close has no meaningful percent.
  const previous = totalMarketValue - dayChangeAmount
  let dayChangePercent = null
  if (dayChangeAmount === 0) dayChangePercent = 0
  else if (isNumber(totalMarketValue) && isNumber(dayChangeAmount) && previous !== 0) {
    dayChangePercent = (dayChangeAmount / previous) * 100
  }

  return { label: 'All accounts', totalMarketValue, dayChangeAmount, dayChangePercent }
}

// Number overview on top, value chart beneath, for all accounts combined. Takes usePortfolios()'s
// { status, portfolios, error }; with nothing loaded and an error, only the error is shown.
export default function OverviewPanel({ status, portfolios, error }) {
  const histories = useMemo(() => portfolios.map((p) => fromPerformanceHistory(p.performanceHistory)), [portfolios])
  const summary = useMemo(() => combineSummaries(portfolios), [portfolios])
  const isLoading = status === 'loading' && portfolios.length === 0
  const hasNothingToShow = status === 'error' && portfolios.length === 0

  return (
    <section className="overview-panel" aria-label="Portfolio overview">
      {!hasNothingToShow && <SummaryCard summary={summary} loading={isLoading} showTotalReturn={false} />}
      {status === 'error' && <p role="alert">{error.message}</p>}
      {portfolios.length > 0 && (
        <HistoryChart histories={histories} title="Total value (all accounts)" />
      )}
    </section>
  )
}
