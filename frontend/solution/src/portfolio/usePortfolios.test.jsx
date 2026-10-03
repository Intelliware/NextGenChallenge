import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchAccounts, fetchPortfolio } from './api'
import usePortfolios from './usePortfolios'

vi.mock('./api', () => ({ fetchAccounts: vi.fn(), fetchPortfolio: vi.fn() }))

describe('usePortfolios', () => {
  beforeEach(() => {
    fetchAccounts.mockReset()
    fetchPortfolio.mockReset()
    fetchPortfolio.mockImplementation((id) => Promise.resolve({ portfolio: { accountId: id } }))
  })

  test('loads every account when no ids are given', async () => {
    fetchAccounts.mockResolvedValue([{ accountId: 'P-9001' }, { accountId: 'P-9002' }])
    const { result } = renderHook(() => usePortfolios())

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.portfolios.map((p) => p.portfolio.accountId)).toEqual(['P-9001', 'P-9002'])
    // Each response is tagged with the id it was loaded for
    expect(result.current.portfolios.map((p) => p.accountId)).toEqual(['P-9001', 'P-9002'])
  })

  test('loads only the given ids without fetching the account list', async () => {
    const { result } = renderHook(() => usePortfolios(['P-9002']))
    await waitFor(() => expect(result.current.status).toBe('success'))

    expect(fetchAccounts).not.toHaveBeenCalled()
    expect(result.current.portfolios).toHaveLength(1)
  })

  test('does not refetch for a new array with the same ids', async () => {
    const { result, rerender } = renderHook(({ ids }) => usePortfolios(ids), { initialProps: { ids: ['P-9001'] } })
    await waitFor(() => expect(result.current.status).toBe('success'))

    rerender({ ids: ['P-9001'] })
    expect(fetchPortfolio).toHaveBeenCalledTimes(1)
  })

  test('reports an error', async () => {
    fetchAccounts.mockRejectedValue(new Error('Simulated failure'))
    const { result } = renderHook(() => usePortfolios())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.message).toBe('Simulated failure')
  })
})
