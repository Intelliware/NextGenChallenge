import assert from 'node:assert/strict'
import { test } from 'vitest'
import { formatMoney, formatSignedMoney } from './format.js'

test('formatMoney formats CAD by default with separators and code', () => {
  assert.equal(formatMoney(65680), '$65,680.00 CAD')
  assert.equal(formatMoney(1234567890.129), '$1,234,567,890.13 CAD')
})

test('formatMoney supports USD', () => {
  assert.equal(formatMoney(47946.4, 'USD'), '$47,946.40 USD')
})

test('formatMoney never shows a negative zero', () => {
  assert.equal(formatMoney(0), '$0.00 CAD')
  assert.equal(formatMoney(-0.001), '$0.00 CAD')
})

test('formatSignedMoney signs gains and losses and keeps zero neutral', () => {
  assert.equal(formatSignedMoney(397.25), '+$397.25 CAD')
  assert.equal(formatSignedMoney(-410.5), '-$410.50 CAD')
  assert.equal(formatSignedMoney(0), '$0.00 CAD')
  assert.equal(formatSignedMoney(-0.001), '$0.00 CAD')
})

test('missing or non-numeric amounts render as Not found', () => {
  for (const value of [null, undefined, NaN, Infinity, '65680']) {
    assert.equal(formatMoney(value), 'Not found')
    assert.equal(formatSignedMoney(value), 'Not found')
  }
})
