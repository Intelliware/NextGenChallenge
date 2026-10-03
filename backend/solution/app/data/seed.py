import json
from functools import lru_cache
from pathlib import Path

SEED_PATH = Path(__file__).resolve().parents[3] / "fixtures" / "seed.json"


@lru_cache
def load_seed() -> dict:
    """Read seed.json once; every caller shares the same in-memory copy. Don't mutate it."""
    with SEED_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def get_portfolio(portfolio_id: str) -> dict | None:
    return next((p for p in load_seed()["portfolios"] if p["portfolioId"] == portfolio_id), None)


def holdings_for(portfolio_id: str) -> list[dict]:
    return [h for h in load_seed()["holdings"] if h["portfolioId"] == portfolio_id]
