# Portfolio Dashboard Backend (Python / FastAPI)

Status: **Task 1 (Portfolio Metadata via CRM Integration)**, **Task 2 (Holdings)**, **Task 3 (Performance History)**, **Task 4 (Auth Middleware)** and **Task 5 (Asset Allocation)** are complete. Other tasks are not started yet. The code is structured for Task 9 (caching) to slot in; see "Extending" below.

Working on this as a team? Read [TEAM-GUIDE.md](TEAM-GUIDE.md) first. It covers the pinned stack, who owns which files, coding conventions, and the decisions we need to agree on.

## Install and run

Requires Python 3.11+ and Node 24+ (for the supplied mock CRM). From the repo root:

```sh
# 1. Generate the sample performance history (dates end today; see Task 3 below)
node backend/fixtures/generate-history.mjs

# 2. Start the supplied mock CRM (port 4002)
node backend/mock-crm.mjs

# 3. In another terminal, set up and start the backend (port 3000)
cd backend/solution
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --port 3000 --reload
```

Every endpoint except the health checks needs the mock token (see Task 4 below). Try it:

```sh
curl -H 'Authorization: Bearer superday-demo-token' localhost:3000/portfolios/P-9001
curl -H 'Authorization: Bearer superday-demo-token' 'localhost:3000/portfolios/P-9001/performance-history?range=1M'
curl -H 'Authorization: Bearer superday-demo-token' localhost:3000/portfolios/P-9001/allocation
```

Or open the interactive docs at <http://localhost:3000/docs>, press **Authorize**, and enter `superday-demo-token`.

Configuration comes from environment variables (or a `.env` file; see [.env.example](.env.example)):

| Variable | Default | Meaning |
| --- | --- | --- |
| `CRM_BASE_URL` | `http://localhost:4002` | Where the CRM lives |
| `CRM_TIMEOUT_SECONDS` | `3` | Per-attempt timeout for a CRM call |
| `CRM_MAX_RETRIES` | `1` | Extra attempts for transient failures (0 disables) |
| `CRM_RETRY_BACKOFF_SECONDS` | `0.2` | Pause before a retry |
| `CRM_TOTAL_BUDGET_SECONDS` | `5` | Hard cap on total time spent on the CRM per request |
| `LOG_LEVEL` | `INFO` | Log verbosity |
| `HISTORY_FILE` | `backend/fixtures/performance-history.json` | Generated daily history (Task 3) |
| `SEED_FILE` | `backend/fixtures/seed.json` | Seed data; Task 3 reads its portfolio list |
| `API_TOKEN` | `superday-demo-token` | The one valid bearer token (Task 4) |

## Run the tests

```sh
cd backend/solution
source .venv/bin/activate
pytest                    # everything; live mock-CRM tests auto-skip if the mock isn't running
pytest -m "not integration"   # offline only
pytest -m integration         # only the live tests (start node backend/mock-crm.mjs first)
```

| File | What it covers |
| --- | --- |
| `tests/test_mapper.py` | The pure mapper against every fixture, plus number parsing, timestamps, currency, account selection. A meta-test fails if a fixture is added without an expectation. |
| `tests/test_crm_client.py` | Timeout, retry, and status-code classification (respx), plus **real sockets** proving the timeout is enforced and refused connections are handled. |
| `tests/test_portfolios_api.py` | HTTP layer: every status code and error body, request ids, id validation, no detail leaks on 500, health/readiness, OpenAPI. |
| `tests/test_end_to_end_fake_crm.py` | Full stack (route, real HTTP client, mapper) against the scenario fake CRM for every fixture and forced status. |
| `tests/test_integration_mock_crm.py` | Live against the supplied mock: all modes, call counts, and 10 requests in `auto` mode without a crash or hang. |
| `tests/test_holdings.py` | Holdings calculations without HTTP (P-9001 values, zero quantity, zero previous close, empty portfolio) and the endpoint (all 12 camelCase fields, JSON `null`, `[]`, 404). |
| `tests/test_history.py` | Task 3, with today pinned and made-up data (no generated file needed): every range's window, month-end and leap-year clamping, gaps, future dates, short history, range parsing, file loading, and the HTTP layer (400/404/503, empty portfolio, OpenAPI). |
| `tests/test_allocation.py` | Task 5: summing several holdings in one class and the zero-total guard without HTTP (made-up holdings), and the endpoint (P-9001 values and order in camelCase, single class at exactly `1.0`, `[]`, 404). |
| `tests/test_api_docs.py` | The interactive docs: Swagger UI settings, no misleading 422s, and error examples that match real responses. |
| `tests/test_auth.py` | Task 4: the header check (missing, malformed, wrong token, lowercase scheme, non-ASCII), rejection before any route logic runs, a sweep proving every non-public operation needs the token, exact public paths, the token coming from settings and never being logged, and the docs' Authorize button and 401 examples. |

