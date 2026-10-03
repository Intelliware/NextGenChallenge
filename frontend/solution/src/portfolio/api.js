const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

// Forward ?scenario= from the app URL so mock test datasets can be toggled from the browser
function withScenario(path) {
  const scenario = new URLSearchParams(window.location.search).get('scenario')
  return scenario ? `${path}?scenario=${encodeURIComponent(scenario)}` : path
}

export async function fetchPortfolio(accountId, { signal } = {}) {
  const res = await fetch(
    `${API_BASE_URL}${withScenario(`/portfolios/${encodeURIComponent(accountId)}`)}`,
    { signal },
  )

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Failed to load portfolio ${accountId} (HTTP ${res.status})`)
  }

  // { asOf, portfolio, holdings, allocation, performanceHistory }
  return res.json()
}

export async function fetchAccounts({ signal } = {}) {
  const res = await fetch(`${API_BASE_URL}${withScenario('/accounts')}`, { signal })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Failed to load accounts (HTTP ${res.status})`)
  }

  // [{ accountId, label, totalMarketValue }]
  return res.json()
}
