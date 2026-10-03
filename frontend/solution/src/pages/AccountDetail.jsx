import { useContext, useEffect, useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import HoldingsTable from '../components/HoldingsTable'
import HistoryChart from '../components/HistoryChart'
import SummaryCard from '../components/SummaryCard'
import { PortfolioContext } from '../portfolio/PortfolioContext'
import { fromPerformanceHistory } from '../portfolio/history'

// One account's figures, value history and holdings, for the account in the URL
// (/accounts/:accountId). Selecting it in PortfolioProvider triggers the load.
export default function AccountDetail() {
  const { accountId } = useParams()
  const { search } = useLocation()
  const { accountId: selectedId, selectAccount, status, data, error } = useContext(PortfolioContext)

  // The URL is the source of truth; sync it into the provider that loads the portfolio
  useEffect(() => {
    selectAccount(accountId)
  }, [accountId, selectAccount])

  const histories = useMemo(() => [fromPerformanceHistory(data?.performanceHistory)], [data])
  // Until the provider catches up, its data may belong to a previously viewed account
  const isCurrent = selectedId === accountId && status !== 'loading'

  return (
    <>
      <Link to={{ pathname: '/', search }} className="back-link">
        ← All accounts
      </Link>
      {!isCurrent && <p>Loading account…</p>}
      {isCurrent && status === 'error' && <p role="alert">{error.message}</p>}
      {isCurrent && status === 'success' && (
        <>
          <h1>{data.portfolio?.label ?? accountId}</h1>
          <section className="overview-panel" aria-label="Account overview">
            <SummaryCard />
            <HistoryChart histories={histories} title="Account value" />
          </section>
          <HoldingsTable />
        </>
      )}
    </>
  )
}
