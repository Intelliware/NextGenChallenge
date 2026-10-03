import { useContext, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchAccounts } from '../portfolio/api'
import AccountCard from '../components/AccountCard'
import { PortfolioContext } from '../portfolio/PortfolioContext'

// Lists every account (GET /accounts) as AccountCards and lets the user pick one for the
// dashboard. Logs the API response, and shows loading, error and empty states.
export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const { accountId: selectedAccountId, selectAccount } = useContext(PortfolioContext)
  const navigate = useNavigate()
  // Kept when going to the dashboard so a mock ?scenario= stays applied
  const { search } = useLocation()

  useEffect(() => {
    const controller = new AbortController()

    fetchAccounts({ signal: controller.signal })
      .then((data) => {
        console.log('GET /accounts response:', data)
        setAccounts(data)
        setIsLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error('GET /accounts failed:', err)
        setError(err.message)
        setIsLoading(false)
      })

    // Abort on unmount so a late response can't update an unmounted page
    return () => controller.abort()
  }, [])

  return (
    <>
      <h1>Accounts</h1>
      {!selectedAccountId && !isLoading && !error && accounts.length > 0 && (
        <p>Select an account to view its dashboard.</p>
      )}
      {isLoading && <p>Loading accounts…</p>}
      {error && <p role="alert">{error}</p>}
      {!isLoading && !error && accounts.length === 0 && <p>No accounts found.</p>}
      {accounts.map((account) => (
        <AccountCard
          key={account.accountId}
          account={account}
          isSelected={account.accountId === selectedAccountId}
          onSelect={() => selectAccount(account.accountId)}
        />
      ))}
      {selectedAccountId && (
        <button type="button" className="go-to-dashboard" onClick={() => navigate({ pathname: '/', search })}>
          Go to dashboard
        </button>
      )}
    </>
  )
}
