import pytest
from fastapi.testclient import TestClient

from app.calculations.allocation import compute_allocation
from app.main import create_app
from tests.conftest import AUTH_HEADERS, make_settings


def holding(asset_class: str, quantity: float, price: float) -> dict:
    return {"assetClass": asset_class, "quantity": quantity, "price": price}


# --- calculations (no HTTP) ---


def test_same_class_values_are_summed():
    rows = compute_allocation([
        holding("Equity", 10, 100),
        holding("Equity", 5, 20),
        holding("Cash", 1, 900),
    ])

    assert rows == [
        {"asset_class": "Equity", "value": 1100, "percent": pytest.approx(1100 / 2000)},
        {"asset_class": "Cash", "value": 900, "percent": pytest.approx(900 / 2000)},
    ]


def test_zero_total_gives_zero_percent():
    rows = compute_allocation([holding("Equity", 0, 50), holding("Fixed Income", 0, 70)])

    assert [row["percent"] for row in rows] == [0.0, 0.0]


# --- endpoint ---


@pytest.fixture
def client():
    with TestClient(create_app(make_settings()), headers=AUTH_HEADERS) as test_client:
        yield test_client


def test_endpoint_returns_allocation_in_camel_case(client):
    response = client.get("/portfolios/P-9001/allocation")
    assert response.status_code == 200
    assert response.json() == [
        {"assetClass": "Equity", "value": 27300, "percent": pytest.approx(27300 / 48930)},
        {"assetClass": "Fixed Income", "value": 21630, "percent": pytest.approx(21630 / 48930)},
    ]


def test_endpoint_empty_portfolio_returns_empty_array(client):
    response = client.get("/portfolios/P-EMPTY/allocation")
    assert response.status_code == 200
    assert response.json() == []


def test_endpoint_single_asset_class_returns_one_entry_at_100_percent(client):
    response = client.get("/portfolios/P-SINGLE/allocation")
    assert response.status_code == 200
    assert response.json() == [{"assetClass": "Equity", "value": 2275, "percent": 1.0}]


def test_endpoint_unknown_portfolio_returns_404(client):
    response = client.get("/portfolios/UNKNOWN/allocation")
    assert response.status_code == 404
    assert response.json()["error"] == "portfolio_not_found"
