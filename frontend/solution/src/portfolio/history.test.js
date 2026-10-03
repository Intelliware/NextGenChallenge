import { describe, expect, test } from 'vitest'
import {
  RANGES,
  breakGaps,
  combineHistories,
  filterHistory,
  fromPerformanceHistory,
  fromPriceHistory,
  rangeStart,
} from './history.js'

const at = (date) => new Date(`${date}T12:00:00Z`)
const point = (date, value) => ({ date, value })

describe('rangeStart', () => {
  test('offers the five ranges from the spec', () => {
    expect(RANGES).toEqual(['1D', '1M', 'YTD', '1Y', 'ALL'])
  })

  test('computes each window start', () => {
    const now = at('2026-10-03')
    expect(rangeStart('1D', now)).toBe('2026-10-02')
    expect(rangeStart('1M', now)).toBe('2026-09-03')
    expect(rangeStart('YTD', now)).toBe('2026-01-01')
    expect(rangeStart('1Y', now)).toBe('2025-10-03')
    expect(rangeStart('ALL', now)).toBeNull()
  })

  test('clamps month ends instead of overflowing', () => {
    expect(rangeStart('1M', at('2026-03-31'))).toBe('2026-02-28')
    expect(rangeStart('1M', at('2024-03-31'))).toBe('2024-02-29')
    expect(rangeStart('1M', at('2026-01-15'))).toBe('2025-12-15')
    expect(rangeStart('1Y', at('2024-02-29'))).toBe('2023-02-28')
  })
})

describe('filterHistory', () => {
  const history = [point('2025-06-01', 1), point('2026-01-05', 2), point('2026-10-02', 3), point('2026-10-03', 4)]

  test('keeps only points inside the range', () => {
    expect(filterHistory(history, 'YTD', at('2026-10-03')).map((p) => p.value)).toEqual([2, 3, 4])
    expect(filterHistory(history, '1D', at('2026-10-03')).map((p) => p.value)).toEqual([3, 4])
  })

  test('returns what exists when history is shorter than the range', () => {
    expect(filterHistory([point('2026-10-03', 4)], '1Y', at('2026-10-03'))).toHaveLength(1)
    expect(filterHistory(history, 'ALL')).toBe(history)
    expect(filterHistory(undefined, '1M')).toEqual([])
  })
})

describe('combineHistories', () => {
  test('returns a single history unchanged', () => {
    const one = [point('2026-10-01', 1)]
    expect(combineHistories([one])).toBe(one)
    expect(combineHistories([])).toEqual([])
  })

  test('sums accounts by date, carrying a missing day forward', () => {
    const a = [point('2026-10-01', 100), point('2026-10-02', 110), point('2026-10-03', 120)]
    const b = [point('2026-10-01', 10), point('2026-10-03', 30)]
    expect(combineHistories([a, b])).toEqual([
      point('2026-10-01', 110),
      point('2026-10-02', 120),
      point('2026-10-03', 150),
    ])
  })

  test('skips dates before every account has a value', () => {
    const a = [point('2026-10-01', 100), point('2026-10-02', 110)]
    const b = [point('2026-10-02', 5)]
    expect(combineHistories([a, b])).toEqual([point('2026-10-02', 115)])
  })
})

describe('breakGaps', () => {
  test('leaves short or evenly spaced histories alone', () => {
    const short = [point('2026-10-01', 1), point('2026-10-05', 2)]
    expect(breakGaps(short)).toBe(short)
    const daily = [point('2026-10-01', 1), point('2026-10-02', 2), point('2026-10-03', 3)]
    expect(breakGaps(daily)).toEqual(daily)
  })

  test('inserts a null break where dates jump', () => {
    const gappy = [point('2026-10-01', 1), point('2026-10-02', 2), point('2026-10-03', 3), point('2026-10-10', 4)]
    expect(breakGaps(gappy)).toEqual([
      point('2026-10-01', 1),
      point('2026-10-02', 2),
      point('2026-10-03', 3),
      point('2026-10-04', null),
      point('2026-10-10', 4),
    ])
  })
})

describe('fromPerformanceHistory / fromPriceHistory', () => {
  test('map API series to the generic { date, value } shape', () => {
    expect(fromPerformanceHistory([{ date: '2026-10-03', marketValue: 65680 }])).toEqual([point('2026-10-03', 65680)])
    expect(fromPriceHistory([{ date: '2026-10-03', price: 227.5 }])).toEqual([point('2026-10-03', 227.5)])
  })

  test('treat a missing series as empty', () => {
    expect(fromPerformanceHistory(undefined)).toEqual([])
    expect(fromPriceHistory()).toEqual([])
  })
})
