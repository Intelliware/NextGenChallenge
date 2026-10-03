"""Scenario-driven fake CRM for exercising edge cases the supplied mock cannot produce.

Serves any fixture from tests/fixtures/crm/ at the same route the real mock uses, so the backend
can point at it unchanged:

    python scripts/fake_crm.py --port 4003
    CRM_BASE_URL=http://localhost:4003 uvicorn app.main:app --port 3000

Every fixture targets portfolio P-9001, so request /portfolios/P-9001 on the backend.

Controls (global, like the supplied mock's /__control):
    POST /__control  {"scenario": "numeric_strings", "slow_ms": 0, "status": null}
    GET  /__scenarios
    GET  /__stats
Per-request overrides for direct calls: /crm/portfolios/P-9001?scenario=...&slow_ms=...&status=...
"""

import argparse
import asyncio
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "crm"
DEFAULT_SCENARIO = "ok_p9001"


def available_scenarios() -> dict[str, Path]:
    return {path.stem: path for path in sorted(FIXTURE_DIR.iterdir()) if path.suffix in {".json", ".txt"}}


class Control(BaseModel):
    scenario: str | None = None
    slow_ms: int | None = Field(default=None, ge=0, le=60000)
    status: int | None = Field(default=None, ge=100, le=599)


def create_fake_crm() -> FastAPI:
    app = FastAPI(title="Fake CRM (scenario fixtures)")
    state = {"scenario": DEFAULT_SCENARIO, "slow_ms": 0, "status": None, "calls": 0, "calls_by_portfolio": {}}

    def check_scenario(name: str) -> Path:
        scenarios = available_scenarios()
        if name not in scenarios:
            raise HTTPException(400, f"Unknown scenario '{name}'. Options: {', '.join(scenarios)}")
        return scenarios[name]

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "Fake CRM"}

    @app.get("/__scenarios")
    async def scenarios():
        return {"current": state["scenario"], "scenarios": list(available_scenarios())}

    @app.get("/__stats")
    async def stats():
        return {
            "scenario": state["scenario"],
            "slowMs": state["slow_ms"],
            "status": state["status"],
            "calls": state["calls"],
            "callsByPortfolio": state["calls_by_portfolio"],
        }

    @app.post("/__control")
    async def control(body: Control):
        if body.scenario is not None:
            check_scenario(body.scenario)
            state["scenario"] = body.scenario
        if body.slow_ms is not None:
            state["slow_ms"] = body.slow_ms
        state["status"] = body.status
        return {"scenario": state["scenario"], "slowMs": state["slow_ms"], "status": state["status"]}

    @app.get("/crm/portfolios/{portfolio_id}")
    async def portfolio(
        portfolio_id: str, scenario: str | None = None, slow_ms: int | None = None, status: int | None = None
    ):
        path = check_scenario(scenario or state["scenario"])
        state["calls"] += 1
        by_portfolio = state["calls_by_portfolio"]
        by_portfolio[portfolio_id] = by_portfolio.get(portfolio_id, 0) + 1

        delay_ms = slow_ms if slow_ms is not None else state["slow_ms"]
        if delay_ms:
            await asyncio.sleep(delay_ms / 1000)
        forced_status = status if status is not None else state["status"]
        if forced_status is not None and forced_status != 200:
            return JSONResponse(
                status_code=forced_status,
                content={"error": "fake_crm_forced_status", "message": f"Forced HTTP {forced_status}."},
            )
        media_type = "application/json" if path.suffix == ".json" else "text/html; charset=utf-8"
        return Response(content=path.read_bytes(), media_type=media_type)

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=4003)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    uvicorn.run(create_fake_crm(), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