## `GET /portfolios/{id}`

Successful response (`200`):

```json
{
  "portfolioId": "P-9001",
  "clientId": "abc123",
  "label": "Taxable Brokerage",
  "currency": "CAD",
  "totalMarketValue": 48930.0,
  "dayChangeAmount": 30.0,
  "dayChangePercent": 0.0006134969325153375,
  "totalReturnSinceInception": 0.187,
  "asOf": "2026-10-03T16:00:00Z",
  "warnings": []
}
```

Errors always use one shape, and `requestId` matches the `X-Request-ID` response header:

```json
{ "error": "crm_timeout", "message": "…", "requestId": "…", "details": { "timeoutSeconds": 3.0 } }
```

| Situation | Status | `error` |
| --- | --- | --- |
| Id isn't 1-64 chars of letters, digits, `-`, `_` (the CRM is **not** called) | 400 | `invalid_portfolio_id` |
| CRM says 404, or its payload has no account with that `acct_ref` | 404 | `portfolio_not_found` |
| CRM returns invalid JSON or HTML, or lacks `client_record` / `client_id` / `acct_ref`, or has conflicting duplicate accounts | 502 | `crm_bad_response` |
| CRM returns 5xx/429 or refuses the connection (after one retry for 503 or a refused connection) | 503 + `Retry-After` | `crm_unavailable` |
| CRM is slower than `CRM_TIMEOUT_SECONDS`, or returns 504 | 504 | `crm_timeout` |
| Anything unexpected (no internals leaked) | 500 | `internal_error` |

## `GET /portfolios/{id}/holdings`

Returns every position in the portfolio as an array. Inputs (`quantity`, `costBasisPerShare`, `price`, `previousClosePrice`) come from `backend/fixtures/seed.json`; every other field is calculated on each request in `app/calculations/holdings.py`. This endpoint doesn't call the CRM.

Example (`P-9002`):

```json
[
  {
    "ticker": "NEW",
    "name": "New Security",
    "assetClass": "Equity",
    "quantity": 10.0,
    "costBasisPerShare": 40.0,
    "price": 50.0,
    "previousClosePrice": 0.0,
    "marketValue": 500.0,
    "weightPercent": 1.0,
    "unrealizedGainLoss": 100.0,
    "dayChangeAmount": 500.0,
    "dayChangePercent": null
  }
]
```

| Situation | Status | Response |
| --- | --- | --- |
| Known portfolio | 200 | Array of holdings |
| Known portfolio with no holdings (`P-EMPTY`) | 200 | `[]` |
| Unknown id | 404 | `portfolio_not_found` |

**Holdings decisions:**

- **Zero previous close:** `dayChangePercent` is `null` when `previousClosePrice` is 0 (`NEW` in `P-9002`), because a percentage change from zero is undefined. We chose `null` over `0` so clients can tell "no valid percentage" apart from "price didn't move". `dayChangeAmount` is still calculated (500). Note that `GET /portfolios/P-9002` reports `0` here, because it passes the CRM's value through; the holdings figure is our own calculation.
- **Portfolio total:** `weightPercent` divides by the sum of this portfolio's holding market values at request time, not by the CRM's `totalMarketValue`. For the seed data they match (P-9001: 48,930). If the total is 0, every weight is 0.
- **Zero quantity:** needs no special case. `marketValue`, `weightPercent`, `unrealizedGainLoss` and `dayChangeAmount` are all 0 (`ZERO` in `P-9001`). `dayChangePercent` is still the price change (0.2), because it doesn't depend on quantity.
- **No rounding:** values are returned unrounded, so weights may not sum to exactly 1 and some values carry float noise (for example `-570.0000000000017`). We don't "correct" either.
- **Empty vs unknown:** a portfolio that exists with no holdings returns `[]`; only an id missing from the seed's portfolio list returns 404.

