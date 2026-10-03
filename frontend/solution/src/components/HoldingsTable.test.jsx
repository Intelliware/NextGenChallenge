import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SAMPLE_PORTFOLIO, makePortfolio, renderWithContext } from '../test/utils'
import HoldingsTable from './HoldingsTable'

describe('HoldingsTable', () => {
  test('renders a header and one row per holding', () => {
    renderWithContext(<HoldingsTable />, { portfolio: makePortfolio({ data: SAMPLE_PORTFOLIO }) })
    expect(screen.getByRole('columnheader', { name: 'Unrealized gain/loss' })).toBeInTheDocument()
    // 1 header row + 2 holdings
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
  })

  test('shows an empty state', () => {
    renderWithContext(<HoldingsTable />, {
      portfolio: makePortfolio({ data: { ...SAMPLE_PORTFOLIO, holdings: [] } }),
    })
    expect(screen.getByText('No holdings')).toBeInTheDocument()
  })

  test('shows loading while there is no data', () => {
    renderWithContext(<HoldingsTable />, { portfolio: makePortfolio({ status: 'loading' }) })
    expect(screen.getByText('Loading holdings…')).toBeInTheDocument()
  })

  test('shows the error instead of an empty table', () => {
    renderWithContext(<HoldingsTable />, {
      portfolio: makePortfolio({ status: 'error', error: new Error('Simulated failure') }),
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load holdings: Simulated failure')
    expect(screen.queryByText('No holdings')).not.toBeInTheDocument()
  })
})
