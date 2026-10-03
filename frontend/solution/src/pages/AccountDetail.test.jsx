import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { SAMPLE_PORTFOLIO, makePortfolio, renderWithContext } from '../test/utils'
import AccountDetail from './AccountDetail'

// jsdom has no canvas; the chart has its own tests
vi.mock('../components/HistoryChart', () => ({ default: ({ title }) => <p>{title}</p> }))

// AccountDetail at /accounts/:accountId with the given portfolio context
function renderDetail(portfolio, route = '/accounts/P-9001') {
  return renderWithContext(
    <Routes>
      <Route path="/accounts/:accountId" element={<AccountDetail />} />
    </Routes>,
    { portfolio, route },
  )
}

describe('AccountDetail page', () => {
  test('selects the account from the URL', () => {
    const selectAccount = vi.fn()
    renderDetail(makePortfolio({ accountId: null, status: 'idle', selectAccount }), '/accounts/P-9002')
    expect(selectAccount).toHaveBeenCalledWith('P-9002')
  })

  test("shows the account's summary, value chart and holdings", () => {
    renderDetail(makePortfolio({ data: SAMPLE_PORTFOLIO }))
    expect(screen.getByRole('heading', { level: 1, name: 'Taxable Brokerage' })).toBeInTheDocument()
    expect(screen.getByLabelText('Portfolio summary')).toBeInTheDocument()
    expect(screen.getByText('Account value')).toBeInTheDocument()
    expect(screen.getByLabelText('Holdings')).toBeInTheDocument()
  })

  test('shows loading until the provider has caught up with the URL', () => {
    renderDetail(makePortfolio({ accountId: 'P-9002', data: SAMPLE_PORTFOLIO }))
    expect(screen.getByText('Loading account…')).toBeInTheDocument()
    expect(screen.queryByLabelText('Holdings')).not.toBeInTheDocument()
  })

  test('shows the load error', () => {
    renderDetail(makePortfolio({ status: 'error', error: new Error('Unknown portfolio') }))
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown portfolio')
  })

  test('links back to all accounts, keeping the mock query string', () => {
    renderDetail(makePortfolio({ data: SAMPLE_PORTFOLIO }), '/accounts/P-9001?scenario=empty')
    expect(screen.getByRole('link', { name: '← All accounts' })).toHaveAttribute('href', '/?scenario=empty')
  })
})
