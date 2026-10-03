import { fireEvent, screen, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { SAMPLE_PORTFOLIO, makeCurrency, renderWithContext } from '../test/utils'
import HoldingRow from './HoldingRow'

const [aapl, bnd] = SAMPLE_PORTFOLIO.holdings

// Stand-in holding page that shows the URL it was reached with
function HoldingPage() {
  const { pathname, search } = useLocation()
  return <p>{`Holding page ${pathname}${search}`}</p>
}

// HoldingRow renders a <tr>, which must sit inside a table, on an account page (for :accountId)
function renderRow(holding, { route = '/accounts/P-9001', ...options } = {}) {
  renderWithContext(
    <Routes>
      <Route
        path="/accounts/:accountId"
        element={
          <table>
            <tbody>
              <HoldingRow holding={holding} />
            </tbody>
          </table>
        }
      />
      <Route path="/accounts/:accountId/holdings/:ticker" element={<HoldingPage />} />
    </Routes>,
    { route, ...options },
  )
  return screen.getByRole('row')
}

// Text of each cell in the row, in column order
const cellTexts = (row) => [...row.children].map((cell) => cell.textContent)

describe('HoldingRow', () => {
  test('shows every column, with percents as sent by the API', () => {
    expect(cellTexts(renderRow(aapl))).toEqual([
      'AAPLApple Inc.',
      'Equity',
      '120',
      '$227.50 CAD',
      '$27,300.00 CAD',
      '41.57%',
      '▲ +$639.60 CAD (+2.40%)',
      '▲ +$3,300.00 CAD',
    ])
  })

  test('links the ticker to its holding page, keeping the mock query string', () => {
    const row = renderRow(aapl, { route: '/accounts/P-9001?scenario=large' })
    expect(within(row).getByRole('link', { name: 'AAPL' })).toHaveAttribute(
      'href',
      '/accounts/P-9001/holdings/AAPL?scenario=large',
    )
  })

  test('opens the holding page when the row is clicked', () => {
    fireEvent.click(within(renderRow(aapl)).getByText('Equity'))
    expect(screen.getByText('Holding page /accounts/P-9001/holdings/AAPL')).toBeInTheDocument()
  })

  test('styles losses as negative', () => {
    const cells = within(renderRow(bnd)).getAllByRole('cell')
    expect(cells.at(-1)).toHaveTextContent('▼ -$570.00 CAD')
    expect(cells.at(-1)).toHaveClass('holdings-table__num--negative')
  })

  test('converts money columns but not quantity or percents', () => {
    const texts = cellTexts(renderRow(aapl, { currency: makeCurrency({ currency: 'USD' }) }))
    expect(texts.slice(2)).toEqual([
      '120',
      '$166.08 USD',
      '$19,929.00 USD',
      '41.57%',
      '▲ +$466.91 USD (+2.40%)',
      '▲ +$2,409.00 USD',
    ])
  })

  test('shows Not found for missing fields and keeps them neutral', () => {
    const cells = within(renderRow({ ticker: 'CASH', name: 'Cash' })).getAllByRole('cell')
    expect(cells.at(-1)).toHaveTextContent('Not found')
    expect(cells.at(-1)).toHaveClass('holdings-table__num--neutral')
    expect(cells[2]).toHaveTextContent('Not found')
  })
})
