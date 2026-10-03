import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import useCurrency from '../currency/useCurrency'
import {
  TREND_ICON,
  formatNumber,
  formatPercent,
  isNumber,
  trend,
  withSign,
} from '../portfolio/format'

// Numeric cell coloured by the sign of `value` (raw CAD), with a ▲/▼ for gains and losses
function TrendCell({ value, children }) {
  const tone = trend(value)
  return (
    <td className={`holdings-table__num holdings-table__num--${tone}`}>
      {TREND_ICON[tone] && <span aria-hidden="true">{TREND_ICON[tone]} </span>}
      {children}
    </td>
  )
}

// One holdings table row, linking to that holding's detail page (/accounts/:accountId/holdings/:ticker).
// Money columns (price, market value, day change, gain/loss) go through useCurrency so they follow
// the CAD/USD toggle; quantity and percentages are shown as-is.
export default function HoldingRow({ holding }) {
  const { formatMoney, formatSignedMoney } = useCurrency()
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const { ticker, name, assetClass, quantity, price, marketValue, weightPercent, gainLoss } = holding
  const { dayChangeAmount, dayChangePercent } = holding

  // Holding weightPercent and dayChangePercent are already percents (2.4 => 2.4%), see PORTFOLIO-API.md
  const dayChange = `${formatSignedMoney(dayChangeAmount)} (${withSign(
    dayChangePercent,
    formatPercent(dayChangePercent),
  )})`

  // Keep ?scenario= etc. so the detail page loads from the same dataset
  const detailPath = `/accounts/${encodeURIComponent(accountId)}/holdings/${encodeURIComponent(ticker)}${search}`

  // The whole row is clickable for mouse users; the ticker link covers keyboard and screen readers
  return (
    <tr className="holdings-table__row--link" onClick={() => navigate(detailPath)}>
      <th scope="row">
        <Link to={detailPath} className="holdings-table__ticker" onClick={(e) => e.stopPropagation()}>
          {ticker}
        </Link>
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
