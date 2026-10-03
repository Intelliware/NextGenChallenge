from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.crm.errors import CrmBadResponse, CrmNotFound, CrmTimeout, CrmUnavailable
from app.dependencies import get_crm_client
from app.main import create_app
from tests.conftest import AUTH_HEADERS, load_fixture, make_settings


class FakeCrm:
    """Stands in for CrmClient: returns a payload or raises, and records every call."""

    def __init__(self):
        self.responses: dict[str, Any] = {}
        self.calls: list[str] = []
        self.reachable = True

    async def fetch_portfolio(self, portfolio_id: str) -> dict:
        self.calls.append(portfolio_id)
        outcome = self.responses.get(portfolio_id, CrmNotFound("not found", portfolio_id=portfolio_id))
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    async def ping(self) -> bool:
        return self.reachable


@pytest.fixture
def fake_crm() -> FakeCrm:
    return FakeCrm()


@pytest.fixture
def client(fake_crm):
    app = create_app(make_settings())
    app.dependency_overrides[get_crm_client] = lambda: fake_crm
    with TestClient(app, raise_server_exceptions=False, headers=AUTH_HEADERS) as test_client:
        yield test_client


def assert_error(response, status: int, error: str) -> dict:
    assert response.status_code == status
    body = response.json()
    assert body["error"] == error
    assert body["message"]
    assert body["requestId"] == response.headers["X-Request-ID"]
    return body


def test_maps_successful_crm_response(client, fake_crm):
    fake_crm.responses["P-9001"] = load_fixture("ok_p9001")
    response = client.get("/portfolios/P-9001")
    assert response.status_code == 200
    assert response.json() == {
        "portfolioId": "P-9001",
        "clientId": "abc123",
        "label": "Taxable Brokerage",
        "currency": "CAD",
        "totalMarketValue": 48930.0,
        "dayChangeAmount": 30.0,
        "dayChangePercent": 0.0006134969325153375,
        "totalReturnSinceInception": 0.187,
        "asOf": "2026-10-03T16:00:00Z",
        "warnings": [],
    }
    assert response.headers["X-Request-ID"]


def test_null_fields_are_explicit_nulls_not_omitted(client, fake_crm):
    fake_crm.responses["P-9001"] = load_fixture("all_numbers_null")
    body = client.get("/portfolios/P-9001").json()
    for field in ("totalMarketValue", "dayChangeAmount", "dayChangePercent", "totalReturnSinceInception"):
        assert field in body and body[field] is None
    assert len(body["warnings"]) == 4


def test_unknown_portfolio_returns_structured_404(client):
    body = assert_error(client.get("/portfolios/P-0000"), 404, "portfolio_not_found")
    assert "P-0000" in body["message"]


def test_crm_payload_without_matching_account_returns_404(client, fake_crm):
    fake_crm.responses["P-9001"] = load_fixture("empty_accounts")
    assert_error(client.get("/portfolios/P-9001"), 404, "portfolio_not_found")


def test_crm_timeout_returns_504(client, fake_crm):
    fake_crm.responses["P-9001"] = CrmTimeout("slow", portfolio_id="P-9001", timeout_seconds=3.0)
    body = assert_error(client.get("/portfolios/P-9001"), 504, "crm_timeout")
    assert body["details"] == {"timeoutSeconds": 3.0}


def test_crm_outage_returns_503_with_retry_after(client, fake_crm):
    fake_crm.responses["P-9001"] = CrmUnavailable("down", portfolio_id="P-9001", upstream_status=503)
    response = client.get("/portfolios/P-9001")
    body = assert_error(response, 503, "crm_unavailable")
    assert response.headers["Retry-After"] == "5"
    assert body["details"] == {"upstreamStatus": 503}


def test_unusable_crm_payload_returns_502(client, fake_crm):
    fake_crm.responses["P-9001"] = load_fixture("duplicate_acct_ref")
    body = assert_error(client.get("/portfolios/P-9001"), 502, "crm_bad_response")
    assert "conflicting" in body["details"]["reason"]


def test_client_level_bad_response_returns_502(client, fake_crm):
    fake_crm.responses["P-9001"] = CrmBadResponse("CRM response was not valid JSON", portfolio_id="P-9001")
    assert_error(client.get("/portfolios/P-9001"), 502, "crm_bad_response")


@pytest.mark.parametrize(
    "bad_id",
    ["bad%20id", "P-9001%3Bdrop", "%E2%9C%93", "a" * 65, "P.9001", "P-9001%2F..%2Fadmin"],
    ids=["space", "semicolon", "unicode", "too_long", "dot", "encoded_slash"],
)
def test_invalid_id_is_rejected_without_calling_crm(client, fake_crm, bad_id):
    response = client.get(f"/portfolios/{bad_id}")
    if response.status_code == 404:
        # An encoded slash may be routed as a different path; either way the CRM must not be called.
        assert response.json()["error"] == "not_found"
    else:
        assert_error(response, 400, "invalid_portfolio_id")
    assert fake_crm.calls == []


def test_max_length_id_is_accepted(client, fake_crm):
    fake_crm.responses["a" * 64] = load_fixture("ok_p9001")
    response = client.get(f"/portfolios/{'a' * 64}")
    assert_error(response, 404, "portfolio_not_found")
    assert fake_crm.calls == ["a" * 64]


def test_incoming_request_id_is_echoed(client, fake_crm):
    fake_crm.responses["P-9001"] = load_fixture("ok_p9001")
    response = client.get("/portfolios/P-9001", headers={"X-Request-ID": "trace-abc.123"})
    assert response.headers["X-Request-ID"] == "trace-abc.123"


def test_unsafe_incoming_request_id_is_replaced(client):
    response = client.get("/portfolios/P-0000", headers={"X-Request-ID": "bad id\twith spaces"})
    request_id = response.headers["X-Request-ID"]
    assert request_id != "bad id\twith spaces"
    assert response.json()["requestId"] == request_id


def test_unexpected_exception_returns_500_without_leaking_details(client, fake_crm):
    fake_crm.responses["P-9001"] = RuntimeError("database password is hunter2")
    response = client.get("/portfolios/P-9001", headers={"X-Request-ID": "trace-500"})
    assert response.status_code == 500
    assert response.json() == {
        "error": "internal_error",
        "message": "An unexpected error occurred.",
        "requestId": "trace-500",
    }
    assert "hunter2" not in response.text


def test_unknown_route_is_structured_404(client):
    assert_error(client.get("/nope"), 404, "not_found")


def test_wrong_method_is_structured_405(client):
    assert_error(client.post("/portfolios/P-9001"), 405, "method_not_allowed")


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_when_crm_reachable(client):
    assert client.get("/health/ready").json() == {"status": "ok", "crm": "ok"}


def test_ready_reports_degraded_when_crm_unreachable(client, fake_crm):
    fake_crm.reachable = False
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "crm": "unreachable"}


def test_openapi_documents_every_error_status(client):
    operation = client.get("/openapi.json").json()["paths"]["/portfolios/{portfolio_id}"]["get"]
    assert {"200", "400", "404", "502", "503", "504"} <= set(operation["responses"])
