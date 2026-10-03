import { describe, expect, test } from 'vitest'
import {
  NOT_FOUND,
  TREND_ICON,
  formatNumber,
  formatPercent,
  isNumber,
  toPercent,
  trend,
  withSign,
} from './format.js'

describe('isNumber', () => {
  test('accepts finite numbers only', () => {
    expect(isNumber(0)).toBe(true)
    expect(isNumber(-1.5)).toBe(true)
    for (const value of [null, undefined, NaN, Infinity, '5']) expect(isNumber(value)).toBe(false)
  })
})

describe('formatNumber', () => {
  test('adds thousands separators and keeps up to 4 decimals', () => {
    expect(formatNumber(8000)).toBe('8,000')
    expect(formatNumber(1.234567)).toBe('1.2346')
  })

  test('shows Not found for missing values', () => {
    expect(formatNumber(null)).toBe(NOT_FOUND)
    expect(NOT_FOUND).toBe('Not found')
  })
})

describe('formatPercent', () => {
  test('formats percent units with two decimals', () => {
    expect(formatPercent(0.61)).toBe('0.61%')
    expect(formatPercent(41.57)).toBe('41.57%')
    expect(formatPercent(-4.1)).toBe('-4.10%')
  })

  test('never shows a negative zero', () => {
    expect(formatPercent(-0.001)).toBe('0.00%')
    expect(formatPercent(0)).toBe('0.00%')
  })

  test('shows Not found for missing values', () => {
    expect(formatPercent(undefined)).toBe('Not found')
  })
})

describe('toPercent', () => {
  test('turns a fraction into percent units', () => {
    expect(toPercent(0.187)).toBeCloseTo(18.7)
  })

  test('keeps missing values as null', () => {
    expect(toPercent(null)).toBeNull()
  })
})

describe('withSign', () => {
  test('prefixes + only for positive values', () => {
    expect(withSign(2.4, '2.40%')).toBe('+2.40%')
    expect(withSign(-2.4, '-2.40%')).toBe('-2.40%')
    expect(withSign(0, '0.00%')).toBe('0.00%')
    expect(withSign(null, 'Not found')).toBe('Not found')
  })
})

describe('trend', () => {
  test('classifies positive, negative and neutral values', () => {
    expect(trend(1)).toBe('positive')
    expect(trend(-1)).toBe('negative')
    expect(trend(0)).toBe('neutral')
    expect(trend(null)).toBe('neutral')
  })

  test('has an icon for every tone', () => {
    expect(TREND_ICON).toEqual({ positive: '▲', negative: '▼', neutral: '' })
  })
})
