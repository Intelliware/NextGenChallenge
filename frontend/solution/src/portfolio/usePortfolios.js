import { useEffect, useState } from 'react'
import { fetchAccounts, fetchPortfolio } from './api'

// Loads several portfolios at once, independent of the selected account in PortfolioProvider.
// Omit `accountIds` to load every account.
export default function usePortfolios(accountIds) {
  // Join so a new array with the same ids doesn't refetch
  const idsKey = accountIds?.join(',') ?? null
  const [result, setResult] = useState({ settledFor: undefined, portfolios: [], error: null })

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const ids = idsKey !== null
      ? Promise.resolve(idsKey ? idsKey.split(',') : [])
      : fetchAccounts({ signal }).then((accounts) => accounts.map((a) => a.accountId))

    ids
      .then((list) => Promise.all(list.map((id) =>
        // Tag each response with its id so callers can link back to the account
        fetchPortfolio(id, { signal }).then((data) => ({ accountId: id, ...data })),
      )))
      .then((portfolios) => setResult({ settledFor: idsKey, portfolios, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setResult((prev) => ({ ...prev, settledFor: idsKey, error }))
      })

    return () => controller.abort()
  }, [idsKey])

  let status = 'success'
  if (result.settledFor !== idsKey) status = 'loading'
  else if (result.error) status = 'error'

  return { status, portfolios: result.portfolios, error: result.error }
}
