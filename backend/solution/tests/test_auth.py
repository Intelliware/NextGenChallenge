"""Task 4: every route except the health checks and the API docs needs "Authorization: Bearer <token>"."""

import logging
import re

import pytest
from fastapi.testclient import TestClient

from app.auth import (
    INVALID_TOKEN_MESSAGE,
    MALFORMED_HEADER_MESSAGE,
    MISSING_TOKEN_MESSAGE,
    PUBLIC_PATHS,
    check_bearer_token,
)
from app.config import Settings
from app.dependencies import get_crm_client, get_history_service
from app.errors import Unauthorized
from app.main import create_app
from app.services.history_service import HistoryService
from tests.conftest import AUTH_HEADERS, TEST_TOKEN, load_fixture, make_settings
from tests.test_api_docs import assert_documented
from tests.test_portfolios_api import FakeCrm, assert_error

PORTFOLIO_URL = "/portfolios/P-9001"
EXPECTED_PUBLIC_PATHS = ["/health", "/health/ready", "/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"]

# case -> (Authorization header, message it is rejected with)
REJECTED_HEADERS = {
    "missing": (None, MISSING_TOKEN_MESSAGE),
    "empty": ("", MISSING_TOKEN_MESSAGE),
    "blank": ("   ", MISSING_TOKEN_MESSAGE),
    "no_bearer_prefix": (TEST_TOKEN, MALFORMED_HEADER_MESSAGE),
    "scheme_only": ("Bearer", MALFORMED_HEADER_MESSAGE),
    "scheme_and_space": ("Bearer ", MALFORMED_HEADER_MESSAGE),
    "basic_auth": ("Basic dXNlcjpwYXNz", MALFORMED_HEADER_MESSAGE),
    "other_scheme": (f"Token {TEST_TOKEN}", MALFORMED_HEADER_MESSAGE),
    "no_space": (f"Bearer{TEST_TOKEN}", MALFORMED_HEADER_MESSAGE),
    "wrong_token": ("Bearer wrong-token", INVALID_TOKEN_MESSAGE),
    "token_is_case_sensitive": (f"Bearer {TEST_TOKEN.upper()}", INVALID_TOKEN_MESSAGE),
    "extra_word": (f"Bearer {TEST_TOKEN} extra", INVALID_TOKEN_MESSAGE),
    "non_ascii_token": ("Bearer t\u00f6ken", INVALID_TOKEN_MESSAGE),
}


# --- The header check, without HTTP ---


@pytest.mark.parametrize(
    "header",
    [f"Bearer {TEST_TOKEN}", f"bearer {TEST_TOKEN}", f"BEARER {TEST_TOKEN}", f"  Bearer   {TEST_TOKEN}  "],
    ids=["standard", "lowercase_scheme", "uppercase_scheme", "extra_spaces"],
)
def test_valid_header_passes(header):
    check_bearer_token(header, TEST_TOKEN)


@pytest.mark.parametrize("case", REJECTED_HEADERS)
def test_bad_header_is_rejected_with_a_specific_message(case):
    header, message = REJECTED_HEADERS[case]
    with pytest.raises(Unauthorized) as caught:
        check_bearer_token(header, TEST_TOKEN)
    assert caught.value.message == message


# --- The middleware ---


@pytest.fixture
def fake_crm() -> FakeCrm:
    crm = FakeCrm()
    crm.responses["P-9001"] = load_fixture("ok_p9001")
    return crm


@pytest.fixture
def app(fake_crm):
    app = create_app(make_settings())
    app.dependency_overrides[get_crm_client] = lambda: fake_crm
    app.dependency_overrides[get_history_service] = lambda: HistoryService({}, {"P-9001"})
    return app


@pytest.fixture
def anonymous(app):
    """Sends no Authorization header unless a test adds one."""
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def test_missing_header_is_rejected_before_route_logic(anonymous, fake_crm):
    response = anonymous.get(PORTFOLIO_URL)
    assert assert_error(response, 401, "unauthorized")["message"] == MISSING_TOKEN_MESSAGE
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert fake_crm.calls == []


@pytest.mark.parametrize("case", ["no_bearer_prefix", "basic_auth", "wrong_token", "extra_word"])
def test_malformed_or_wrong_header_is_rejected_before_route_logic(anonymous, fake_crm, case):
    header, message = REJECTED_HEADERS[case]
    response = anonymous.get(PORTFOLIO_URL, headers={"Authorization": header})
    assert assert_error(response, 401, "unauthorized")["message"] == message
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert fake_crm.calls == []


