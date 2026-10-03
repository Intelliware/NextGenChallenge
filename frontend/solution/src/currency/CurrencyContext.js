import { createContext } from 'react'

// Holds CurrencyProvider's value; read it through useCurrency(), not directly. null outside the provider.
export const CurrencyContext = createContext(null)
