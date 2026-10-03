import { screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import usePortfolios from '../portfolio/usePortfolios'
import { SAMPLE_PORTFOLIO, makePortfolio, renderWithContext } from '../test/utils'
import Home from './Home'

vi.mock('../portfolio/usePortfolios', () => ({ default: vi.fn() }))
// The chart has its own tests; stub it so Home doesn't need a canvas
vi.mock('../components/PortfolioValueChart', () => ({
  default: ({ title, histories }) => <p>{`${title}: ${histories.length} accounts`}</p>,
}))

// Stand-in accounts page that shows the URL it was reached with
function PickAccount() {
  const { search } = useLocation()
  return <p>{`Pick an account${search}`}</p>
}

// Home plus a stand-in accounts route to check the redirect
function renderHome(portfolio, route = '/') {
  return renderWithContext(
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/accounts" element={<PickAccount />} />
    </Routes>,
    { portfolio, route },
  )
}

describe('Home page', () => {
  beforeEach(() => {
    usePortfolios.mockReturnValue({ status: 'success', portfolios: [SAMPLE_PORTFOLIO], error: null })
  })

  test('redirects to the accounts page without a selected account', () => {
    renderHome(makePortfolio({ accountId: null }))
    expect(screen.getByText('Pick an account')).toBeInTheDocument()
  })

  test('keeps the mock query string on the redirect', () => {
    renderHome(makePortfolio({ accountId: null }), '/?scenario=empty')
    expect(screen.getByText('Pick an account?scenario=empty')).toBeInTheDocument()
  })

  test('shows the summary, value chart and holdings for the selected account', () => {
    renderHome(makePortfolio({ data: SAMPLE_PORTFOLIO }))
    expect(screen.getByRole('heading', { name: 'Portfolio Overview' })).toBeInTheDocument()
    expect(screen.getByLabelText('Portfolio summary')).toBeInTheDocument()
    expect(screen.getByText('Total value (all accounts): 1 accounts')).toBeInTheDocument()
    expect(screen.getByLabelText('Holdings')).toBeInTheDocument()
  })

  test('shows the history loading and error states', () => {
    usePortfolios.mockReturnValue({ status: 'loading', portfolios: [], error: null })
    const { unmount } = renderHome(makePortfolio({ data: SAMPLE_PORTFOLIO }))
    expect(screen.getByText('Loading portfolio history…')).toBeInTheDocument()
    unmount()

    usePortfolios.mockReturnValue({ status: 'error', portfolios: [], error: new Error('History failed') })
    renderHome(makePortfolio({ data: SAMPLE_PORTFOLIO }))
    expect(screen.getByRole('alert')).toHaveTextContent('History failed')
  })
})
