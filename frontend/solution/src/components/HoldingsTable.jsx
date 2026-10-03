import { useContext } from 'react'
import { PortfolioContext } from '../portfolio/PortfolioContext'
import HoldingRow from './HoldingRow'

const COLUMNS = ['Holding', 'Asset class', 'Quantity', 'Price', 'Market value', 'Weight', 'Day change', 'Unrealized gain/loss']

// Every position in the selected account, one HoldingRow each. Reads PortfolioContext and shows
// loading, error and empty states; the table scrolls inside its card on narrow screens.
export default function HoldingsTable() {
  const { status, data, error } = useContext(PortfolioContext) ?? {}

  if (status === 'error') {
    return (
      <section className="holdings" role="alert">
        Could not load holdings: {error?.message ?? 'unknown error'}
      </section>
    )
  }

  if (!data) {
    return <section className="holdings">Loading holdings…</section>
  }

  const holdings = data.holdings ?? []

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
                <HoldingRow key={holding.holdingId ?? holding.ticker} holding={holding} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
