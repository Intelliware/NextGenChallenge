import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SAMPLE_PORTFOLIO, makeCurrency, makePortfolio, renderWithContext } from '../test/utils'
import SummaryCard from './SummaryCard'

// Renders the card for a portfolio summary merged over the sample one
function renderSummary(portfolioOverrides = {}, options = {}) {
  const data = { ...SAMPLE_PORTFOLIO, portfolio: { ...SAMPLE_PORTFOLIO.portfolio, ...portfolioOverrides } }
  return renderWithContext(<SummaryCard />, { portfolio: makePortfolio({ data }), ...options })
}

// The <dd> value of a stat by its label
const stat = (label) => screen.getByText(label).nextElementSibling

describe('SummaryCard', () => {
  test('shows value, day change and total return for the sample data', () => {
    renderSummary()
    expect(screen.getByRole('heading', { name: 'Taxable Brokerage' })).toBeInTheDocument()
    expect(stat('Total market value')).toHaveTextContent('$65,680.00 CAD')
    expect(stat('Day change')).toHaveTextContent('▲ +$397.25 CAD (+0.61%)')
    expect(stat('Total return since inception')).toHaveTextContent('▲ +18.70%')
  })

  test('converts money to USD but leaves percentages alone', () => {
    renderSummary({}, { currency: makeCurrency({ currency: 'USD' }) })
    expect(stat('Total market value')).toHaveTextContent('$47,946.40 USD')
    expect(stat('Day change')).toHaveTextContent('+$289.99 USD (+0.61%)')
    expect(stat('Total return since inception')).toHaveTextContent('+18.70%')
  })

  test('styles negative and zero day changes', () => {
    const { unmount } = renderSummary({ dayChangeAmount: -120.5, dayChangePercent: -0.18 })
    expect(stat('Day change').parentElement).toHaveClass('summary-card__stat--negative')
    expect(stat('Day change')).toHaveTextContent('▼ -$120.50 CAD (-0.18%)')
    unmount()

    renderSummary({ dayChangeAmount: 0, dayChangePercent: 0 })
    expect(stat('Day change').parentElement).toHaveClass('summary-card__stat--neutral')
    expect(stat('Day change')).toHaveTextContent('$0.00 CAD (0.00%)')
  })

  test('shows Not found for missing fields', () => {
    renderSummary({ label: undefined, totalMarketValue: undefined })
    expect(screen.getByRole('heading')).toHaveTextContent('Not found')
    expect(stat('Total market value')).toHaveTextContent('Not found')
  })

  test('shows loading and error states', () => {
    const { unmount } = renderWithContext(<SummaryCard />, { portfolio: makePortfolio({ status: 'loading' }) })
    expect(screen.getByText('Loading portfolio…')).toBeInTheDocument()
    unmount()

    renderWithContext(<SummaryCard />, {
      portfolio: makePortfolio({ status: 'error', error: new Error('Simulated failure') }),
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load portfolio: Simulated failure')
  })
})
