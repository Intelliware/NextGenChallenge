import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchExchangeRate } from '../portfolio/api'
import { BASE_CURRENCY, SUPPORTED_CURRENCIES, convertFromCad } from './convert'
import { CurrencyContext } from './CurrencyContext'
import { formatMoney, formatSignedMoney } from './format'

const STORAGE_KEY = 'preferredCurrency'

function readStoredCurrency() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return SUPPORTED_CURRENCIES.includes(stored) ? stored : BASE_CURRENCY
  } catch {
    return BASE_CURRENCY
  }
}

export default function CurrencyProvider({ children }) {
  const [selectedCurrency, setSelectedCurrency] = useState(readStoredCurrency)
  const [rate, setRate] = useState({ status: 'loading', cadToUsd: null })

  useEffect(() => {
    const controller = new AbortController()

    fetchExchangeRate({ signal: controller.signal })
      .then((data) => setRate({ status: 'success', cadToUsd: data.CADtoUSD }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        console.error('GET /exchange-rate failed:', error)
        setRate({ status: 'error', cadToUsd: null })
      })

    return () => controller.abort()
  }, [])

  const isUsdAvailable = rate.status === 'success' && Number.isFinite(rate.cadToUsd)
  // Until a rate is available, show CAD everywhere so values are never mixed or mislabelled
  const currency = selectedCurrency === 'USD' && !isUsdAvailable ? BASE_CURRENCY : selectedCurrency

  const setCurrency = useCallback((next) => {
    if (!SUPPORTED_CURRENCIES.includes(next)) return
    setSelectedCurrency(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this session
    }
  }, [])

  const value = useMemo(() => {
    const convert = (cadAmount) => convertFromCad(cadAmount, currency, rate.cadToUsd)
    return {
      currency,
      setCurrency,
      rateStatus: rate.status,
      isUsdAvailable,
      convert,
      formatMoney: (cadAmount) => formatMoney(convert(cadAmount), currency),
      formatSignedMoney: (cadAmount) => formatSignedMoney(convert(cadAmount), currency),
    }
  }, [currency, setCurrency, rate, isUsdAvailable])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}
