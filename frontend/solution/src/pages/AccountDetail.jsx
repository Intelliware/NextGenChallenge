import { useContext, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import HoldingsTable from '../components/HoldingsTable'
import PortfolioValueChart from '../components/PortfolioValueChart'
import SummaryCard from '../components/SummaryCard'
import { PortfolioContext } from '../portfolio/PortfolioContext'

// One account's figures, value history and holdings
export default function AccountDetail() {
  const { accountId } = useParams()
  const { accountId: selectedId, selectAccount, status, data, error } = useContext(PortfolioContext)

  // The URL is the source of truth; sync it into the provider that loads the portfolio
  useEffect(() => {
    selectAccount(accountId)
  }, [accountId, selectAccount])

  const histories = useMemo(() => [data?.performanceHistory ?? []], [data])
  // Until the provider catches up, its data may belong to a previously viewed account
  const isCurrent = selectedId === accountId && status !== 'loading'

  return (
    <>
      <Link to="/" className="back-link">
        ← All accounts
      </Link>
      {!isCurrent && <p>Loading account…</p>}
      {isCurrent && status === 'error' && <p role="alert">{error.message}</p>}
      {isCurrent && status === 'success' && (
        <>
          <h1>{data.portfolio?.label ?? accountId}</h1>
          <section className="overview-panel" aria-label="Account overview">
            <SummaryCard />
            <PortfolioValueChart histories={histories} title="Account value" />
          </section>
          <HoldingsTable />
        </>
      )}
    </>
  )
}
