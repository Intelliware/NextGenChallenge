import { describe, expect, test, vi } from 'vitest'
import { jsonResponse } from '../test/utils'
import { fetchAccounts, fetchExchangeRate, fetchHoldingDetail, fetchPortfolio, withScenario } from './api.js'

describe('withScenario', () => {
  test('returns the path unchanged without mock params', () => {
    expect(withScenario('/accounts', '')).toBe('/accounts')
    expect(withScenario('/accounts', '?other=1')).toBe('/accounts')
  })

  test('forwards scenario, delayMs and fail', () => {
    expect(withScenario('/accounts', '?scenario=large&delayMs=2000&fail=true&x=1')).toBe(
      '/accounts?scenario=large&delayMs=2000&fail=true',
    )
  })

  test('reads the current page URL by default', () => {
    window.history.replaceState(null, '', '/accounts?scenario=empty')
    expect(withScenario('/exchange-rate')).toBe('/exchange-rate?scenario=empty')
  })
})

describe('fetch functions', () => {
  test('call the mock API and return its JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ accountId: 'P-9001' }]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAccounts()).resolves.toEqual([{ accountId: 'P-9001' }])
    await fetchPortfolio('P 9001')
    await fetchExchangeRate()
    await fetchHoldingDetail('BRK.B')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:4000/accounts',
      'http://localhost:4000/portfolios/P%209001',
      'http://localhost:4000/exchange-rate',
      'http://localhost:4000/holdings/BRK.B/detail',
    ])
  })

  test('pass the abort signal through', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    const { signal } = new AbortController()

    await fetchExchangeRate({ signal })

    expect(fetchMock.mock.calls[0][1]).toEqual({ signal })
  })

  test("throw the API's error message on an HTTP error", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Unknown portfolio' }, { status: 404 })))
    await expect(fetchPortfolio('P-0000')).rejects.toThrow('Unknown portfolio')
  })

  test('fall back to a generic message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.reject(new Error('bad')) }))
    await expect(fetchAccounts()).rejects.toThrow('Failed to load accounts (HTTP 503)')
  })
})
