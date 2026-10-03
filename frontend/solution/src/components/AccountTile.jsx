import { Link, useLocation } from 'react-router-dom'
import Money from '../currency/Money'
import { NOT_FOUND, TREND_ICON, trend } from '../portfolio/format'

// One account on the dashboard: label, market value and today's change (money follows the
// CAD/USD toggle). Links to that account's detail view, keeping any mock ?scenario= in the URL.
export default function AccountTile({ accountId, portfolio = {} }) {
  const { search } = useLocation()
  const tone = trend(portfolio.dayChangeAmount)

  return (
    <Link to={{ pathname: `/accounts/${encodeURIComponent(accountId)}`, search }} className="account-tile">
      <span className="account-tile__label">{portfolio.label ?? NOT_FOUND}</span>
      <Money amount={portfolio.totalMarketValue} className="account-tile__value" />
      <span className={`account-tile__change account-tile__change--${tone}`}>
        {TREND_ICON[tone] && <span aria-hidden="true">{TREND_ICON[tone]} </span>}
        <Money amount={portfolio.dayChangeAmount} signed /> today
      </span>
    </Link>
  )
}
