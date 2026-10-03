import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import App from './App'
import CurrencyProvider from './currency/CurrencyProvider'

// vi.mock is hoisted above imports, so the sample data is loaded inside the factory
vi.mock('./portfolio/api', async () => {
  const { SAMPLE_PORTFOLIO } = await import('./test/utils')
  return {
    fetchAccounts: vi.fn().mockResolvedValue([{ accountId: 'P-9001' }]),
    fetchPortfolio: vi.fn().mockResolvedValue(SAMPLE_PORTFOLIO),
    fetchExchangeRate: vi.fn().mockResolvedValue({ CADtoUSD: 0.73 }),
  }
})
// jsdom has no canvas; the chart has its own tests
vi.mock('./components/HistoryChart', () => ({ default: ({ title }) => <p>{title}</p> }))

// The real app (both providers, routes and layout) starting at `route`
function renderApp(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </MemoryRouter>,
  )
}

describe('App', () => {
  test('shows the dashboard inside the layout at /', async () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Portfolio Overview' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Taxable Brokerage/ })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('Portfolio Dashboard')
    expect(screen.getByRole('button', { name: 'CAD' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('redirects the old /accounts route to the dashboard', () => {
    renderApp('/accounts')
    expect(screen.getByRole('heading', { name: 'Portfolio Overview' })).toBeInTheDocument()
  })

  test('shows an account at /accounts/:accountId', async () => {
    renderApp('/accounts/P-9001')
    expect(await screen.findByRole('heading', { level: 1, name: 'Taxable Brokerage' })).toBeInTheDocument()
    expect(screen.getByLabelText('Holdings')).toBeInTheDocument()
  })
})
