import { useContext, useMemo } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import HoldingsTable from '../components/HoldingsTable'
import PortfolioValueChart from '../components/PortfolioValueChart'
import SummaryCard from '../components/SummaryCard'
import { PortfolioContext } from '../portfolio/PortfolioContext'
import usePortfolios from '../portfolio/usePortfolios'

// Dashboard for the selected account: summary card, value chart and holdings table.
// Redirects to /accounts until an account is selected.
export default function Home() {
  const { accountId } = useContext(PortfolioContext)
  const { search } = useLocation()
  // The value chart covers every account, not just the selected one
  const { status, portfolios, error } = usePortfolios()
  const histories = useMemo(() => portfolios.map((p) => p.performanceHistory ?? []), [portfolios])

  // The dashboard needs an account: send the user to pick one first (keeping any mock ?scenario=)
  if (!accountId) return <Navigate to={{ pathname: '/accounts', search }} replace />

  return (
    <>
      <h1>Portfolio Overview</h1>
      <SummaryCard />
      {status === 'loading' && portfolios.length === 0 && <p>Loading portfolio history…</p>}
      {status === 'error' && <p role="alert">{error.message}</p>}
      {portfolios.length > 0 && (
        <PortfolioValueChart
          histories={histories}
          title="Total value (all accounts)"
        />
      )}
      <HoldingsTable />
    </>
  )
}
