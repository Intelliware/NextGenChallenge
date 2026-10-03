import { act, renderHook } from '@testing-library/react'
import { useContext } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SAMPLE_PORTFOLIO } from '../test/utils'
import { fetchPortfolio } from './api'
import { PortfolioContext } from './PortfolioContext'
import PortfolioProvider from './PortfolioProvider'

vi.mock('./api', () => ({ fetchPortfolio: vi.fn() }))

const wrapper = ({ children }) => <PortfolioProvider>{children}</PortfolioProvider>
const usePortfolio = () => useContext(PortfolioContext)

// A promise plus its resolve/reject, to control when a mocked request settles
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

describe('PortfolioProvider', () => {
  beforeEach(() => {
    fetchPortfolio.mockReset()
  })

  test('is idle with no account selected and fetches nothing', () => {
    const { result } = renderHook(usePortfolio, { wrapper })
    expect(result.current).toMatchObject({ accountId: null, status: 'idle', data: null })
    expect(fetchPortfolio).not.toHaveBeenCalled()
  })

  test('loads the selected account', async () => {
    const request = deferred()
    fetchPortfolio.mockReturnValue(request.promise)
    const { result } = renderHook(usePortfolio, { wrapper })

    act(() => result.current.selectAccount('P-9001'))
    expect(result.current.status).toBe('loading')
    expect(fetchPortfolio).toHaveBeenCalledWith('P-9001', expect.objectContaining({ signal: expect.any(AbortSignal) }))

    await act(async () => request.resolve(SAMPLE_PORTFOLIO))
    expect(result.current).toMatchObject({ accountId: 'P-9001', status: 'success', data: SAMPLE_PORTFOLIO })
  })

  test("never shows the previous account's data while switching", async () => {
    const second = deferred()
    fetchPortfolio.mockResolvedValueOnce(SAMPLE_PORTFOLIO).mockReturnValueOnce(second.promise)
    const { result } = renderHook(usePortfolio, { wrapper })
    await act(async () => result.current.selectAccount('P-9001'))

    act(() => result.current.selectAccount('P-9002'))
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  test("reports a failed switch as an error without the old account's data", async () => {
    fetchPortfolio.mockResolvedValueOnce(SAMPLE_PORTFOLIO).mockRejectedValueOnce(new Error('Unknown portfolio'))
    const { result } = renderHook(usePortfolio, { wrapper })
    await act(async () => result.current.selectAccount('P-9001'))
    await act(async () => result.current.selectAccount('P-0000'))

    expect(result.current.status).toBe('error')
    expect(result.current.error.message).toBe('Unknown portfolio')
    expect(result.current.data).toBeNull()
  })

  test('aborts the previous request when the account changes', async () => {
    fetchPortfolio.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(usePortfolio, { wrapper })
    act(() => result.current.selectAccount('P-9001'))
    const firstSignal = fetchPortfolio.mock.calls[0][1].signal

    act(() => result.current.selectAccount('P-9002'))
    expect(firstSignal.aborted).toBe(true)
  })
})
