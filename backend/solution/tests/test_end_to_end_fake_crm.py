"""Full stack (route -> service -> real CrmClient over HTTP -> mapper) against the scenario fake CRM.

Runs in-process via httpx.ASGITransport, so no ports are needed. Every fixture is served through
the real HTTP client code path, proving the pieces fit together, not just in isolation.
"""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from scripts.fake_crm import available_scenarios, create_fake_crm
from tests.conftest import AUTH_HEADERS, make_settings
from tests.test_mapper import CLIENT_LEVEL_FIXTURES, ERROR_CASES, SUCCESS_CASES

EXPECTED_STATUS = {
    **{name: 200 for name in SUCCESS_CASES},
    "empty_accounts": 404,
    **{name: 502 for name, error in ERROR_CASES.items() if name != "empty_accounts"},
    **{name: 502 for name in CLIENT_LEVEL_FIXTURES},
}


@pytest.fixture
def fake_crm_app():
    return create_fake_crm()


@pytest.fixture
def backend(fake_crm_app):
    transport = httpx.ASGITransport(app=fake_crm_app)
    app = create_app(make_settings(), crm_transport=transport)
    with TestClient(app, headers=AUTH_HEADERS) as client:
        yield client


@pytest.fixture
def crm_control(fake_crm_app):
    with TestClient(fake_crm_app, base_url="http://crm.test") as client:
        yield client


def test_every_scenario_has_an_expected_status():
    assert set(available_scenarios()) == set(EXPECTED_STATUS)


@pytest.mark.parametrize("scenario", sorted(EXPECTED_STATUS))
def test_scenario_through_full_stack(backend, crm_control, scenario):
    crm_control.post("/__control", json={"scenario": scenario})
    response = backend.get("/portfolios/P-9001")
    assert response.status_code == EXPECTED_STATUS[scenario], response.text
    if response.status_code == 200:
        assert response.json()["portfolioId"] == "P-9001"
    else:
        assert response.json()["requestId"] == response.headers["X-Request-ID"]


@pytest.mark.parametrize(
    ("forced_status", "expected_status", "expected_crm_calls"),
    [(503, 503, 2), (500, 503, 1), (502, 503, 1), (504, 504, 1), (404, 404, 1), (401, 502, 1)],
)
def test_forced_crm_status(backend, crm_control, forced_status, expected_status, expected_crm_calls):
    crm_control.post("/__control", json={"status": forced_status})
    response = backend.get("/portfolios/P-9001")
    assert response.status_code == expected_status
    assert crm_control.get("/__stats").json()["calls"] == expected_crm_calls


def test_each_request_calls_crm_once_on_success(backend, crm_control):
    backend.get("/portfolios/P-9001")
    backend.get("/portfolios/P-9001")
    assert crm_control.get("/__stats").json()["callsByPortfolio"] == {"P-9001": 2}


def test_request_id_reaches_the_crm(fake_crm_app):
    seen: list[str | None] = []

    @fake_crm_app.middleware("http")
    async def capture(request, call_next):
        seen.append(request.headers.get("X-Request-ID"))
        return await call_next(request)

    app = create_app(make_settings(), crm_transport=httpx.ASGITransport(app=fake_crm_app))
    with TestClient(app, headers=AUTH_HEADERS) as backend:
        backend.get("/portfolios/P-9001", headers={"X-Request-ID": "trace-e2e"})
    assert seen == ["trace-e2e"]
