# Portfolio Dashboard Backend (Python / FastAPI)

Status: **Task 1 (Portfolio Metadata via CRM Integration)** and **Task 3 (Performance History)** are complete. Other tasks are not started yet. The code is structured for Task 9 (caching) and Task 4 (auth) to slot in; see "Extending" below.

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

Try it: <http://localhost:3000/portfolios/P-9001> and <http://localhost:3000/portfolios/P-9001/performance-history?range=1M>. Interactive API docs: <http://localhost:3000/docs>.

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
| `tests/test_history.py` | Task 3, with today pinned and made-up data (no generated file needed): every range's window, month-end and leap-year clamping, gaps, future dates, short history, range parsing, file loading, and the HTTP layer (400/404/503, empty portfolio, OpenAPI). |

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
curl localhost:3000/portfolios/P-9001          # every fixture targets P-9001
curl -X POST localhost:4003/__control -H 'Content-Type: application/json' -d '{"slow_ms":4000}'   # -> 504
curl -X POST localhost:4003/__control -H 'Content-Type: application/json' -d '{"status":503}'     # -> 503 after retry
```

It also supports `GET /__scenarios` and `GET /__stats`. [requests.http](requests.http) contains ready-made requests for both CRMs.

## `GET /portfolios/{id}/performance-history` (Task 3)

Daily total market value for the performance chart, oldest first. `range` is optional: `1D`, `1M`, `YTD`, `1Y`, or `All` (the default).

```sh
curl 'localhost:3000/portfolios/P-9001/performance-history?range=1D'
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

## Project layout

```text
app/
  main.py                    create_app(): lifespan (shared HTTP client), request-id middleware, routers
  config.py                  Settings from env vars
  models.py                  PortfolioMetadata, PerformanceSnapshot, ErrorResponse (camelCase on the wire)
  errors.py                  Exception -> HTTP status + error body
  request_context.py         Request ids and logging
  dependencies.py            FastAPI dependency wiring
  crm/client.py              CRM HTTP calls: timeout, retry, failure classification
  crm/mapper.py              Pure payload -> PortfolioMetadata mapping
  crm/errors.py              CrmNotFound / CrmTimeout / CrmUnavailable / CrmBadResponse
  services/portfolio_service.py   Fetch, then map (Task 9's cache goes here)
  services/history_service.py     Task 3: range window, filtering, history and seed file loading
  routes/portfolios.py, routes/history.py, routes/health.py
scripts/fake_crm.py          Scenario-driven fake CRM
tests/                       pytest suites and fixtures/crm/
```

## Extending

- **Task 9 (cache):** wrap `PortfolioService.get_metadata`. Cache the mapped `PortfolioMetadata` per id. On `CrmTimeout` or `CrmUnavailable` with an expired entry, serve it with `stale: true`. `CrmNotFound` and `CrmBadResponse` should probably not fall back to stale data; decide and document.
- **Task 4 (auth):** add a dependency or middleware before the routers. `/health` should probably stay public. The API tests in `tests/test_history.py` will then need the token header too.
- **Task 7 (currency):** convert in the route or service after mapping; `currency` is already in the response. For history, convert in `_to_response` in `app/services/history_service.py`, which builds every snapshot.

## Unfinished / known limitations

- Tasks 2 and 4-10 are not implemented.
- There's no authentication yet, so the endpoints are open (Task 4).
- There's no caching yet (Task 9): every request calls the CRM.
- Performance history is read once per process, so a regenerated file needs a restart. History values aren't converted to other currencies yet (Task 7).
