const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

// Mock API test switches that can be set on the app URL (e.g. /?scenario=large&delayMs=2000&fail=true)
const MOCK_PARAMS = ['scenario', 'delayMs', 'fail']

// Copies the mock test switches from the app URL onto an API path so every request uses the same dataset
export function withScenario(path, search = window.location.search) {
  const appParams = new URLSearchParams(search)
  const apiParams = new URLSearchParams()
  for (const name of MOCK_PARAMS) {
    const value = appParams.get(name)
    if (value !== null) apiParams.set(name, value)
  }
  const query = apiParams.toString()
  return query ? `${path}?${query}` : path
}

// GETs a mock API path and returns its JSON. On an HTTP error it throws with the API's
// `message` when there is one, else `fallbackMessage`. Pass `signal` to allow aborting.
async function getJson(path, fallbackMessage, signal) {
  const res = await fetch(`${API_BASE_URL}${withScenario(path)}`, { signal })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `${fallbackMessage} (HTTP ${res.status})`)
  }

  return res.json()
}

// { asOf, portfolio, holdings, allocation, performanceHistory } for one account
export function fetchPortfolio(accountId, { signal } = {}) {
  return getJson(
    `/portfolios/${encodeURIComponent(accountId)}`,
    `Failed to load portfolio ${accountId}`,
    signal,
  )
}

// [{ accountId, label, totalMarketValue }]
export function fetchAccounts({ signal } = {}) {
  return getJson('/accounts', 'Failed to load accounts', signal)
}

// { CADtoUSD: 0.73 }
export function fetchExchangeRate({ signal } = {}) {
  return getJson('/exchange-rate', 'Failed to load exchange rate', signal)
}

// Security details for one ticker: { ticker, name, sector, assetClass, price, costBasisPerShare,
// purchaseDate, dividendYield, fiftyTwoWeekLow, fiftyTwoWeekHigh, priceHistory: [{ date, price }] }
export function fetchHoldingDetail(ticker, { signal } = {}) {
  return getJson(`/holdings/${encodeURIComponent(ticker)}/detail`, `Failed to load holding ${ticker}`, signal)
}
