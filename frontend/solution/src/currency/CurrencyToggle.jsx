import useCurrency from './useCurrency'
import { SUPPORTED_CURRENCIES } from './convert'

// Floating CAD/USD switch. Render once (in Layout); it is pinned bottom-right on every page.
export default function CurrencyToggle() {
  const { currency, setCurrency, isUsdAvailable, rateStatus } = useCurrency()

  let note = null
  if (rateStatus === 'loading') note = 'Loading exchange rate…'
  else if (rateStatus === 'error') note = 'USD unavailable: exchange rate failed to load'

  return (
    <div className="currency-toggle" role="group" aria-label={`Display currency: ${currency}`}>
      {SUPPORTED_CURRENCIES.map((code) => {
        const disabled = code === 'USD' && !isUsdAvailable
        return (
          <button
            key={code}
            type="button"
            aria-pressed={currency === code}
            disabled={disabled}
            title={disabled ? note : `Show amounts in ${code}`}
            onClick={() => setCurrency(code)}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}
