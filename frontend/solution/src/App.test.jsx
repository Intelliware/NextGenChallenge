import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import App from './App'
import CurrencyProvider from './currency/CurrencyProvider'

vi.mock('./portfolio/api', () => ({
  fetchAccounts: vi.fn().mockResolvedValue([]),
  fetchPortfolio: vi.fn(),
  fetchExchangeRate: vi.fn().mockResolvedValue({ CADtoUSD: 0.73 }),
}))

// The real app (both providers, routes and layout) starting at `route`
function renderApp(route) {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </MemoryRouter>,
  )
}

describe('App', () => {
  test('sends the dashboard to the accounts page until an account is selected', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
  })

  test('renders the accounts page inside the layout', async () => {
    renderApp('/accounts')
    expect(await screen.findByText('No accounts found.')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('Portfolio Dashboard')
    expect(screen.getByRole('button', { name: 'CAD' })).toHaveAttribute('aria-pressed', 'true')
  })
})
