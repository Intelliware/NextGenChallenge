# Team guide: shared stack and working independently

This guide helps two people build the backend in parallel without stepping on each other. Read it once before you start, and keep the "Agreed decisions" section up to date.

## 1. The stack (everyone uses the same)

| Piece | Choice | Version |
| --- | --- | --- |
| Language | Python | 3.11 or newer (built on 3.14) |
| Web framework | FastAPI | 0.142.2 |
| Server | uvicorn | 0.54.0 |
| HTTP client (for calling the CRM) | httpx | 0.28.1 |
| Data models and validation | Pydantic v2 + pydantic-settings | 2.13.5 / 2.15.0 |
| Tests | pytest + pytest-asyncio + respx | 9.1.1 / 1.4.0 / 0.23.1 |
| Storage | `backend/fixtures/seed.json` loaded into memory | none |

Exact versions are pinned in [requirements.txt](requirements.txt) (runtime) and [requirements-dev.txt](requirements-dev.txt) (runtime plus tests). **Don't install packages ad hoc.** If you need a new library, add it pinned (`package==x.y.z`) to the right file in its own small commit, and tell your partner so they can re-run `pip install`.

## 2. One-time setup (each person)

From the repo root:

```sh
cd backend/solution
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -m "not integration"        # should be all green before you change anything
```

`.venv/` is git-ignored. Each person has their own.

## 3. Daily commands

```sh
source .venv/bin/activate
node backend/mock-crm.mjs                # (repo root) the CRM; only needed for /portfolios/{id}
uvicorn app.main:app --port 3000 --reload
pytest                                   # all tests; live CRM tests auto-skip if the mock is off
pytest tests/test_holdings.py -q         # just your file
```

API docs while the server runs: <http://localhost:3000/docs>.

**Before every push, the full `pytest` run must pass.**

## 4. Who owns what

Task 1 is done. The remaining work is split so that each person mostly touches their own files.

| | Person A: CRM and cross-cutting | Person B: data and calculations |
| --- | --- | --- |
| Tasks | 4 (auth), 9 (cache), 3 (performance history), 7 (currency, last) | 2 (holdings), 5 (allocation), 6 (household), 8 (holding detail), 10 (ledger replay) |
| Owns | `app/auth.py`, `app/cache.py`, `app/crm/*`, `app/services/portfolio_service.py`, `app/services/history_service.py`, `app/routes/portfolios.py`, `app/routes/history.py` | `app/data/*`, `app/calculations/*`, `app/ledger/*`, `app/services/holdings_service.py`, `app/services/client_service.py`, `app/routes/holdings.py`, `app/routes/clients.py` |
| Tests | `test_auth.py`, `test_cache.py`, `test_history.py`, `test_currency.py` | `test_holdings.py`, `test_allocation.py`, `test_household.py`, `test_holding_detail.py`, `test_ledger.py` |

**Shared files.** These are the only places you'll both edit. Keep those edits small and append-only to avoid merge conflicts:

- `app/main.py`: add one `app.include_router(...)` line for your router.
- `app/models.py`: append your response models at the bottom of the file, under a `# --- Task N ---` comment.
- `app/errors.py`: append new `ApiError` subclasses (for example `ClientNotFound`, `InvalidRange`).
- `app/dependencies.py`: append one provider function per service (for example `get_holdings_service`).
- `README.md`: add your decisions and notes under your task's heading.

**Handoffs between people:**

1. **Person B to Person A:** Person B builds the seed data loader (`app/data/seed.py`) first and pushes it early, because Task 3 (Person A) needs the history data. Task 7 (Person A) needs Person B's holdings to be convertible, so build each holding response in **one function** so currency conversion can be applied in a single place.
2. **Person A to Person B:** Person A adds auth (Task 4) early. After it merges, every new route is protected automatically (see "Auth" below), and Person B's tests send the token header.

## 5. How to add an endpoint (follow the Task 1 pattern)

Every task uses the same layers. Copy this shape so the code reads as if one person wrote it:

```text
routes/<area>.py        thin: validate input, call the service, return a model
services/<area>_service.py   orchestration: load data, call calculations
calculations/ or crm/mapper.py   pure functions with no I/O; most unit tests target these
models.py               Pydantic response models (snake_case in Python, camelCase in JSON)
errors.py               raise typed errors; never build error JSON by hand in a route
```

Example skeleton for Task 2:

```python
# app/routes/holdings.py
from fastapi import APIRouter, Depends

from app.dependencies import get_holdings_service   # add the provider function in app/dependencies.py
from app.models import Holding
from app.services.holdings_service import HoldingsService

router = APIRouter(tags=["holdings"])


@router.get("/portfolios/{portfolio_id}/holdings", response_model=list[Holding])
async def get_holdings(portfolio_id: str, service: HoldingsService = Depends(get_holdings_service)) -> list[Holding]:
    return service.get_holdings(portfolio_id)
```

```python
# app/models.py  (append)
# --- Task 2 ---
class Holding(ApiModel):
    ticker: str
    market_value: float          # serialized as "marketValue"
    day_change_percent: float | None
```

```python
# app/errors.py  (append)
class PortfolioNotFound(ApiError):
    status_code = 404
    error = "portfolio_not_found"
```

Then add `app.include_router(holdings.router)` in `app/main.py`.

