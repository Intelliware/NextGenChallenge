import { useEffect, useMemo, useState } from 'react'
import { fetchPortfolio } from './api'
import { PortfolioContext } from './PortfolioContext'

// Holds the selected account and loads its portfolio. Mounted above the routes so the
// selection survives page navigation. Exposes { accountId, selectAccount, status, data, error }.
export default function PortfolioProvider({ children }) {
  const [accountId, setAccountId] = useState(null)
  // `settledFor` is the account the last request finished for; `dataFor` is the account `data` belongs to
  const [result, setResult] = useState({ settledFor: null, dataFor: null, data: null, error: null })

  useEffect(() => {
    if (!accountId) return

    const controller = new AbortController()

    fetchPortfolio(accountId, { signal: controller.signal })
      .then((data) => setResult({ settledFor: accountId, dataFor: accountId, data, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setResult((prev) => ({ ...prev, settledFor: accountId, error }))
      })

    // Abort on account switch/unmount so a stale response can't overwrite the new account
    return () => controller.abort()
  }, [accountId])

  // Never expose another account's data: while switching (or after a failed switch) data is null
  const data = result.dataFor === accountId ? result.data : null

  let status = 'idle'
  if (accountId && result.settledFor !== accountId) status = 'loading'
  else if (result.error) status = 'error'
  else if (data) status = 'success'

  const value = useMemo(
    () => ({ accountId, selectAccount: setAccountId, status, data, error: result.error }),
    [accountId, status, data, result.error],
  )

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}
