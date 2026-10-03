import pytest
from fastapi.testclient import TestClient

from app.calculations.holdings import compute_holdings
from app.data.seed import holdings_for
from app.main import create_app
from tests.conftest import make_settings

HOLDING_FIELDS = {
    "ticker", "name", "assetClass", "quantity", "costBasisPerShare", "price",
    "previousClosePrice", "marketValue", "weightPercent", "unrealizedGainLoss",
    "dayChangeAmount", "dayChangePercent",
}


def by_ticker(rows: list[dict]) -> dict[str, dict]:
    return {row["ticker"]: row for row in rows}


# --- calculations (no HTTP) ---


def test_p9001_values():
    rows = by_ticker(compute_holdings(holdings_for("P-9001")))
    aapl, bnd = rows["AAPL"], rows["BND"]

    assert aapl["market_value"] == pytest.approx(27300)
    assert aapl["weight_percent"] == pytest.approx(27300 / 48930)
    assert aapl["unrealized_gain_loss"] == pytest.approx(3300)
    assert aapl["day_change_amount"] == pytest.approx(300)
    assert aapl["day_change_percent"] == pytest.approx(2.5 / 225)

    assert bnd["market_value"] == pytest.approx(21630)
    assert bnd["weight_percent"] == pytest.approx(21630 / 48930)
    assert bnd["unrealized_gain_loss"] == pytest.approx(-570)
    assert bnd["day_change_amount"] == pytest.approx(-270)
    assert bnd["day_change_percent"] == pytest.approx(-0.9 / 73)


def test_zero_quantity_gives_zeros():
    zero = by_ticker(compute_holdings(holdings_for("P-9001")))["ZERO"]
    assert zero["market_value"] == 0
    assert zero["weight_percent"] == 0
    assert zero["unrealized_gain_loss"] == 0
    assert zero["day_change_amount"] == 0


def test_zero_previous_close_gives_null_percent():
    new = by_ticker(compute_holdings(holdings_for("P-9002")))["NEW"]
    assert new["day_change_percent"] is None
    assert new["day_change_amount"] == pytest.approx(500)


def test_no_holdings_gives_empty_list():
    assert compute_holdings(holdings_for("P-EMPTY")) == []


# --- endpoint ---


@pytest.fixture
def client():
    with TestClient(create_app(make_settings())) as test_client:
        yield test_client


def test_endpoint_returns_all_holdings_in_camel_case(client):
    response = client.get("/portfolios/P-9001/holdings")
    assert response.status_code == 200
    body = response.json()
    assert [h["ticker"] for h in body] == ["AAPL", "BND", "ZERO"]
    assert all(set(h) == HOLDING_FIELDS for h in body)
    assert body[0]["marketValue"] == pytest.approx(27300)


def test_endpoint_zero_previous_close_is_json_null(client):
    body = client.get("/portfolios/P-9002/holdings").json()
    assert body[0]["dayChangePercent"] is None


def test_endpoint_empty_portfolio_returns_empty_array(client):
    response = client.get("/portfolios/P-EMPTY/holdings")
    assert response.status_code == 200
    assert response.json() == []


def test_endpoint_unknown_portfolio_returns_404(client):
    response = client.get("/portfolios/UNKNOWN/holdings")
    assert response.status_code == 404
    assert response.json()["error"] == "portfolio_not_found"
