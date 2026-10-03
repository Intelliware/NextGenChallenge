import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchHoldingDetail } from '../portfolio/api'
import { SAMPLE_PORTFOLIO, makeCurrency, makePortfolio, renderWithContext } from '../test/utils'
import HoldingDetail from './HoldingDetail'

vi.mock('../portfolio/api', () => ({ fetchHoldingDetail: vi.fn() }))
// jsdom has no canvas; the chart has its own tests
vi.mock('../components/HistoryChart', () => ({
  default: ({ title, histories }) => <p>{`${title}: ${histories[0].length} points`}</p>,
}))

// Shape of GET /holdings/AAPL/detail
const AAPL_DETAIL = {
  ticker: 'AAPL',
  name: 'Apple Inc.',
  sector: 'Technology',
  assetClass: 'Equity',
  price: 227.5,
  costBasisPerShare: 200,
  purchaseDate: '2022-03-14',
  dividendYield: 0.005,
  fiftyTwoWeekLow: 164.1,
  fiftyTwoWeekHigh: 232.4,
  priceHistory: [
    { date: '2026-10-02', price: 225 },
    { date: '2026-10-03', price: 227.5 },
  ],
}

// HoldingDetail at /accounts/:accountId/holdings/:ticker
function renderDetail({ route = '/accounts/P-9001/holdings/AAPL', ...options } = {}) {
  return renderWithContext(
    <Routes>
      <Route path="/accounts/:accountId/holdings/:ticker" element={<HoldingDetail />} />
    </Routes>,
    { portfolio: makePortfolio({ data: SAMPLE_PORTFOLIO }), route, ...options },
  )
}

// The <dd> value of a stat by its label
const stat = (label) => screen.getByText(label, { selector: 'dt' }).nextElementSibling

describe('HoldingDetail page', () => {
  beforeEach(() => {
    fetchHoldingDetail.mockReset()
    fetchHoldingDetail.mockResolvedValue(AAPL_DETAIL)
  })

  test('loads the security and selects the account from the URL', async () => {
    const selectAccount = vi.fn()
    renderDetail({ portfolio: makePortfolio({ data: SAMPLE_PORTFOLIO, selectAccount }) })

    expect(screen.getByText('Loading AAPL…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('AAPLApple Inc.')
    expect(selectAccount).toHaveBeenCalledWith('P-9001')
    expect(fetchHoldingDetail).toHaveBeenCalledWith('AAPL', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  test("shows the account's position with cost, gain and return", async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1 })

    expect(stat('Shares')).toHaveTextContent('120')
    expect(stat('Cost basis / share')).toHaveTextContent('$200.00 CAD')
    expect(stat('Total cost')).toHaveTextContent('$24,000.00 CAD')
    // gainLoss from the portfolio row; 3,300 / 24,000 = 13.75%
    expect(stat('Unrealized gain/loss')).toHaveTextContent('+$3,300.00 CAD (13.75%)')
    expect(stat('Purchased')).toHaveTextContent('Mar 14, 2022')
  })

  test('shows security details and price history', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1 })

    expect(stat('Sector')).toHaveTextContent('Technology')
    expect(stat('Dividend yield')).toHaveTextContent('0.50%')
    expect(stat('52-week high')).toHaveTextContent('$232.40 CAD')
    expect(screen.getByRole('img', { name: 'Current price $227.50 CAD' })).toBeInTheDocument()
    expect(screen.getByText('Price history: 2 points')).toBeInTheDocument()
  })

  test('converts money to USD', async () => {
    renderDetail({ currency: makeCurrency({ currency: 'USD' }) })
    await screen.findByRole('heading', { level: 1 })
    expect(stat('Cost basis / share')).toHaveTextContent('$146.00 USD')
  })

  test('handles a security with no dividend or optional fields', async () => {
    fetchHoldingDetail.mockResolvedValue({ ...AAPL_DETAIL, dividendYield: null, sector: null, purchaseDate: null })
    renderDetail()
    await screen.findByRole('heading', { level: 1 })

    expect(stat('Dividend yield')).toHaveTextContent('None')
    expect(stat('Sector')).toHaveTextContent('Not found')
    expect(stat('Purchased')).toHaveTextContent('Not found')
  })

  test("says when the account doesn't hold the ticker", async () => {
    fetchHoldingDetail.mockResolvedValue({ ...AAPL_DETAIL, ticker: 'MSFT' })
    renderDetail({ route: '/accounts/P-9001/holdings/MSFT' })
    expect(await screen.findByText("This account doesn't hold MSFT.")).toBeInTheDocument()
  })

  test('shows the load error and a back link that keeps the query string', async () => {
    fetchHoldingDetail.mockRejectedValue(new Error('Unknown ticker'))
    renderDetail({ route: '/accounts/P-9001/holdings/AAPL?scenario=large' })

    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown ticker')
    expect(screen.getByRole('link', { name: /Back to Taxable Brokerage/ })).toHaveAttribute(
      'href',
      '/accounts/P-9001?scenario=large',
    )
  })
})
