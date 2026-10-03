import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SAMPLE_PORTFOLIO, makeCurrency, renderWithContext } from '../test/utils'
import HoldingRow from './HoldingRow'

const [aapl, bnd] = SAMPLE_PORTFOLIO.holdings

// HoldingRow renders a <tr>, which must sit inside a table
function renderRow(holding, options) {
  renderWithContext(
    <table>
      <tbody>
        <HoldingRow holding={holding} />
      </tbody>
    </table>,
    options,
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
