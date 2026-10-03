import { useMemo } from 'react'
import PortfolioValueChart from './PortfolioValueChart'
import SummaryCard from './SummaryCard'
import usePortfolios from '../portfolio/usePortfolios'

// Number overview on top, value chart beneath
export default function OverviewPanel() {
  // The value chart covers every account, not just the selected one
  const { status, portfolios, error } = usePortfolios()
  const histories = useMemo(() => portfolios.map((p) => p.performanceHistory ?? []), [portfolios])

  return (
    <section className="overview-panel" aria-label="Portfolio overview">
      <SummaryCard />
      {status === 'loading' && portfolios.length === 0 && <p>Loading portfolio history…</p>}
      {status === 'error' && <p role="alert">{error.message}</p>}
      {portfolios.length > 0 && (
        <PortfolioValueChart histories={histories} title="Total value (all accounts)" />
      )}
    </section>
  )
}
