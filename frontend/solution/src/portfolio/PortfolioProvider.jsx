import { useEffect, useState } from 'react'
import { fetchPortfolio } from './api'
import { PortfolioContext } from './PortfolioContext'

// Mounted above the routes so the selected account survives page navigation
export default function PortfolioProvider({ children }) {
  const [accountId, setAccountId] = useState(null)
  // `settledFor` records which accountId the current data/error belongs to
  const [result, setResult] = useState({ settledFor: null, data: null, error: null })

  useEffect(() => {
    if (!accountId) return

    const controller = new AbortController()

    fetchPortfolio(accountId, { signal: controller.signal })
      .then((data) => setResult({ settledFor: accountId, data, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        // Keep previous data so the UI doesn't blank out on a failed switch
        setResult((prev) => ({ ...prev, settledFor: accountId, error }))
      })

    // Abort on account switch/unmount so a stale response can't overwrite the new account
    return () => controller.abort()
  }, [accountId])

  let status = 'idle'
  if (accountId && result.settledFor !== accountId) status = 'loading'
  else if (result.error) status = 'error'
  else if (result.data) status = 'success'

  const value = {
    accountId,
    selectAccount: setAccountId,
    status,
    data: result.data,
    error: result.error,
  }

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}