## Design decisions and assumptions

**Mapping (see `app/crm/mapper.py`):**

- **Account selection:** The CRM returns all of the client's accounts. We match `acct_ref` exactly (case-sensitive) and never assume position. We search both `client_record.accounts` and `client_record.relationships.accounts`. If both contain the same account with identical data, that's fine; conflicting duplicates return 502.
- **Required fields:** `client_id` and the account's `acct_ref` are required. Without them we can't say whose data this is, so we return 502 rather than guess. If an account lacks `acct_ref` and we can't find the target, we return 502, not 404, because the unidentified account might be the target.
- **Optional fields become `null` plus a warning.** Missing or invalid values never break the response or get silently replaced with a fake value. Each produces a readable entry in `warnings` (for example `"totalMarketValue missing from CRM"`). Fields are always present in the response; they're never omitted.
- **`0` is a real value**, distinct from missing. A `P-EMPTY`-style account returns zeros with no warnings.
- **Number handling:** Numeric strings (`"482350.12"`, `" 0.187 "`, `"1,248,930.50"`) are accepted. Booleans, `"N/A"`, NaN/Infinity, and objects are rejected and become `null` with a warning. Values are never rounded.
- **Legacy shapes:** A bare-number `curr_val` (instead of `{amt, ccy}`) is accepted as the amount.
- **Currency:** Codes are upper-cased and trimmed. If the code is missing or invalid, we default to **CAD** (the platform's base currency, per the requirements) and add a warning. Non-CAD currencies pass through unconverted; conversion is Task 7.
- **`asOf`:** Normalized to ISO 8601 UTC with a `Z` suffix (offsets are converted). A timestamp without a timezone is assumed to be UTC, with a warning. A missing or unparseable timestamp becomes `null` with a warning.
- **`P-9002` day-change percent:** The mock reports `dayChangePercent: 0` while `dayChangeAmount` is 500, because its previous value was zero. We **pass the CRM's value through unchanged** (we don't recompute data the CRM owns) and add a warning that the percentage isn't meaningful, so a UI can show "n/a".
- **Extra or unknown CRM fields** are ignored.

**Resilience (see `app/crm/client.py`):**

