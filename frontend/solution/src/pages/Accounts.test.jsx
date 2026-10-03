import { fireEvent, screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchAccounts } from '../portfolio/api'
import { makePortfolio, renderWithContext } from '../test/utils'
import Accounts from './Accounts'

vi.mock('../portfolio/api', () => ({ fetchAccounts: vi.fn() }))

const ACCOUNTS = [
  { accountId: 'P-9001', label: 'Taxable Brokerage', totalMarketValue: 65680 },
  { accountId: 'P-9002', label: 'Retirement Account', totalMarketValue: 24465 },
]

// Stand-in dashboard that shows the URL it was reached with
function Dashboard() {
  const { pathname, search } = useLocation()
  return <p>{`Dashboard at ${pathname}${search}`}</p>
}

// Accounts page plus a stand-in dashboard route to check navigation
function renderAccounts(portfolio = makePortfolio({ accountId: null }), route = '/accounts') {
  return renderWithContext(
    <Routes>
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/" element={<Dashboard />} />
    </Routes>,
    { portfolio, route },
  )
}

describe('Accounts page', () => {
  beforeEach(() => {
    fetchAccounts.mockReset()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('shows loading, then one card per account and logs the response', async () => {
    fetchAccounts.mockResolvedValue(ACCOUNTS)
    renderAccounts()

    expect(screen.getByText('Loading accounts…')).toBeInTheDocument()
    expect(await screen.findByText('Taxable Brokerage')).toBeInTheDocument()
    expect(screen.getByText('Retirement Account')).toBeInTheDocument()
    expect(screen.getByText('Select an account to view its dashboard.')).toBeInTheDocument()
    expect(console.log).toHaveBeenCalledWith('GET /accounts response:', ACCOUNTS)
  })

  test('selects an account and goes to the dashboard', async () => {
    fetchAccounts.mockResolvedValue(ACCOUNTS)
    const selectAccount = vi.fn()
    renderAccounts(makePortfolio({ accountId: 'P-9001', selectAccount }))

    await screen.findByText('Retirement Account')
    fireEvent.click(screen.getByRole('button', { name: 'Select account' }))
    expect(selectAccount).toHaveBeenCalledWith('P-9002')

    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }))
    expect(screen.getByText('Dashboard at /')).toBeInTheDocument()
  })

  test('keeps the mock query string when going to the dashboard', async () => {
    fetchAccounts.mockResolvedValue(ACCOUNTS)
    renderAccounts(makePortfolio({ accountId: 'P-9001' }), '/accounts?scenario=empty')

    fireEvent.click(await screen.findByRole('button', { name: 'Go to dashboard' }))
    expect(screen.getByText('Dashboard at /?scenario=empty')).toBeInTheDocument()
  })

  test('shows an empty state', async () => {
    fetchAccounts.mockResolvedValue([])
    renderAccounts()
    expect(await screen.findByText('No accounts found.')).toBeInTheDocument()
  })

  test('shows the error message', async () => {
    fetchAccounts.mockRejectedValue(new Error('Simulated failure'))
    renderAccounts()
    expect(await screen.findByRole('alert')).toHaveTextContent('Simulated failure')
  })
})
