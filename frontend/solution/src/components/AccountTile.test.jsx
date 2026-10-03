import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SAMPLE_PORTFOLIO, makeCurrency, renderWithContext } from '../test/utils'
import AccountTile from './AccountTile'

const { portfolio } = SAMPLE_PORTFOLIO

describe('AccountTile', () => {
  test('shows label, value and day change, linking to the account', () => {
    renderWithContext(<AccountTile accountId="P-9001" portfolio={portfolio} />)
    const link = screen.getByRole('link')

    expect(link).toHaveAttribute('href', '/accounts/P-9001')
    expect(link).toHaveTextContent('Taxable Brokerage')
    expect(link).toHaveTextContent('$65,680.00 CAD')
    expect(link).toHaveTextContent('▲ +$397.25 CAD today')
  })

  test('converts money to USD', () => {
    renderWithContext(<AccountTile accountId="P-9001" portfolio={portfolio} />, {
      currency: makeCurrency({ currency: 'USD' }),
    })
    expect(screen.getByRole('link')).toHaveTextContent('$47,946.40 USD')
  })

  test('keeps the mock query string and encodes the id', () => {
    renderWithContext(<AccountTile accountId="P 9001" portfolio={portfolio} />, { route: '/?scenario=large' })
    expect(screen.getByRole('link')).toHaveAttribute('href', '/accounts/P%209001?scenario=large')
  })

  test('shows Not found for missing fields and a neutral change', () => {
    const { container } = renderWithContext(<AccountTile accountId="P-9001" />)
    expect(screen.getByRole('link')).toHaveTextContent('Not found')
    expect(container.querySelector('.account-tile__change--neutral')).toBeInTheDocument()
  })
})
