import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchExchangeRate } from '../portfolio/api'
import { BASE_CURRENCY, SUPPORTED_CURRENCIES, convertFromCad } from './convert'
import { CurrencyContext } from './CurrencyContext'
import { formatMoney, formatSignedMoney } from './format'
import { RATE_TTL_MS, nextRateState } from './rateCache'

// Owns the display currency and the CAD->USD rate for the whole app. Components call useCurrency()
// to convert and format raw CAD amounts; switching currency re-renders them without refetching.
export default function CurrencyProvider({ children }) {
  // Not persisted: every visit starts in CAD
  const [selectedCurrency, setSelectedCurrency] = useState(BASE_CURRENCY)
  // In-memory cache of the rate: { status, cadToUsd, fetchedAt }
  const [rate, setRate] = useState({ status: 'loading', cadToUsd: null, fetchedAt: null })

  // Fetch the rate once on load, then refresh it every RATE_TTL_MS. Nothing else calls the API.
  useEffect(() => {
    let controller = null

    function refresh() {
      controller?.abort()
      controller = new AbortController()
      fetchExchangeRate({ signal: controller.signal })
        .then((data) =>
          setRate((prev) =>
            nextRateState(prev, { ok: true, cadToUsd: data.CADtoUSD, fetchedAt: Date.now() }),
          ),
        )
        .catch((error) => {
          if (error.name === 'AbortError') return
          console.error('GET /exchange-rate failed:', error)
          setRate((prev) => nextRateState(prev, { ok: false }))
        })
    }

    refresh()
    const interval = setInterval(refresh, RATE_TTL_MS)

    return () => {
      clearInterval(interval)
      controller?.abort()
    }
  }, [])

  const isUsdAvailable = Number.isFinite(rate.cadToUsd)
  // Until a rate has loaded, show CAD everywhere so values are never mixed or mislabelled
  const currency = selectedCurrency === 'USD' && !isUsdAvailable ? BASE_CURRENCY : selectedCurrency

  const setCurrency = useCallback((next) => {
    if (SUPPORTED_CURRENCIES.includes(next)) setSelectedCurrency(next)
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
