"""The interactive docs at /docs: page settings, no misleading 422s, and error examples that match real responses."""

import pytest
from fastapi.testclient import TestClient

from app.crm.errors import CrmTimeout, CrmUnavailable
from app.dependencies import get_crm_client, get_history_service
from app.main import create_app
from app.openapi import EXAMPLE_REQUEST_ID, OPENAPI_TAGS
from app.services.history_service import HistoryService
from tests.conftest import AUTH_HEADERS, load_fixture, make_settings
from tests.test_portfolios_api import FakeCrm

PORTFOLIO = "/portfolios/{portfolio_id}"
HISTORY = "/portfolios/{portfolio_id}/performance-history"


@pytest.fixture
def fake_crm() -> FakeCrm:
    return FakeCrm()


@pytest.fixture
def client(fake_crm):
    app = create_app(make_settings())
    app.dependency_overrides[get_crm_client] = lambda: fake_crm
    app.dependency_overrides[get_history_service] = lambda: HistoryService({}, {"P-9001"})
    with TestClient(app, raise_server_exceptions=False, headers=AUTH_HEADERS) as test_client:
        yield test_client


def assert_documented(client: TestClient, path: str, response) -> None:
    """The response body, apart from its request id, is one of the examples documented for its status."""
    responses = client.get("/openapi.json").json()["paths"][path]["get"]["responses"]
    assert str(response.status_code) in responses
    media = responses[str(response.status_code)]["content"]["application/json"]
    examples = [media["example"]] if "example" in media else [e["value"] for e in media["examples"].values()]
    assert (response.json() | {"requestId": EXAMPLE_REQUEST_ID}) in examples


def test_swagger_ui_opens_ready_to_try(client):
    html = client.get("/docs").text
    assert '"tryItOutEnabled": true' in html
    assert '"displayRequestDuration": true' in html
    assert client.get("/openapi.json").json()["tags"] == OPENAPI_TAGS


def test_no_422_is_documented_because_validation_errors_are_400(client):
    spec = client.get("/openapi.json").json()
    statuses = {status for item in spec["paths"].values() for op in item.values() for status in op["responses"]}
    assert "422" not in statuses
    assert not {"HTTPValidationError", "ValidationError"} & set(spec["components"]["schemas"])


def test_every_parameter_has_dropdown_examples(client):
    spec = client.get("/openapi.json").json()
    for path in (PORTFOLIO, HISTORY):
        for parameter in spec["paths"][path]["get"]["parameters"]:
            assert parameter["examples"], f"{path} {parameter['name']}"


@pytest.mark.parametrize(
    ("url", "crm_outcome"),
    [
        ("/portfolios/bad%20id", None),
        ("/portfolios/UNKNOWN", None),
        ("/portfolios/P-9001", load_fixture("missing_client_id")),
        ("/portfolios/P-9001", CrmUnavailable("down", portfolio_id="P-9001", upstream_status=503)),
        ("/portfolios/P-9001", CrmTimeout("slow", portfolio_id="P-9001", timeout_seconds=3.0)),
    ],
    ids=["400", "404", "502", "503", "504"],
)
def test_portfolio_error_examples_are_real_responses(client, fake_crm, url, crm_outcome):
    if crm_outcome is not None:
        fake_crm.responses["P-9001"] = crm_outcome
    assert_documented(client, PORTFOLIO, client.get(url))


@pytest.mark.parametrize(
    "url",
    [
        "/portfolios/bad%20id/performance-history",
        "/portfolios/P-9001/performance-history?range=1W",
        "/portfolios/UNKNOWN/performance-history",
    ],
    ids=["invalid_portfolio_id", "invalid_range", "portfolio_not_found"],
)
def test_history_error_examples_are_real_responses(client, url):
    assert_documented(client, HISTORY, client.get(url))


def test_history_unavailable_example_is_the_real_response(tmp_path):
    app = create_app(make_settings(history_file=tmp_path / "missing.json"))
    with TestClient(app, raise_server_exceptions=False, headers=AUTH_HEADERS) as test_client:
        assert_documented(test_client, HISTORY, test_client.get("/portfolios/P-9001/performance-history"))