- **Timeout:** 3 s per attempt and 5 s total, so a request can never hang. The mock's 10-second timeout mode returns 504 in about 3 s.
- **Retries:** We retry once (after 200 ms), but only for 503 responses and refused connections. These are fast and usually transient: in the mock's `auto` pattern, a 503 on call 5 is followed by a successful call 6, so the caller gets a 200. We never retry a timeout, because that would double the wait. We don't retry other 5xx responses, because they're less likely to be transient. Note for Task 9: a retried request makes two CRM calls, which shows up in `/__stats`.
- **One shared `httpx.AsyncClient`** (connection pooling) is created at startup and closed at shutdown.
- **Status codes:** 502, 503 and 504 are kept separate so callers (and Task 9's stale fallback) can tell "the CRM is down" apart from "the CRM is slow" and "the CRM sent garbage".

**Operational extras:**

- **Request ids:** `X-Request-ID` is accepted from the caller if it's safe (1-128 chars of `[A-Za-z0-9._-]`), otherwise generated. It's returned on every response, included in every error body, forwarded to the CRM, and included in every log line.
- **Structured logs:** each CRM attempt is logged, for example `crm_call portfolio=P-9001 attempt=1 outcome=CrmTimeout status=- latency_ms=3001.2`.
- **Health checks:** `GET /health` is liveness. `GET /health/ready` also checks that the CRM is reachable, returning 503 `degraded` if not.
- **Consistent errors:** unknown routes (404), wrong methods (405), and validation errors also use the standard error shape.

## Extra mock data

The supplied mock only has six modes, so `tests/fixtures/crm/` holds **27 extra CRM payloads**:

| Category | Fixtures |
| --- | --- |
| Valid | `ok_p9001`, `ok_target_not_first`, `zero_values`, `negative_day_change`, `usd_account`, `large_values`, `extra_unknown_fields`, `day_change_pct_zero_with_amount` |
| Inconsistent nesting | `nested_relationships`, `accounts_in_both_locations`, `curr_val_flat_number`, `chg_1d_missing` |
| Missing or bad values | `missing_amount_and_nickname`, `all_numbers_null`, `numeric_strings`, `invalid_number_types`, `lowercase_ccy`, `missing_ccy`, `missing_meta`, `bad_timestamp`, `offset_timestamp` |
| Should fail | `empty_accounts` (404), `no_client_record`, `missing_client_id`, `missing_acct_ref`, `duplicate_acct_ref`, `html_error_page` (all 502) |

### Scenario fake CRM

`scripts/fake_crm.py` serves any fixture on the same route as the real mock, so you can demo each edge case by hand:

```sh
python scripts/fake_crm.py --port 4003
CRM_BASE_URL=http://localhost:4003 uvicorn app.main:app --port 3000

curl -X POST localhost:4003/__control -H 'Content-Type: application/json' -d '{"scenario":"invalid_number_types"}'
curl -H 'Authorization: Bearer superday-demo-token' localhost:3000/portfolios/P-9001   # every fixture targets P-9001
curl -X POST localhost:4003/__control -H 'Content-Type: application/json' -d '{"slow_ms":4000}'   # -> 504
curl -X POST localhost:4003/__control -H 'Content-Type: application/json' -d '{"status":503}'     # -> 503 after retry
```

It also supports `GET /__scenarios` and `GET /__stats`. [requests.http](requests.http) contains ready-made requests for both CRMs.

## `GET /portfolios/{id}/performance-history` (Task 3)

Daily total market value for the performance chart, oldest first. `range` is optional: `1D`, `1M`, `YTD`, `1Y`, or `All` (the default).

```sh
curl -H 'Authorization: Bearer superday-demo-token' 'localhost:3000/portfolios/P-9001/performance-history?range=1D'
```

```json
[
  { "date": "2026-10-02", "marketValue": 48917.8 },
  { "date": "2026-10-03", "marketValue": 48930.0 }
]
```

The data comes from `backend/fixtures/performance-history.json`, which `node backend/fixtures/generate-history.mjs` creates with dates ending today (UTC). The file is git-ignored. `P-9001` has 401 days, `P-9002` and `P-SINGLE` have 60, and `P-EMPTY` has none.

| Situation | Status | `error` |
| --- | --- | --- |
| Id isn't 1-64 chars of letters, digits, `-`, `_` | 400 | `invalid_portfolio_id` |
| `range` isn't exactly one of the five values (`details.allowed` lists them) | 400 | `invalid_range` |
| Id isn't a portfolio in `seed.json` | 404 | `portfolio_not_found` |
| History file is missing or unreadable (the log names the command that generates it) | 503 | `history_unavailable` |

**Decisions:**

- **Every range ends today** (the current UTC date, the same "today" the generator uses) and includes both ends. `1D` starts yesterday, so it returns 2 points: the data is daily, and one point can't draw a line. `1M` and `1Y` start on the same day one month or one year back, clamped to the end of shorter months (Mar 31 becomes Feb 28, or Feb 29 in a leap year; Feb 29 becomes Feb 28). `YTD` starts on January 1 of the current year. `All` has no start date.
- **The window is chosen by date, not by counting points**, so gaps in the data don't stretch it further back. One consequence: if the data skips days (weekends, for example), `1D` can return a single point.
- **Short history is returned as-is**, never padded: `P-9002` with `range=1Y` returns its 60 days.
- **`range` must match exactly**, including case. `all`, an empty `range=`, or `1W` returns 400 rather than falling back to `All`.
- **Checks run in order:** id format, then `range`, then whether the portfolio exists. A bad `range` on an unknown id is therefore a 400, not a 404.
- **404 versus empty:** the portfolio list in `seed.json` decides whether an id exists. A portfolio with no history (`P-EMPTY`) returns 200 with `[]`.
- **Snapshots dated after today are dropped**, and values are passed through unrounded.
- **A missing history file doesn't stop the server**, so `/portfolios/{id}` keeps working and only this endpoint returns 503. Once loaded, the file is cached for the life of the process, so **restart the backend after regenerating it** (for example the next day, so `1D` and `YTD` line up with the new date).
- **Until the shared seed loader (`app/data/seed.py`, see [TEAM-GUIDE.md](TEAM-GUIDE.md)) exists**, `app/services/history_service.py` reads both JSON files itself. Switching over only touches `get_history_service` in `app/dependencies.py`.

## `GET /portfolios/{id}/allocation` (Task 5)

Portfolio market value broken down by asset class, for the allocation chart. Like holdings, it's calculated on each request from `backend/fixtures/seed.json` (in `app/calculations/allocation.py`) and doesn't call the CRM.

```sh
curl -H 'Authorization: Bearer superday-demo-token' localhost:3000/portfolios/P-9001/allocation
```

```json
[
  { "assetClass": "Equity", "value": 27300.0, "percent": 0.5579399141630901 },
  { "assetClass": "Fixed Income", "value": 21630.0, "percent": 0.44206008583690987 }
]
```

| Situation | Status | Response |
| --- | --- | --- |
| Known portfolio | 200 | One entry per asset class held, largest `value` first |
| Known portfolio in a single asset class (`P-SINGLE`) | 200 | One entry with `percent: 1.0` |
| Known portfolio with no holdings (`P-EMPTY`) | 200 | `[]` |
| Unknown id | 404 | `portfolio_not_found` |

**Decisions:**

- **Only classes the portfolio holds are returned.** There are no zero rows for Cash or Alternatives, so a single-class portfolio gets exactly one entry. With one class, `value` and the total are the same number, so `percent` is exactly `1.0`, not `0.9999…`.
- **Portfolio total:** `percent` divides by the sum of this portfolio's holding market values, the same total `weightPercent` uses in holdings, not the CRM's `totalMarketValue`. A class's `percent` therefore equals the sum of its holdings' `weightPercent`. If the total is 0, every `percent` is 0.
- **Zero-quantity holdings still count toward their class.** `ZERO` in `P-9001` adds 0 to Equity. A class whose holdings all have quantity 0 appears with `value: 0`.
- **Asset class names are used exactly as they appear in the seed**, with no case or spacing clean-up, so `"Equity"` and `"equity"` would be two entries.
- **Order:** largest `value` first. Ties keep the order the holdings appear in the seed.
- **No rounding**, the same as holdings.
- **Empty vs unknown:** the seed's portfolio list decides whether an id exists, the same as holdings. A portfolio with no holdings returns `[]`.

## Authentication (Task 4)

Every endpoint except the health checks and the API docs needs a bearer token. For this exercise there's one hardcoded mock token, `superday-demo-token`; set `API_TOKEN` to change it.

```sh
curl -H 'Authorization: Bearer superday-demo-token' localhost:3000/portfolios/P-9001
```

A request without a valid header never reaches the endpoint. It gets a 401 in the shared error shape, plus a `WWW-Authenticate: Bearer` header:

```json
{ "error": "unauthorized", "message": "Missing Authorization header. Send 'Authorization: Bearer <token>'.", "requestId": "…" }
```

| `Authorization` header | Result |
| --- | --- |
| Missing or blank | 401: "Missing Authorization header…" |
| `superday-demo-token` (no `Bearer `), `Basic …`, or `Bearer` with no token | 401: "The Authorization header must look like 'Bearer \<token\>'." |
| `Bearer wrong-token` | 401: "The token is not valid." |
| `Bearer superday-demo-token` (any capitalization of `Bearer`) | Passes through to the endpoint |

**Decisions:**

- **Middleware, not a per-route check.** `app/auth.py` runs before routing, so every route is protected, including ones added later, unless its path is on a short public list. Forgetting to list a route fails closed (401), not open. `tests/test_auth.py` sweeps every operation in the OpenAPI spec to prove it.
- **Public paths:** `/health` and `/health/ready`, so monitoring doesn't need a secret, plus `/docs`, `/docs/oauth2-redirect`, `/redoc` and `/openapi.json`, so the docs load. They're matched exactly, never by prefix, so `/health/anything` still needs a token.
- **Rejected before any route logic runs:** the tests show the CRM is never called for a rejected request.
- **Unknown paths get a 401 without a token** (and a 404 with one), so the API doesn't reveal which routes exist.
- **Parsing:** the scheme is case-insensitive (`bearer` works, as RFC 7235 allows), extra spaces are tolerated, and the token itself must match exactly.
- **Comparison:** constant time (`hmac.compare_digest`) on bytes, so a token with non-ASCII characters gets a 401, not a 500.
- **Logging:** rejections are logged with the path, reason and request id, never the token. The token is a `SecretStr`, so it doesn't show up when settings are printed either.
- **Interactive docs:** `/docs` has an **Authorize** button, remembers the token across reloads, and documents the 401 on every protected operation.
- **Tests** send the token with `TestClient(app, headers=AUTH_HEADERS)`, using `AUTH_HEADERS` from `tests/conftest.py`.
- **It's a mock:** one shared token with no users, expiry or scopes. A real deployment would use a proper identity provider (for example OAuth 2.0 with signed, expiring tokens) over HTTPS.

## Project layout

```text
app/
  main.py                    create_app(): lifespan (shared HTTP client), auth and request-id middleware, routers
  auth.py                    Task 4: bearer-token middleware and the public paths
  openapi.py                 What /docs shows: overview, examples, Authorize button
  config.py                  Settings from env vars
  models.py                  PortfolioMetadata, Holding, PerformanceSnapshot, AllocationEntry, ErrorResponse (camelCase on the wire)
  errors.py                  Exception -> HTTP status + error body
  request_context.py         Request ids and logging
  dependencies.py            FastAPI dependency wiring
  crm/client.py              CRM HTTP calls: timeout, retry, failure classification
  crm/mapper.py              Pure payload -> PortfolioMetadata mapping
  crm/errors.py              CrmNotFound / CrmTimeout / CrmUnavailable / CrmBadResponse
  services/portfolio_service.py   Fetch, then map (Task 9's cache goes here)
  services/history_service.py     Task 3: range window, filtering, history and seed file loading
  routes/portfolios.py, routes/history.py, routes/health.py
  data/seed.py               Loads backend/fixtures/seed.json once (in memory)
  calculations/holdings.py   Pure holding calculations: market value, weight, gain/loss
  services/holdings_service.py   404 check, then calculate
  routes/holdings.py         GET /portfolios/{id}/holdings
  calculations/allocation.py     Pure grouping of holding market values by asset class
  services/allocation_service.py 404 check, then calculate
  routes/allocation.py       GET /portfolios/{id}/allocation
scripts/fake_crm.py          Scenario-driven fake CRM
tests/                       pytest suites and fixtures/crm/
```

## Extending

- **Task 9 (cache):** wrap `PortfolioService.get_metadata`. Cache the mapped `PortfolioMetadata` per id. On `CrmTimeout` or `CrmUnavailable` with an expired entry, serve it with `stale: true`. `CrmNotFound` and `CrmBadResponse` should probably not fall back to stale data; decide and document.
- **Task 7 (currency):** convert in the route or service after mapping; `currency` is already in the response. For history, convert in `_to_response` in `app/services/history_service.py`, which builds every snapshot. For allocation, convert only `value`; `percent` is a ratio and doesn't change.

## Unfinished / known limitations

- Only Tasks 1-5 are implemented.
- Auth is one shared mock token, with no users, expiry or scopes (Task 4).
- There's no caching yet (Task 9): every request calls the CRM.
- Performance history is read once per process, so a regenerated file needs a restart. History values aren't converted to other currencies yet (Task 7).
