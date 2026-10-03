import { useContext } from 'react'
import { PortfolioContext } from '../portfolio/PortfolioContext'
import HoldingRow from './HoldingRow'

const COLUMNS = ['Holding', 'Asset class', 'Quantity', 'Price', 'Market value', 'Weight', 'Day change', 'Unrealized gain/loss']

export default function HoldingsTable() {
  const { status, data } = useContext(PortfolioContext) ?? {}

  if (status === 'loading' && !data) {
    return <section className="holdings">Loading holdings…</section>
  }

  const holdings = data?.holdings ?? []
  const currency = data?.portfolio?.currency

  return (
    <section className="holdings" aria-label="Holdings">
      <h2 className="holdings__title">Holdings</h2>
      <div className="holdings__scroll">
        <table className="holdings-table">
          <thead>
            <tr>
              {COLUMNS.map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="holdings-table__empty">
                  No holdings
                </td>
              </tr>
            ) : (
              holdings.map((holding) => (
                <HoldingRow key={holding.holdingId ?? holding.ticker} holding={holding} currency={currency} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
