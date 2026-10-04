import { useContext } from 'react'
import { CurrencyContext } from './CurrencyContext'

// { currency, setCurrency, rateStatus, isUsdAvailable, convert, formatMoney, formatSignedMoney }
// Amounts passed to convert/formatMoney/formatSignedMoney are always raw CAD values from the API.
export default function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used inside <CurrencyProvider>')
  }
  return context
}
