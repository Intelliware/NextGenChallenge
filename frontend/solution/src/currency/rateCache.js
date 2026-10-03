// The CAD->USD rate is kept in memory and refreshed on this interval.
// Toggling currency or formatting values never calls the API.
export const RATE_TTL_MS = 60 * 60 * 1000

// After a refresh attempt: a new rate replaces the old one; a failed refresh keeps the last good rate
export function nextRateState(prev, result) {
  if (result.ok) {
    return { status: 'success', cadToUsd: result.cadToUsd, fetchedAt: result.fetchedAt }
  }
  return Number.isFinite(prev.cadToUsd) ? prev : { ...prev, status: 'error' }
}
