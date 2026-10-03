import useCurrency from '../currency/useCurrency'
import {
  TREND_ICON,
  formatNumber,
  formatPercent,
  isNumber,
  toPercent,
  trend,
  withSign,
} from '../portfolio/format'

function TrendCell({ value, children }) {
  const tone = trend(value)
  return (
    <td className={`holdings-table__num holdings-table__num--${tone}`}>
      {TREND_ICON[tone] && <span aria-hidden="true">{TREND_ICON[tone]} </span>}
      {children}
    </td>
  )
}

export default function HoldingRow({ holding }) {
  const { formatMoney, formatSignedMoney } = useCurrency()
  const { ticker, name, assetClass, quantity, price, marketValue, weightPercent, unrealizedGainLoss } = holding
  const { dayChangeAmount, dayChangePercent } = holding

  // Holding percentages are decimals (0.0032 => 0.32%), unlike the portfolio's dayChangePercent
  const dayPercent = toPercent(dayChangePercent)
  const dayChange = `${formatSignedMoney(dayChangeAmount)} (${withSign(
    dayPercent,
    formatPercent(dayPercent),
  )})`

  return (
    <tr>
      <th scope="row">
        <span className="holdings-table__ticker">{ticker}</span>
        <span className="holdings-table__name">{name}</span>
      </th>
      <td>{assetClass}</td>
      <td className="holdings-table__num">{formatNumber(quantity)}</td>
      <td className="holdings-table__num">{formatMoney(price)}</td>
      <td className="holdings-table__num">{formatMoney(marketValue)}</td>
      <td className="holdings-table__num">{formatPercent(toPercent(weightPercent))}</td>
      <TrendCell value={isNumber(dayChangeAmount) ? dayChangeAmount : dayPercent}>{dayChange}</TrendCell>
      <TrendCell value={unrealizedGainLoss}>
        {formatSignedMoney(unrealizedGainLoss)}
      </TrendCell>
    </tr>
  )
}
