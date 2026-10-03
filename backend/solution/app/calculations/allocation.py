from collections import defaultdict

from app.calculations.holdings import market_value


def compute_allocation(holdings: list[dict]) -> list[dict]:
    """Market value per asset class, largest first. An empty portfolio gives []."""
    totals: dict[str, float] = defaultdict(float)
    for holding in holdings:
        totals[holding["assetClass"]] += market_value(holding)

    portfolio_total = sum(totals.values())
    rows = [
        {
            "asset_class": asset_class,
            "value": value,
            "percent": value / portfolio_total if portfolio_total else 0.0,
        }
        for asset_class, value in totals.items()
    ]
    return sorted(rows, key=lambda row: row["value"], reverse=True)
