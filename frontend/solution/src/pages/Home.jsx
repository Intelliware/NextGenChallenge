import { useContext, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import HoldingsTable from '../components/HoldingsTable'
import PortfolioValueChart from '../components/PortfolioValueChart'
import SummaryCard from '../components/SummaryCard'
import { PortfolioContext } from '../portfolio/PortfolioContext'
import usePortfolios from '../portfolio/usePortfolios'

export default function Home() {
  const { accountId } = useContext(PortfolioContext)
  // The value chart covers every account, not just the selected one
  const { status, portfolios, error } = usePortfolios()
  const histories = useMemo(() => portfolios.map((p) => p.performanceHistory ?? []), [portfolios])

  // The dashboard needs an account: send the user to pick one first
  if (!accountId) return <Navigate to="/accounts" replace />

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
