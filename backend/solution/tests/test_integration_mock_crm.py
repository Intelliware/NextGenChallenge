"""Live tests against the supplied mock CRM (node backend/mock-crm.mjs).

Skipped automatically when the mock is not running. Each test sets the mock's global mode via
POST /__control (our backend never sends ?mode=) and resets it to "auto" afterwards.
"""

import os
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import AUTH_HEADERS, make_settings

MOCK_CRM_URL = os.environ.get("MOCK_CRM_URL", "http://localhost:4002")
TIMEOUT_SECONDS = 3.0


def _mock_running() -> bool:
    try:
        return httpx.get(f"{MOCK_CRM_URL}/health", timeout=1).status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not _mock_running(), reason=f"mock CRM not running at {MOCK_CRM_URL}"),
]


@pytest.fixture
def crm():
    with httpx.Client(base_url=MOCK_CRM_URL, timeout=2) as client:
        yield client
        client.post("/__control", json={"mode": "auto"})


@pytest.fixture
def set_mode(crm):
    def apply(mode: str) -> None:
        crm.post("/__control", json={"mode": mode}).raise_for_status()

    return apply


@pytest.fixture
def backend():
    settings = make_settings(
        crm_base_url=MOCK_CRM_URL, crm_timeout_seconds=TIMEOUT_SECONDS, crm_retry_backoff_seconds=0.2
    )
    with TestClient(create_app(settings), headers=AUTH_HEADERS) as client:
        yield client


def calls_for(crm: httpx.Client, portfolio_id: str) -> int:
    return crm.get("/__stats").json()["callsByPortfolio"].get(portfolio_id, 0)


def test_ok_maps_real_crm_response(backend, set_mode):
    set_mode("ok")
    response = backend.get("/portfolios/P-9001")
    assert response.status_code == 200
    body = response.json()
    assert body["portfolioId"] == "P-9001"
    assert body["clientId"] == "abc123"
    assert body["label"] == "Taxable Brokerage"
    assert body["currency"] == "CAD"
    assert body["totalMarketValue"] == 48930
    assert body["totalReturnSinceInception"] == 0.187
    assert body["asOf"].endswith("Z")
    assert body["warnings"] == []


def test_selects_requested_account_when_it_is_not_first(backend, set_mode):
    set_mode("ok")
    body = backend.get("/portfolios/P-9002").json()
    assert body["label"] == "Retirement Account"
    assert body["dayChangePercent"] == 0
    assert any(w.startswith("dayChangePercent is 0") for w in body["warnings"])


def test_every_known_portfolio_maps(backend, set_mode):
    set_mode("ok")
    for portfolio_id in ("P-9001", "P-9002", "P-EMPTY", "P-SINGLE"):
        response = backend.get(f"/portfolios/{portfolio_id}")
        assert response.status_code == 200, portfolio_id
        assert response.json()["portfolioId"] == portfolio_id


def test_empty_portfolio_keeps_zeros(backend, set_mode):
    set_mode("ok")
    body = backend.get("/portfolios/P-EMPTY").json()
    assert body["totalMarketValue"] == 0
    assert body["warnings"] == []


def test_unknown_id_returns_404(backend, set_mode):
    set_mode("ok")
    response = backend.get("/portfolios/UNKNOWN")
    assert response.status_code == 404
    assert response.json()["error"] == "portfolio_not_found"


def test_missing_mode_nulls_fields_with_warnings(backend, set_mode):
    set_mode("missing")
    body = backend.get("/portfolios/P-9001").json()
    assert body["label"] is None
    assert body["totalMarketValue"] is None
    assert body["dayChangeAmount"] == 30
    assert len(body["warnings"]) == 2


def test_nested_mode_still_maps(backend, set_mode):
    set_mode("nested")
    body = backend.get("/portfolios/P-9001").json()
    assert body["label"] == "Taxable Brokerage"
    assert body["warnings"] == []


def test_error_mode_returns_503_after_one_retry(backend, crm, set_mode):
    set_mode("error")
    before = calls_for(crm, "P-9001")
    response = backend.get("/portfolios/P-9001")
    assert response.status_code == 503
    assert response.json()["error"] == "crm_unavailable"
    assert response.headers["Retry-After"]
    assert calls_for(crm, "P-9001") - before == 2


def test_timeout_mode_returns_504_without_waiting_10_seconds(backend, set_mode):
    set_mode("timeout")
    started = time.monotonic()
    response = backend.get("/portfolios/P-9001")
    elapsed = time.monotonic() - started
    assert response.status_code == 504
    assert response.json()["error"] == "crm_timeout"
    assert elapsed < TIMEOUT_SECONDS + 1, f"took {elapsed:.1f}s"


def test_one_crm_call_per_successful_request(backend, crm, set_mode):
    set_mode("ok")
    before = calls_for(crm, "P-SINGLE")
    backend.get("/portfolios/P-SINGLE")
    assert calls_for(crm, "P-SINGLE") - before == 1


def test_auto_mode_never_crashes_or_hangs(backend, set_mode):
    set_mode("auto")
    statuses = []
    for _ in range(10):
        started = time.monotonic()
        response = backend.get("/portfolios/P-9001")
        assert time.monotonic() - started < TIMEOUT_SECONDS + 1
        statuses.append(response.status_code)
        assert response.json().get("requestId") or response.json().get("portfolioId")
    assert set(statuses) <= {200, 503, 504}, statuses
    assert statuses.count(200) >= 7, statuses
