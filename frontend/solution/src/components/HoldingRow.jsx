import useCurrency from '../currency/useCurrency'
import {
  TREND_ICON,
  formatNumber,
  formatPercent,
  isNumber,
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
  const { ticker, name, assetClass, quantity, price, marketValue, weightPercent, gainLoss } = holding
  const { dayChangeAmount, dayChangePercent } = holding

  // Holding weightPercent and dayChangePercent are already percents (2.4 => 2.4%), see PORTFOLIO-API.md
  const dayChange = `${formatSignedMoney(dayChangeAmount)} (${withSign(
    dayChangePercent,
    formatPercent(dayChangePercent),
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
      <td className="holdings-table__num">{formatPercent(weightPercent)}</td>
      <TrendCell value={isNumber(dayChangeAmount) ? dayChangeAmount : dayChangePercent}>{dayChange}</TrendCell>
      <TrendCell value={gainLoss}>{formatSignedMoney(gainLoss)}</TrendCell>
    </tr>
  )
}
