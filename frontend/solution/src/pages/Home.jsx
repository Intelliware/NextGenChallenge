import AccountTile from '../components/AccountTile'
import OverviewPanel from '../components/OverviewPanel'
import usePortfolios from '../portfolio/usePortfolios'

// Dashboard: combined overview of every account (figures + value chart), then one tile per
// account linking to its detail page. One usePortfolios load feeds both.
export default function Home() {
  // One load feeds both the combined overview and the per-account tiles
  const { status, portfolios, error } = usePortfolios()

  return (
    <>
      <h1>Portfolio Overview</h1>
      <OverviewPanel status={status} portfolios={portfolios} error={error} />
      <section className="account-tiles" aria-label="Accounts">
        <h2>Accounts</h2>
        {status === 'success' && portfolios.length === 0 && <p>No accounts found.</p>}
        <div className="account-tiles__grid">
          {portfolios.map((p) => (
            <AccountTile key={p.accountId} accountId={p.accountId} portfolio={p.portfolio} />
          ))}
        </div>
      </section>
    </>
  )
}
