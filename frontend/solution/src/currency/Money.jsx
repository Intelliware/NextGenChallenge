import useCurrency from './useCurrency'

// Renders a raw CAD amount in the selected currency. Use `signed` for changes (day change, gain/loss).
export default function Money({ amount, signed = false, className }) {
  const { formatMoney, formatSignedMoney } = useCurrency()
  return <span className={className}>{signed ? formatSignedMoney(amount) : formatMoney(amount)}</span>
}