## 6. Shared conventions (the API must look consistent)

- **JSON field names are camelCase.** Inherit from `ApiModel` in `app/models.py` and write snake_case in Python; the alias generator converts it.
- **Errors** always look like `{ "error", "message", "requestId", "details"? }`. Raise an `ApiError` subclass and the handler formats it. Use these codes and statuses:
  - `400 bad_request` / `invalid_*`: bad input (for example `invalid_range`, `unsupported_currency`)
  - `401 unauthorized`: auth failed (Task 4)
  - `404 portfolio_not_found` / `client_not_found` / `ticker_not_found`
  - `502/503/504 crm_*`: upstream CRM problems (Task 1 and Task 9 only)
- **Money:** CAD unless `?currency=` says otherwise. **Don't round** in calculations; round only if a test or requirement demands it.
- **Percentages are decimals** (`0.0032`, not `0.32`).
- **Empty is not an error:** no holdings returns `[]` with a 200; an unknown id returns 404.
- **Dates:** `YYYY-MM-DD` for dates, ISO 8601 UTC with a `Z` suffix for datetimes (use `format_utc` in `app/crm/mapper.py`).
- **Pure calculation functions** take plain data and return plain data. Test them without HTTP.
- **Comments:** only for constraints the code can't show. No commented-out code.

## 7. Testing rules

- Each task gets its own test file (see section 4) covering every edge case and Definition of Done item from [REQUIREMENTS.md](../REQUIREMENTS.md).
- Use the seed fixtures named in [START-HERE.md](../START-HERE.md): `P-9001` (mixed, plus a zero-quantity position), `P-9002` (zero previous close, short history), `P-EMPTY`, `P-SINGLE`, clients `abc123` and `single-client`.
- API tests use `TestClient(create_app(make_settings()))`; see `tests/test_portfolios_api.py`. Override dependencies instead of patching globals.
- Regenerate history before testing YTD: `node backend/fixtures/generate-history.mjs` (repo root).

## 8. Git workflow

1. `main` must always pass `pytest`.
2. One branch per task: `task-2-holdings`, `task-4-auth`, and so on. Keep each branch small.
3. Pull `main` before starting a task, and rebase or merge `main` into your branch before opening a PR.
4. Your partner gives each PR a quick review: does it follow sections 5 and 6, and are the edge cases tested?
5. Merge order that avoids conflicts:
   1. Person B: `app/data/seed.py` (seed loader)
   2. Person A: Task 4 (auth)
   3. Everything else in any order
   4. Person A: Task 7 last

## 9. Agreed decisions

The requirements leave these to us. Confirm each one together, change the row if you disagree, and copy the final answer into the README.

| Question | Proposed answer | Task | Agreed? |
| --- | --- | --- | --- |
| `previousClosePrice` is 0, so `dayChangePercent` divides by zero | Return `null` | 2 | |
| Seed data location | Read `backend/fixtures/seed.json` at startup into memory; tests use the same file | all | |
| Where data file paths live | `SEED_FILE` and `HISTORY_FILE` settings in `app/config.py`; the seed loader reuses `seed_file` | all | |
| What each history `range` covers | Ends today (UTC), both ends included. `1D`: yesterday and today (2 points). `1M`/`1Y`: same day last month/year, clamped to month end. `YTD`: from Jan 1 | 3 | |
| Is `range` case-sensitive? | Yes, exact match; `all`, empty, or unknown values return 400 `invalid_range` | 3 | |
| History: 404 or `[]`? | `seed.json`'s portfolio list decides; a listed portfolio with no history (`P-EMPTY`) returns `[]` | 3 | |
| History file not generated | Server still starts; the history endpoint returns 503 `history_unavailable` and logs the generator command | 3 | |
| Mock auth token | `Bearer superday-demo-token` (matches `backend/requests.http`) | 4 | |
| Is `/health` behind auth? | No, health checks stay public | 4 | |
| Where currency metadata goes on array responses | Add `currency` and `exchangeRate` to each item, keeping the response a plain array as the spec shows | 7 | |
| USD/CAD rate source | `exchangeRate` from `seed.json`, held in a small internal module | 7 | |
| Cache TTL | 30 seconds, configurable with `CACHE_TTL_SECONDS` | 9 | |
| A successful CRM call after a stale period | Replaces the cache entry and resets `stale: false` | 9 | |
| Do 404 or bad CRM data fall back to the stale cache? | No; only timeouts and outages (503/504) do | 9 | |
| Average cost after a position is fully sold | `null` (no shares, so no meaningful cost) | 10 | |
| Selling more shares than held | Reject with a `ValueError`; the replay function never returns a negative position | 10 | |
| Transactions out of order | Sort by `date` (stable) before replaying | 10 | |
| `P-9002` CRM day-change percent of 0 | Already decided in Task 1: pass it through and add a warning | 1 | Done |

## 10. Definition of done (per task)

- [ ] Every Definition of Done bullet in REQUIREMENTS.md has a test.
- [ ] Edge cases from the requirements are tested, plus at least one we thought of ourselves.
- [ ] The full `pytest` run passes.
- [ ] Errors use the shared shape and codes.
- [ ] Decisions are written in the README under the task's heading.
- [ ] `requests.http` has an example request for the new endpoint.
