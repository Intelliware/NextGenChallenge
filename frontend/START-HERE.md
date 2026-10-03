# Frontend: start here

Build the dashboard described in [REQUIREMENTS.md](REQUIREMENTS.md). Choose any frontend framework or tooling. Your app starts from scratch in `frontend/solution/`.

## Get running

1. [Install Node.js and open a terminal in `NextGenChallenge`](../support/SETUP.md).
2. Start the supplied backend:

   ```sh
   node frontend/mock-server.mjs
   ```

3. Open <http://localhost:4000/health>. You should see `"status": "ok"`.
4. Open <http://localhost:4000/portfolios/P-9001> to see the sample data.
5. Create your frontend project in `frontend/solution/` (or an `app/` folder inside it). Run your app using your chosen framework's instructions. Fetch data from `http://localhost:4000`.

The mock supplies data. You build the layout, sorting, charts, account switching, date filtering, and currency display. The mock allows browser requests from your local app; no login is needed.

## Use the data

See the [mock API guide](../support/PORTFOLIO-API.md) for routes, field units, and test datasets. Start with `/accounts`, then fetch `/portfolios/P-9001`. Keep the same `scenario` on related requests.

Try <http://localhost:4000/portfolios/P-9001?scenario=empty> and <http://localhost:4000/portfolios/P-9001?scenario=large> when checking your table. Return to the URL without `scenario` for the normal dataset.

Include setup steps, tests, and assumptions with your solution. The requirements file won't be updated after you start, so treat it as the fixed spec to self-check against.