def test_valid_token_reaches_the_route(anonymous, fake_crm):
    response = anonymous.get(PORTFOLIO_URL, headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["portfolioId"] == "P-9001"
    assert "WWW-Authenticate" not in response.headers
    assert fake_crm.calls == ["P-9001"]


def test_non_ascii_header_is_a_401_not_a_500(anonymous):
    response = anonymous.get(PORTFOLIO_URL, headers={"Authorization": "Bearer t\xf6ken".encode("latin-1")})
    assert_error(response, 401, "unauthorized")


def test_every_operation_except_public_ones_requires_a_token(anonymous):
    """Covers routes added later too: a new route is protected unless its path is added to PUBLIC_PATHS."""
    checked = set()
    for path, path_item in anonymous.get("/openapi.json").json()["paths"].items():
        if path in PUBLIC_PATHS:
            continue
        url = re.sub(r"\{[^}]+\}", "P-9001", path)
        for method in path_item:
            assert anonymous.request(method.upper(), url).status_code == 401, f"{method} {path}"
        checked.add(path)
    assert {"/portfolios/{portfolio_id}", "/portfolios/{portfolio_id}/performance-history"} <= checked


def test_only_the_health_checks_and_docs_are_public():
    assert PUBLIC_PATHS == set(EXPECTED_PUBLIC_PATHS)


@pytest.mark.parametrize("path", EXPECTED_PUBLIC_PATHS)
def test_public_paths_need_no_token(anonymous, path):
    assert anonymous.get(path).status_code == 200


@pytest.mark.parametrize("path", ["/health/extra", "/healthz", "/docs/extra", "/openapi.json/extra"])
def test_public_paths_are_matched_exactly_not_by_prefix(anonymous, path):
    assert_error(anonymous.get(path), 401, "unauthorized")


def test_unknown_path_needs_a_token_before_it_404s(anonymous):
    assert_error(anonymous.get("/nope"), 401, "unauthorized")
    assert_error(anonymous.get("/nope", headers=AUTH_HEADERS), 404, "not_found")


def test_401_echoes_the_callers_request_id(anonymous):
    response = anonymous.get(PORTFOLIO_URL, headers={"X-Request-ID": "trace-401"})
    assert response.headers["X-Request-ID"] == "trace-401"
    assert assert_error(response, 401, "unauthorized")["requestId"] == "trace-401"


def test_token_comes_from_settings(fake_crm):
    app = create_app(make_settings(api_token="rotated-token"))
    app.dependency_overrides[get_crm_client] = lambda: fake_crm
    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.get(PORTFOLIO_URL, headers=AUTH_HEADERS).status_code == 401
        assert client.get(PORTFOLIO_URL, headers={"Authorization": "Bearer rotated-token"}).status_code == 200


def test_default_token_is_the_documented_mock_token_and_stays_out_of_reprs(monkeypatch):
    monkeypatch.delenv("API_TOKEN", raising=False)
    settings = Settings(_env_file=None)
    assert settings.api_token.get_secret_value() == "superday-demo-token"
    assert "superday-demo-token" not in repr(settings)


def test_rejections_are_logged_with_the_request_id_but_without_the_token(anonymous, caplog):
    caplog.set_level(logging.INFO, logger="app.auth")
    headers = {"Authorization": "Bearer leaked-secret-123", "X-Request-ID": "trace-log"}
    anonymous.get(PORTFOLIO_URL, headers=headers)
    [record] = [r for r in caplog.records if r.name == "app.auth"]
    assert record.getMessage().startswith("auth_rejected path=/portfolios/P-9001")
    assert record.request_id == "trace-log"
    assert "leaked-secret-123" not in caplog.text


# --- The interactive docs ---


def test_docs_show_which_operations_need_the_token(anonymous):
    spec = anonymous.get("/openapi.json").json()
    assert spec["components"]["securitySchemes"]["bearerAuth"]["scheme"] == "bearer"
    for path, path_item in spec["paths"].items():
        for operation in path_item.values():
            if path in PUBLIC_PATHS:
                assert "security" not in operation and "401" not in operation["responses"], path
            else:
                assert operation["security"] == [{"bearerAuth": []}], path
                assert "401" in operation["responses"], path


def test_docs_remember_the_token_across_reloads(anonymous):
    assert '"persistAuthorization": true' in anonymous.get("/docs").text


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": TEST_TOKEN}, {"Authorization": "Bearer wrong-token"}],
    ids=["missing", "malformed", "invalid"],
)
def test_401_examples_in_the_docs_are_real_responses(anonymous, headers):
    assert_documented(anonymous, "/portfolios/{portfolio_id}", anonymous.get(PORTFOLIO_URL, headers=headers))
