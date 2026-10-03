import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { makeCurrency, renderWithContext } from '../test/utils'
import HistoryChart from './HistoryChart'

// jsdom has no canvas, so replace the Chart.js line with a stub that records its props
const lineProps = vi.hoisted(() => ({ current: null }))
vi.mock('react-chartjs-2', () => ({
  Line: (props) => {
    lineProps.current = props
    return <div data-testid="line" />
  },
}))

const today = new Date().toISOString().slice(0, 10)
const history = [
  { date: '2020-01-01', value: 50000 },
  { date: today, value: 65680 },
]

describe('HistoryChart', () => {
  test('plots the history with every range button and ALL selected', () => {
    renderWithContext(<HistoryChart histories={[history]} title="Total value" />)

    expect(screen.getByRole('heading', { name: 'Total value' })).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1D', '1M', 'YTD', '1Y', 'ALL'])
    expect(screen.getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'true')
    expect(lineProps.current.data.datasets[0].data).toEqual([
      { x: '2020-01-01', y: 50000 },
      { x: today, y: 65680 },
    ])
  })

  test('filters to the selected range', () => {
    renderWithContext(<HistoryChart histories={[history]} />)
    fireEvent.click(screen.getByRole('button', { name: '1M' }))

    expect(screen.getByRole('button', { name: '1M' })).toHaveAttribute('aria-pressed', 'true')
    expect(lineProps.current.data.datasets[0].data).toEqual([{ x: today, y: 65680 }])
  })

  test('formats axis ticks and tooltips in the selected currency', () => {
    renderWithContext(<HistoryChart histories={[history]} />, { currency: makeCurrency({ currency: 'USD' }) })
    const { scales, plugins } = lineProps.current.options

    expect(scales.y.ticks.callback(1000)).toBe('$730.00 USD')
    expect(plugins.tooltip.callbacks.label({ parsed: { y: 65680 } })).toBe('$47,946.40 USD')
  })

  test('shows a message when the range has no points', () => {
    renderWithContext(<HistoryChart histories={[]} />)
    expect(screen.getByText('No history available for this range.')).toBeInTheDocument()
  })
})
