import assert from 'node:assert/strict'
import { test } from 'vitest'
import { convertFromCad } from './convert.js'
import { formatMoney } from './format.js'

test('CAD amounts pass through unchanged', () => {
  assert.equal(convertFromCad(65680, 'CAD', 0.73), 65680)
  assert.equal(convertFromCad(65680, 'CAD', undefined), 65680)
})

test('USD amounts use the CADtoUSD rate', () => {
  assert.equal(formatMoney(convertFromCad(65680, 'USD', 0.73), 'USD'), '$47,946.40 USD')
  assert.equal(formatMoney(convertFromCad(24465, 'USD', 0.73), 'USD'), '$17,859.45 USD')
})

test('missing amounts are passed through so formatting can show Not found', () => {
  assert.equal(convertFromCad(null, 'USD', 0.73), null)
  assert.equal(formatMoney(convertFromCad(undefined, 'USD', 0.73), 'USD'), 'Not found')
})

test('converting to USD without a rate throws rather than showing CAD as USD', () => {
  assert.throws(() => convertFromCad(100, 'USD', undefined))
  assert.throws(() => convertFromCad(100, 'EUR', 0.73))
})

test('converting a CAD total matches the sum of converted parts once formatted', () => {
  const parts = [27300.0, 21630.0, 16750.0]
  const totalCad = parts.reduce((sum, value) => sum + value, 0)
  const convertedSum = parts.reduce((sum, value) => sum + convertFromCad(value, 'USD', 0.73), 0)
  assert.equal(
    formatMoney(convertFromCad(totalCad, 'USD', 0.73), 'USD'),
    formatMoney(convertedSum, 'USD'),
  )
})
