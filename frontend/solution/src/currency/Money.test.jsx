import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { makeCurrency, renderWithContext } from '../test/utils'
import Money from './Money'

describe('Money', () => {
  test('shows a CAD amount in CAD', () => {
    renderWithContext(<Money amount={65680} />)
    expect(screen.getByText('$65,680.00 CAD')).toBeInTheDocument()
  })

  test('converts to USD when USD is selected', () => {
    renderWithContext(<Money amount={65680} />, { currency: makeCurrency({ currency: 'USD' }) })
    expect(screen.getByText('$47,946.40 USD')).toBeInTheDocument()
  })

  test('signs changes and passes className through', () => {
    renderWithContext(<Money amount={397.25} signed className="change" />)
    expect(screen.getByText('+$397.25 CAD')).toHaveClass('change')
  })

  test('shows Not found for a missing amount', () => {
    renderWithContext(<Money amount={null} />)
    expect(screen.getByText('Not found')).toBeInTheDocument()
  })
})
