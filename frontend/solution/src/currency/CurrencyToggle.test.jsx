import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { makeCurrency, renderWithContext } from '../test/utils'
import CurrencyToggle from './CurrencyToggle'

describe('CurrencyToggle', () => {
  test('marks the current currency as pressed', () => {
    renderWithContext(<CurrencyToggle />, { currency: makeCurrency({ currency: 'USD' }) })
    expect(screen.getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'CAD' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Display currency: USD')
  })

  test('selects a currency on click', () => {
    const setCurrency = vi.fn()
    renderWithContext(<CurrencyToggle />, { currency: makeCurrency({ setCurrency }) })
    fireEvent.click(screen.getByRole('button', { name: 'USD' }))
    expect(setCurrency).toHaveBeenCalledWith('USD')
  })

  test('disables USD with an explanation while the rate is loading or failed', () => {
    const { unmount } = renderWithContext(<CurrencyToggle />, {
      currency: makeCurrency({ cadToUsd: null, rateStatus: 'loading' }),
    })
    expect(screen.getByRole('button', { name: 'USD' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'USD' })).toHaveAttribute('title', 'Loading exchange rate…')
    unmount()

    renderWithContext(<CurrencyToggle />, { currency: makeCurrency({ cadToUsd: null, rateStatus: 'error' }) })
    expect(screen.getByRole('button', { name: 'USD' })).toHaveAttribute(
      'title',
      'USD unavailable: exchange rate failed to load',
    )
  })
})
