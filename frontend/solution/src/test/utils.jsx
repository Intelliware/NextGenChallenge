// Test helpers: render components with fake currency/portfolio contexts and a memory router,
// so component tests don't need the real providers or the mock API.
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { convertFromCad } from '../currency/convert'
import { CurrencyContext } from '../currency/CurrencyContext'
import { formatMoney, formatSignedMoney } from '../currency/format'
import { PortfolioContext } from '../portfolio/PortfolioContext'

// A currency context value shaped like CurrencyProvider's, for a fixed currency and rate
export function makeCurrency({ currency = 'CAD', cadToUsd = 0.73, rateStatus = 'success', setCurrency = vi.fn() } = {}) {
  const convert = (amount) => convertFromCad(amount, currency, cadToUsd)
  return {
    currency,
    setCurrency,
    rateStatus,
    isUsdAvailable: Number.isFinite(cadToUsd),
    convert,
    formatMoney: (amount) => formatMoney(convert(amount), currency),
    formatSignedMoney: (amount) => formatSignedMoney(convert(amount), currency),
  }
}

// A portfolio context value shaped like PortfolioProvider's
export function makePortfolio(overrides = {}) {
  return { accountId: 'P-9001', selectAccount: vi.fn(), status: 'success', data: null, error: null, ...overrides }
}

// Renders `ui` inside both contexts and a router at `route`
export function renderWithContext(ui, { currency = makeCurrency(), portfolio = makePortfolio(), route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CurrencyContext.Provider value={currency}>
        <PortfolioContext.Provider value={portfolio}>{ui}</PortfolioContext.Provider>
      </CurrencyContext.Provider>
    </MemoryRouter>,
  )
}

// Sample /portfolios/P-9001 response (subset of the mock's default dataset)
export const SAMPLE_PORTFOLIO = {
  asOf: '2026-10-03T17:00:00Z',
  portfolio: {
    portfolioId: 'P-9001',
    accountId: 'P-9001',
    label: 'Taxable Brokerage',
    currency: 'CAD',
    totalMarketValue: 65680,
    dayChangeAmount: 397.25,
    dayChangePercent: 0.61,
    totalReturnSinceInception: 0.187,
  },
  holdings: [
    {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      assetClass: 'Equity',
      quantity: 120,
      price: 227.5,
      marketValue: 27300,
      gainLoss: 3300,
      dayChangeAmount: 639.6,
      dayChangePercent: 2.4,
      weightPercent: 41.57,
    },
    {
      ticker: 'BND',
      name: 'Vanguard Total Bond ETF',
      assetClass: 'Fixed Income',
      quantity: 300,
      price: 72.1,
      marketValue: 21630,
      gainLoss: -570,
      dayChangeAmount: -132,
      dayChangePercent: -0.61,
      weightPercent: 32.93,
    },
  ],
  allocation: [],
  performanceHistory: [
    { date: '2026-10-01', marketValue: 65000 },
    { date: '2026-10-02', marketValue: 65283.75 },
    { date: '2026-10-03', marketValue: 65680 },
  ],
}

// A fetch Response-like object for stubbing global fetch
export function jsonResponse(body, { status = 200 } = {}) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }
}
