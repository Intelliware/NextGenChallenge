import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const { ticker, name, assetClass, quantity, price, marketValue, weightPercent, unrealizedGainLoss } = holding
  const { dayChangeAmount, dayChangePercent } = holding

  // Holding percentages are decimals (0.0032 => 0.32%), unlike the portfolio's dayChangePercent
  const dayPercent = toPercent(dayChangePercent)
  const dayChange = `${formatSignedMoney(dayChangeAmount)} (${withSign(
    dayPercent,
    formatPercent(dayPercent),
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
      <td className="holdings-table__num">{formatPercent(toPercent(weightPercent))}</td>
      <TrendCell value={isNumber(dayChangeAmount) ? dayChangeAmount : dayPercent}>{dayChange}</TrendCell>
      <TrendCell value={unrealizedGainLoss}>
        {formatSignedMoney(unrealizedGainLoss)}
      </TrendCell>
    </tr>
  )
}
