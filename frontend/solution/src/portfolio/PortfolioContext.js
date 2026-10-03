import { createContext } from 'react'

// Holds PortfolioProvider's value: { accountId, selectAccount, status, data, error }. null outside the provider.
export const PortfolioContext = createContext(null)
