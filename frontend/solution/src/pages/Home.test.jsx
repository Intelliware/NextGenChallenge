import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import usePortfolios from '../portfolio/usePortfolios'
import { SAMPLE_PORTFOLIO, renderWithContext } from '../test/utils'
import Home from './Home'

vi.mock('../portfolio/usePortfolios', () => ({ default: vi.fn() }))
// The chart has its own tests; stub it so Home doesn't need a canvas
vi.mock('../components/HistoryChart', () => ({
  default: ({ title, histories }) => <p>{`${title}: ${histories.length} accounts`}</p>,
}))

const RETIREMENT = {
  ...SAMPLE_PORTFOLIO,
  accountId: 'P-9002',
  portfolio: { ...SAMPLE_PORTFOLIO.portfolio, accountId: 'P-9002', label: 'Retirement Account', totalMarketValue: 24465 },
}
const PORTFOLIOS = [{ accountId: 'P-9001', ...SAMPLE_PORTFOLIO }, RETIREMENT]

describe('Home page', () => {
  beforeEach(() => {
    usePortfolios.mockReturnValue({ status: 'success', portfolios: PORTFOLIOS, error: null })
  })

  test('shows the combined overview and one tile per account', () => {
    renderWithContext(<Home />)
    expect(screen.getByRole('heading', { name: 'Portfolio Overview' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All accounts' })).toBeInTheDocument()
    expect(screen.getByText('Total value (all accounts): 2 accounts')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Taxable Brokerage/ })).toHaveAttribute('href', '/accounts/P-9001')
    expect(screen.getByRole('link', { name: /Retirement Account/ })).toHaveAttribute('href', '/accounts/P-9002')
  })

  test('shows an empty state with no accounts', () => {
    usePortfolios.mockReturnValue({ status: 'success', portfolios: [], error: null })
    renderWithContext(<Home />)
    expect(screen.getByText('No accounts found.')).toBeInTheDocument()
  })

  test('shows loading and error states', () => {
    usePortfolios.mockReturnValue({ status: 'loading', portfolios: [], error: null })
    const { unmount } = renderWithContext(<Home />)
    expect(screen.getByText('Loading portfolio…')).toBeInTheDocument()
    expect(screen.queryByText('No accounts found.')).not.toBeInTheDocument()
    unmount()

    usePortfolios.mockReturnValue({ status: 'error', portfolios: [], error: new Error('Simulated failure') })
    renderWithContext(<Home />)
    expect(screen.getByRole('alert')).toHaveTextContent('Simulated failure')
  })
})
