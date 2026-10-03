import { act, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchExchangeRate } from '../portfolio/api'
import CurrencyProvider from './CurrencyProvider'
import { RATE_TTL_MS } from './rateCache'
import useCurrency from './useCurrency'

vi.mock('../portfolio/api', () => ({ fetchExchangeRate: vi.fn() }))

const wrapper = ({ children }) => <CurrencyProvider>{children}</CurrencyProvider>

// Lets pending promise callbacks (the mocked fetch) run inside act()
const flush = () => act(() => Promise.resolve())

describe('CurrencyProvider + useCurrency', () => {
  beforeEach(() => {
    fetchExchangeRate.mockReset()
  })

  test('starts in CAD with USD unavailable until the rate loads', async () => {
    let resolve
    fetchExchangeRate.mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useCurrency(), { wrapper })

    expect(result.current.currency).toBe('CAD')
    expect(result.current.rateStatus).toBe('loading')
    expect(result.current.isUsdAvailable).toBe(false)

    // Choosing USD before a rate exists still shows CAD
    act(() => result.current.setCurrency('USD'))
    expect(result.current.currency).toBe('CAD')

    await act(async () => resolve({ CADtoUSD: 0.73 }))
    expect(result.current.isUsdAvailable).toBe(true)
    expect(result.current.currency).toBe('USD')
  })

  test('converts and formats raw CAD amounts in the selected currency', async () => {
    fetchExchangeRate.mockResolvedValue({ CADtoUSD: 0.73 })
    const { result } = renderHook(() => useCurrency(), { wrapper })
    await flush()

    expect(result.current.formatMoney(65680)).toBe('$65,680.00 CAD')
    act(() => result.current.setCurrency('USD'))
    expect(result.current.convert(100)).toBeCloseTo(73)
    expect(result.current.formatMoney(65680)).toBe('$47,946.40 USD')
    expect(result.current.formatSignedMoney(-100)).toBe('-$73.00 USD')
  })

  test('ignores unsupported currencies', async () => {
    fetchExchangeRate.mockResolvedValue({ CADtoUSD: 0.73 })
    const { result } = renderHook(() => useCurrency(), { wrapper })
    await flush()

    act(() => result.current.setCurrency('EUR'))
    expect(result.current.currency).toBe('CAD')
  })

  test('marks the rate as an error when the first fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchExchangeRate.mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useCurrency(), { wrapper })
    await flush()

    expect(result.current.rateStatus).toBe('error')
    expect(result.current.isUsdAvailable).toBe(false)
  })

  test('refreshes hourly, keeping the last good rate if a refresh fails', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchExchangeRate.mockResolvedValueOnce({ CADtoUSD: 0.73 }).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useCurrency(), { wrapper })
    await flush()
    const callsAfterLoad = fetchExchangeRate.mock.calls.length

    act(() => result.current.setCurrency('USD'))
    await act(async () => vi.advanceTimersByTime(RATE_TTL_MS))

    expect(fetchExchangeRate.mock.calls.length).toBe(callsAfterLoad + 1)
    expect(result.current.currency).toBe('USD')
    expect(result.current.formatMoney(100)).toBe('$73.00 USD')
  })

  test('toggling does not call the API again', async () => {
    fetchExchangeRate.mockResolvedValue({ CADtoUSD: 0.73 })
    const { result } = renderHook(() => useCurrency(), { wrapper })
    await flush()
    const calls = fetchExchangeRate.mock.calls.length

    act(() => result.current.setCurrency('USD'))
    act(() => result.current.setCurrency('CAD'))
    expect(fetchExchangeRate.mock.calls.length).toBe(calls)
  })

  test('useCurrency throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useCurrency())).toThrow('useCurrency must be used inside <CurrencyProvider>')
  })

  test('renders its children', () => {
    fetchExchangeRate.mockReturnValue(new Promise(() => {}))
    render(<CurrencyProvider>hello</CurrencyProvider>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
