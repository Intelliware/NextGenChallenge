# Backend: start here

Build the backend described in [REQUIREMENTS.md](REQUIREMENTS.md). Choose any language and framework. Your service starts from scratch in `backend/solution/`.

## Get running

1. [Install Node.js and open a terminal in `NextGenChallenge`](../support/SETUP.md).
2. Start the mock CRM (the external service your backend will call):

   ```sh
   node backend/mock-crm.mjs
   ```

3. Open <http://localhost:4002/health>. You should see `"status": "ok"`.
4. Open <http://localhost:4002/crm/portfolios/P-9001?mode=ok> for a successful sample CRM response.
5. Create your backend project in `backend/solution/` and run it on a different port, such as `3000`. Set its CRM base URL to `http://localhost:4002`.

Start with Task 1: implement your own `GET /portfolios/:id` endpoint. Inside it, call the CRM's `GET /crm/portfolios/:id`, then map its response into your schema as described in Task 1. Read [CRM.md](CRM.md) for the response shapes and failure controls.

## What is supplied

- **Mock CRM:** portfolio metadata, multiple accounts, failures, timeouts, and call counts for testing your cache.
- **[fixtures/seed.json](fixtures/seed.json):** clients, portfolios, raw holdings, holding details, exchange rate, and transactions. Using this fixture is optional — you may create your own data instead — but using the supplied one is recommended. Copy or import them into your chosen store. Design your own schema.
- **Sample history:** run `node backend/fixtures/generate-history.mjs` from `NextGenChallenge`. This creates `backend/fixtures/performance-history.json`, with dates ending today. Regenerate when needed so YTD tests use the current year. The generated file is ignored by Git.
- **[requests.http](requests.http):** example requests to send to your own service using an HTTP client. A browser also works for the mock; use curl or an HTTP client to send your service's auth header.

You implement the endpoints, calculations, authentication, caching, persistence, and ledger replay. A frontend is not needed to test this track.

## Data to try

| Fixture | Useful for |
| --- | --- |
| Client `abc123` | Multiple portfolios with different sizes and day changes |
| Client `single-client` | One portfolio |
| `P-9001` | Mixed asset classes; zero-quantity `ZERO` position |
| `P-9002` | `NEW` has a zero previous close; only 60 days of history |
| `P-EMPTY` | No holdings or history |
| `P-SINGLE` | One asset class |
| `ZERO` / `NEW` holding details | No dividend and no price history |
| `transactions` / `ledgerCases` | Partial sell, closed position, oversell, out-of-order input |

For Tasks 2–9, the seed's quantity and cost fields are convenient inputs. For Task 10, derive them from transactions as required; the closed position's seed cost is historical, not a prescribed replay result. All seed money is CAD and all backend percentage fields are decimals. The mock CRM reports `0` for `P-9002`'s day-change percentage because its previous value is zero; document your handling of that case.

The requirements leave some response details to your judgment, including where to put currency metadata on array responses. Document your choices. Include installation/run commands, your mock auth token, tests, and assumptions with your solution.
