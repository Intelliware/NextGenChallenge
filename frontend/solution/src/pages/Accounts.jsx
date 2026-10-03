import { useEffect, useState } from 'react'
import { fetchAccounts } from '../portfolio/api'
import AccountCard from '../components/AccountCard'

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

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
      {isLoading && <p>Loading accounts…</p>}
      {error && <p role="alert">{error}</p>}
      {!isLoading && !error && accounts.length === 0 && <p>No accounts found.</p>}
      {accounts.map((account) => (
        <AccountCard key={account.accountId} account={account} />
      ))}
    </>
  )
}
