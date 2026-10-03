import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SAMPLE_PORTFOLIO, makeCurrency, renderWithContext } from '../test/utils'
import OverviewPanel from './OverviewPanel'

// jsdom has no canvas; the chart has its own tests
vi.mock('./HistoryChart', () => ({
  default: ({ title, histories }) => <p>{`${title}: ${histories.length} histories`}</p>,
}))

// Two accounts: 65,680 (+397.25 today) and 24,465 (+185.27 today)
const PORTFOLIOS = [
  SAMPLE_PORTFOLIO,
  { ...SAMPLE_PORTFOLIO, portfolio: { ...SAMPLE_PORTFOLIO.portfolio, totalMarketValue: 24465, dayChangeAmount: 185.27 } },
]

// The <dd> value of a stat by its label
const stat = (label) => screen.getByText(label).nextElementSibling

describe('OverviewPanel', () => {
  test('sums every account into one summary without total return', () => {
    renderWithContext(<OverviewPanel status="success" portfolios={PORTFOLIOS} error={null} />)

    expect(screen.getByRole('heading', { name: 'All accounts' })).toBeInTheDocument()
    expect(stat('Total market value')).toHaveTextContent('$90,145.00 CAD')
    // 582.52 / (90,145 - 582.52) = 0.65% of yesterday's close
    expect(stat('Day change')).toHaveTextContent('+$582.52 CAD (+0.65%)')
    expect(screen.queryByText('Total return since inception')).not.toBeInTheDocument()
    expect(screen.getByText('Total value (all accounts): 2 histories')).toBeInTheDocument()
  })

  test('converts the combined total to USD', () => {
    renderWithContext(<OverviewPanel status="success" portfolios={PORTFOLIOS} error={null} />, {
      currency: makeCurrency({ currency: 'USD' }),
    })
    expect(stat('Total market value')).toHaveTextContent('$65,805.85 USD')
  })

  test('shows 0.00% rather than Not found for empty accounts', () => {
    const empty = { ...SAMPLE_PORTFOLIO, portfolio: { ...SAMPLE_PORTFOLIO.portfolio, totalMarketValue: 0, dayChangeAmount: 0 } }
    renderWithContext(<OverviewPanel status="success" portfolios={[empty, empty]} error={null} />)
    expect(stat('Day change')).toHaveTextContent('$0.00 CAD (0.00%)')
  })

  test('shows loading before anything has loaded', () => {
    renderWithContext(<OverviewPanel status="loading" portfolios={[]} error={null} />)
    expect(screen.getByText('Loading portfolio…')).toBeInTheDocument()
  })

  test('shows only the error when nothing loaded', () => {
    renderWithContext(<OverviewPanel status="error" portfolios={[]} error={new Error('Simulated failure')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Simulated failure')
    expect(screen.queryByText('Total market value')).not.toBeInTheDocument()
  })
})
