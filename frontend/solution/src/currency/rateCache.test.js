import assert from 'node:assert/strict'
import { test } from 'vitest'
import { RATE_TTL_MS, nextRateState } from './rateCache.js'

const NOW = Date.UTC(2026, 9, 3, 17, 0, 0)
const LOADING = { status: 'loading', cadToUsd: null, fetchedAt: null }

test('the refresh interval is one hour', () => {
  assert.equal(RATE_TTL_MS, 60 * 60 * 1000)
})

test('the first successful fetch stores the rate', () => {
  assert.deepEqual(nextRateState(LOADING, { ok: true, cadToUsd: 0.73, fetchedAt: NOW }), {
    status: 'success',
    cadToUsd: 0.73,
    fetchedAt: NOW,
  })
})

test('a successful refresh replaces the rate', () => {
  const prev = { status: 'success', cadToUsd: 0.73, fetchedAt: NOW }
  const next = nextRateState(prev, { ok: true, cadToUsd: 0.74, fetchedAt: NOW + RATE_TTL_MS })
  assert.deepEqual(next, { status: 'success', cadToUsd: 0.74, fetchedAt: NOW + RATE_TTL_MS })
})

test('a failed refresh keeps the last good rate', () => {
  const prev = { status: 'success', cadToUsd: 0.73, fetchedAt: NOW }
  assert.equal(nextRateState(prev, { ok: false }), prev)
})

test('a response without a usable rate is treated as a failure', () => {
  const prev = { status: 'success', cadToUsd: 0.73, fetchedAt: NOW }
  assert.equal(nextRateState(prev, { ok: true, cadToUsd: undefined, fetchedAt: NOW }), prev)
  assert.equal(nextRateState(prev, { ok: true, cadToUsd: 0, fetchedAt: NOW }), prev)
  assert.deepEqual(nextRateState(LOADING, { ok: true, cadToUsd: 'x', fetchedAt: NOW }), { ...LOADING, status: 'error' })
})

test('a failure before any rate has loaded marks the rate as unavailable', () => {
  assert.deepEqual(nextRateState(LOADING, { ok: false }), { ...LOADING, status: 'error' })
})
