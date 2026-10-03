def market_value(holding: dict) -> float:
    return holding["quantity"] * holding["price"]


def compute_holding(holding: dict, portfolio_total: float) -> dict:
    """Response fields for one raw seed holding. Task 7 converts currency on this output."""
    quantity = holding["quantity"]
    price = holding["price"]
    cost = holding["costBasisPerShare"]
    previous_close = holding["previousClosePrice"]
    value = quantity * price
    return {
        "ticker": holding["ticker"],
        "name": holding["name"],
        "asset_class": holding["assetClass"],
        "quantity": quantity,
        "cost_basis_per_share": cost,
        "price": price,
        "previous_close_price": previous_close,
        "market_value": value,
        "weight_percent": value / portfolio_total if portfolio_total else 0.0,
        "unrealized_gain_loss": (price - cost) * quantity,
        "day_change_amount": (price - previous_close) * quantity,
        "day_change_percent": (price - previous_close) / previous_close if previous_close else None,
    }


def compute_holdings(holdings: list[dict]) -> list[dict]:
    total = sum(market_value(h) for h in holdings)
    return [compute_holding(h, total) for h in holdings]
