import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { makeCurrency, renderWithContext } from '../test/utils'
import AccountCard from './AccountCard'

const account = { accountId: 'P-9001', label: 'Taxable Brokerage', totalMarketValue: 65680 }

describe('AccountCard', () => {
  test('starts collapsed and expands to show the details', () => {
    renderWithContext(<AccountCard account={account} isSelected={false} onSelect={vi.fn()} />)
    const header = screen.getByRole('button', { name: /Taxable Brokerage/ })

    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('P-9001')).not.toBeInTheDocument()

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('P-9001')).toBeInTheDocument()
    expect(screen.getByText('$65,680.00 CAD')).toBeInTheDocument()
  })

  test('shows the market value in the selected currency', () => {
    renderWithContext(<AccountCard account={account} isSelected={false} onSelect={vi.fn()} />, {
      currency: makeCurrency({ currency: 'USD' }),
    })
    fireEvent.click(screen.getByRole('button', { name: /Taxable Brokerage/ }))
    expect(screen.getByText('$47,946.40 USD')).toBeInTheDocument()
  })

  test('selects the account', () => {
    const onSelect = vi.fn()
    renderWithContext(<AccountCard account={account} isSelected={false} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select account' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  test('marks the selected account', () => {
    const { container } = renderWithContext(<AccountCard account={account} isSelected onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Selected' })).toBeDisabled()
    expect(container.querySelector('.account-card--selected')).toBeInTheDocument()
  })
})
