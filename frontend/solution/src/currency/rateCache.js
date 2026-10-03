// The CAD->USD rate is kept in memory and refreshed on this interval.
// Toggling currency or formatting values never calls the API.
export const RATE_TTL_MS = 60 * 60 * 1000

// Next rate state after a refresh attempt. A valid new rate replaces the old one; a failed refresh,
// or a response without a usable number, keeps the last good rate (or marks it 'error' if there is none).
export function nextRateState(prev, result) {
  if (result.ok && Number.isFinite(result.cadToUsd) && result.cadToUsd > 0) {
    return { status: 'success', cadToUsd: result.cadToUsd, fetchedAt: result.fetchedAt }
  }
  return Number.isFinite(prev.cadToUsd) ? prev : { ...prev, status: 'error' }
}
